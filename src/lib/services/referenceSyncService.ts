import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeReferenceSelections,
  normalizeReferenceValueToAssetIds,
  referenceSelectionsToValue,
  type ReferenceSelection,
  valueToReferenceDisplayString,
} from '@/lib/utils/referenceValue';

export type SourceCellChange = {
  assetId: string;
  fieldId: string;
  valueJson: unknown;
};

export type ReferenceCellUpdate = {
  referencingAssetId: string;
  referencingFieldId: string;
  referencingLibraryId: string;
  newReferenceValue: unknown;
};

type FieldMeta = {
  id: string;
  data_type: string;
  library_id: string;
};

const REF_FIELD_ID_CHUNK = 100;

function rowReferencesAsset(valueJson: unknown, sourceAssetId: string): boolean {
  return normalizeReferenceValueToAssetIds(valueJson).includes(sourceAssetId);
}

function selectionMatchesSourceField(
  selection: ReferenceSelection,
  sourceAssetId: string,
  sourceFieldId: string,
  sourceLibraryFirstFieldId: string | null
): boolean {
  if (selection.assetId !== sourceAssetId) return false;
  if (selection.fieldId && selection.fieldId.trim() !== '') {
    return selection.fieldId === sourceFieldId;
  }
  // Legacy rows without fieldId: keep in sync with first column, or any column if unknown.
  if (sourceLibraryFirstFieldId) {
    return sourceLibraryFirstFieldId === sourceFieldId;
  }
  return true;
}

function applySourceChangeToReferenceValue(
  valueJson: unknown,
  sourceAssetId: string,
  sourceFieldId: string,
  newDisplayValue: string,
  sourceLibraryFirstFieldId: string | null
): { updated: unknown; changed: boolean } {
  const selections = normalizeReferenceSelections(valueJson);
  if (selections.length === 0) {
    return { updated: valueJson, changed: false };
  }

  let changed = false;
  const next = selections.map((sel) => {
    if (!selectionMatchesSourceField(sel, sourceAssetId, sourceFieldId, sourceLibraryFirstFieldId)) {
      return sel;
    }
    if (sel.displayValue === newDisplayValue) return sel;
    changed = true;
    return { ...sel, displayValue: newDisplayValue };
  });

  if (!changed) return { updated: valueJson, changed: false };
  return { updated: referenceSelectionsToValue(next), changed: true };
}

async function getReferenceFieldIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('library_field_definitions')
    .select('id')
    .eq('data_type', 'reference');

  if (error) throw error;
  return (data ?? []).map((row: { id: string }) => row.id);
}

async function getFirstFieldIdByLibrary(
  supabase: SupabaseClient,
  libraryIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (libraryIds.length === 0) return map;

  const unique = [...new Set(libraryIds)];
  await Promise.all(
    unique.map(async (libraryId) => {
      const { data, error } = await supabase
        .from('library_field_definitions')
        .select('id')
        .eq('library_id', libraryId)
        .order('order_index', { ascending: true })
        .limit(1);

      if (error) {
        map.set(libraryId, null);
        return;
      }
      map.set(libraryId, data?.[0]?.id ?? null);
    })
  );
  return map;
}

type ReferenceValueRow = {
  asset_id: string;
  field_id: string;
  value_json: unknown;
  library_assets: { library_id?: string } | { library_id?: string }[] | null;
};

/** Scan reference columns and filter in memory (reliable vs jsonb contains). */
async function findReferenceRowsPointingToAsset(
  supabase: SupabaseClient,
  refFieldIds: string[],
  sourceAssetId: string
): Promise<ReferenceValueRow[]> {
  const select =
    'asset_id, field_id, value_json, library_assets!inner(library_id)';
  const byKey = new Map<string, ReferenceValueRow>();

  for (let i = 0; i < refFieldIds.length; i += REF_FIELD_ID_CHUNK) {
    const chunk = refFieldIds.slice(i, i + REF_FIELD_ID_CHUNK);
    const { data, error } = await supabase
      .from('library_asset_values')
      .select(select)
      .in('field_id', chunk);

    if (error) throw error;

    for (const row of data ?? []) {
      if (!rowReferencesAsset(row.value_json, sourceAssetId)) continue;
      byKey.set(`${row.asset_id}:${row.field_id}`, row as ReferenceValueRow);
    }
  }

  return [...byKey.values()];
}

/**
 * When source cell values change (edit or replace), update displayValue on all
 * reference fields that point at those cells.
 */
export async function syncReferencesForSourceChanges(
  supabase: SupabaseClient,
  changes: SourceCellChange[]
): Promise<ReferenceCellUpdate[]> {
  if (changes.length === 0) return [];

  const deduped = new Map<string, SourceCellChange>();
  for (const change of changes) {
    deduped.set(`${change.assetId}:${change.fieldId}`, change);
  }
  const uniqueChanges = [...deduped.values()];

  const refFieldIds = await getReferenceFieldIds(supabase);
  if (refFieldIds.length === 0) return [];

  const sourceAssetIds = [...new Set(uniqueChanges.map((c) => c.assetId))];
  const sourceFieldIds = [...new Set(uniqueChanges.map((c) => c.fieldId))];

  const [{ data: sourceAssets, error: assetsError }, { data: fieldDefs, error: fieldsError }] =
    await Promise.all([
      supabase.from('library_assets').select('id, library_id').in('id', sourceAssetIds),
      supabase
        .from('library_field_definitions')
        .select('id, data_type, library_id')
        .in('id', sourceFieldIds),
    ]);

  if (assetsError) throw assetsError;
  if (fieldsError) throw fieldsError;

  const libraryIdByAsset = new Map<string, string>();
  for (const row of sourceAssets ?? []) {
    libraryIdByAsset.set(row.id, row.library_id);
  }

  const fieldMetaById = new Map<string, FieldMeta>();
  for (const row of (fieldDefs ?? []) as FieldMeta[]) {
    fieldMetaById.set(row.id, row);
  }

  const sourceLibraryIds = [...new Set([...libraryIdByAsset.values()])];
  const firstFieldByLibrary = await getFirstFieldIdByLibrary(supabase, sourceLibraryIds);

  const displayByChangeKey = new Map<string, string>();
  for (const change of uniqueChanges) {
    const meta = fieldMetaById.get(change.fieldId);
    const dataType = meta?.data_type ?? 'string';
    displayByChangeKey.set(
      `${change.assetId}:${change.fieldId}`,
      valueToReferenceDisplayString(change.valueJson, dataType)
    );
  }

  const updates: ReferenceCellUpdate[] = [];
  const upsertRows: Array<{ asset_id: string; field_id: string; value_json: unknown }> = [];

  for (const sourceAssetId of sourceAssetIds) {
    const refRows = await findReferenceRowsPointingToAsset(
      supabase,
      refFieldIds,
      sourceAssetId
    );

    for (const row of refRows) {
      const referencingAssetId = row.asset_id as string;
      const referencingFieldId = row.field_id as string;
      const libraryRow = row.library_assets as { library_id?: string } | { library_id?: string }[] | null;
      const referencingLibraryId = Array.isArray(libraryRow)
        ? libraryRow[0]?.library_id
        : libraryRow?.library_id;
      if (!referencingLibraryId) continue;

      let nextValue = row.value_json;
      let rowChanged = false;

      for (const change of uniqueChanges) {
        if (change.assetId !== sourceAssetId) continue;
        const sourceLibraryId = libraryIdByAsset.get(change.assetId);
        const firstFieldId = sourceLibraryId
          ? firstFieldByLibrary.get(sourceLibraryId) ?? null
          : null;
        const newDisplay = displayByChangeKey.get(`${change.assetId}:${change.fieldId}`) ?? 'Untitled';
        const result = applySourceChangeToReferenceValue(
          nextValue,
          change.assetId,
          change.fieldId,
          newDisplay,
          firstFieldId
        );
        if (result.changed) {
          nextValue = result.updated;
          rowChanged = true;
        }
      }

      if (!rowChanged) continue;

      upsertRows.push({
        asset_id: referencingAssetId,
        field_id: referencingFieldId,
        value_json: nextValue,
      });

      updates.push({
        referencingAssetId,
        referencingFieldId,
        referencingLibraryId,
        newReferenceValue: nextValue,
      });
    }
  }

  if (upsertRows.length > 0) {
    const { error: upsertError } = await supabase
      .from('library_asset_values')
      .upsert(upsertRows, { onConflict: 'asset_id,field_id' });

    if (upsertError) throw upsertError;

    const touchedRefAssetIds = [...new Set(upsertRows.map((r) => r.asset_id))];
    await supabase
      .from('library_assets')
      .update({ updated_at: new Date().toISOString() })
      .in('id', touchedRefAssetIds);
  }

  return updates;
}

export function collectAffectedLibraryIdsFromReferenceSync(
  referenceUpdates: ReferenceCellUpdate[],
  sourceLibraryId?: string
): string[] {
  const ids = new Set<string>();
  if (sourceLibraryId) ids.add(sourceLibraryId);
  for (const u of referenceUpdates) {
    ids.add(u.referencingLibraryId);
  }
  return [...ids];
}
