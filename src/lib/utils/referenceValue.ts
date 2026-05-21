import type { SupabaseClient } from '@supabase/supabase-js';
import { valueToDisplayString } from '@/lib/utils/cellValueReplace';
import type { AssetRow, PropertyConfig } from '@/lib/types/libraryAssets';

/**
 * Reference field value normalization, display labels, and display cache loading.
 */

// --- Value normalization ---

/**
 * Normalize reference property values.
 *
 * Historical behavior: `reference` value stored as a single assetId string (or null/empty).
 * New behavior: allow multi-select, store as `string[]` (or null when empty).
 */
export function normalizeReferenceValueToAssetIds(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') return v.trim();
        if (v && typeof v === 'object') {
          const anyV = v as { assetId?: unknown; id?: unknown };
          const raw =
            typeof anyV.assetId === 'string'
              ? anyV.assetId
              : typeof anyV.id === 'string'
                ? anyV.id
                : '';
          return raw.trim();
        }
        return '';
      })
      .filter((v) => v !== '');
  }

  if (typeof value === 'string') {
    const s = value.trim();
    return s ? [s] : [];
  }

  return [];
}

export type ReferenceSelection = {
  assetId: string;
  fieldId?: string | null;
  fieldLabel?: string | null;
  displayValue?: string | null;
};

export function normalizeReferenceSelections(value: unknown): ReferenceSelection[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim() !== '') {
      return [{ assetId: value.trim() }];
    }
    return [];
  }

  const normalized = value
    .map((v) => {
      if (typeof v === 'string') {
        const assetId = v.trim();
        return assetId ? ({ assetId } as ReferenceSelection) : null;
      }
      if (v && typeof v === 'object') {
        const anyV = v as {
          assetId?: unknown;
          id?: unknown;
          fieldId?: unknown;
          fieldLabel?: unknown;
          displayValue?: unknown;
        };
        const assetIdRaw =
          typeof anyV.assetId === 'string'
            ? anyV.assetId
            : typeof anyV.id === 'string'
              ? anyV.id
              : '';
        const assetId = assetIdRaw.trim();
        if (!assetId) return null;
        return {
          assetId,
          fieldId: typeof anyV.fieldId === 'string' ? anyV.fieldId : null,
          fieldLabel: typeof anyV.fieldLabel === 'string' ? anyV.fieldLabel : null,
          displayValue: typeof anyV.displayValue === 'string' ? anyV.displayValue : null,
        } as ReferenceSelection;
      }
      return null;
    })
    .filter((v): v is ReferenceSelection => Boolean(v));

  const seen = new Set<string>();
  const deduped: ReferenceSelection[] = [];
  for (const item of normalized) {
    const key = `${item.assetId}::${item.fieldId || ''}::${item.displayValue || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

/** null when empty (product requirement) */
export function assetIdsToReferenceValue(assetIds: string[]): string[] | null {
  if (!assetIds || assetIds.length === 0) return null;
  return assetIds;
}

export function referenceSelectionsToValue(
  selections: ReferenceSelection[]
): ReferenceSelection[] | null {
  if (!selections || selections.length === 0) return null;
  return selections;
}

// --- Display ---

/** Display text for a referenced source cell (used in reference snapshots). */
export function valueToReferenceDisplayString(
  value: unknown,
  dataType: string
): string {
  const display = valueToDisplayString(value, dataType).trim();
  if (display !== '') return display;
  return 'Untitled';
}

export function referenceCacheKey(assetId: string, fieldId?: string | null): string {
  return fieldId && fieldId.trim() !== '' ? `${assetId}:${fieldId}` : assetId;
}

/**
 * Label for a reference chip: synced displayValue first, then live cache (legacy rows).
 */
export function resolveReferenceSelectionLabel(
  selection: Pick<ReferenceSelection, 'assetId' | 'fieldId' | 'displayValue'>,
  cache: Record<string, string>
): string {
  if (selection.displayValue && selection.displayValue.trim() !== '') {
    return selection.displayValue.trim();
  }
  const key = referenceCacheKey(selection.assetId, selection.fieldId);
  const live = cache[key] ?? cache[selection.assetId];
  if (live && live.trim() !== '') return live;
  return selection.assetId;
}

// --- Display cache (Supabase) ---

type CacheTarget = { assetId: string; fieldId: string | null };

function collectReferenceTargets(
  rows: AssetRow[],
  newRowData: Record<string, unknown>,
  properties: PropertyConfig[],
  isAddingRow: boolean
): CacheTarget[] {
  const targets: CacheTarget[] = [];
  const seen = new Set<string>();

  const addSelections = (value: unknown) => {
    normalizeReferenceSelections(value).forEach((sel: ReferenceSelection) => {
      const key = referenceCacheKey(sel.assetId, sel.fieldId);
      if (seen.has(key)) return;
      seen.add(key);
      targets.push({
        assetId: sel.assetId,
        fieldId: sel.fieldId && sel.fieldId.trim() !== '' ? sel.fieldId : null,
      });
    });
  };

  rows.forEach((row) => {
    properties.forEach((prop) => {
      if (prop.dataType === 'reference') {
        addSelections(row.propertyValues[prop.key]);
      }
    });
  });

  if (isAddingRow) {
    properties.forEach((prop) => {
      if (prop.dataType === 'reference') {
        addSelections(newRowData[prop.key]);
      }
    });
  }

  return targets;
}

async function getFirstFieldId(
  supabase: SupabaseClient,
  libraryId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('library_field_definitions')
    .select('id')
    .eq('library_id', libraryId)
    .order('order_index', { ascending: true })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0].id;
}

async function loadDisplayForTarget(
  supabase: SupabaseClient,
  target: CacheTarget,
  libraryIdByAsset: Map<string, string>,
  fieldTypeById: Map<string, string>
): Promise<{ cacheKey: string; label: string } | null> {
  const libraryId = libraryIdByAsset.get(target.assetId);
  if (!libraryId) return null;

  let fieldId = target.fieldId;
  if (!fieldId) {
    fieldId = await getFirstFieldId(supabase, libraryId);
    if (!fieldId) return null;
  }

  const { data: valueData, error: valueError } = await supabase
    .from('library_asset_values')
    .select('value_json')
    .eq('asset_id', target.assetId)
    .eq('field_id', fieldId)
    .maybeSingle();

  if (valueError) return null;

  const dataType = fieldTypeById.get(fieldId) ?? 'string';
  const label = valueToReferenceDisplayString(valueData?.value_json, dataType);
  const cacheKey = referenceCacheKey(target.assetId, target.fieldId);

  return { cacheKey, label };
}

/** Build display labels for all reference selections visible in the table. */
export async function buildReferenceDisplayCache(
  supabase: SupabaseClient,
  params: {
    rows: AssetRow[];
    newRowData: Record<string, unknown>;
    properties: PropertyConfig[];
    isAddingRow: boolean;
  }
): Promise<Record<string, string>> {
  const targets = collectReferenceTargets(
    params.rows,
    params.newRowData,
    params.properties,
    params.isAddingRow
  );
  if (targets.length === 0) return {};

  const assetIds = [...new Set(targets.map((t) => t.assetId))];
  const { data: assetsData, error: assetsError } = await supabase
    .from('library_assets')
    .select('id, library_id')
    .in('id', assetIds);

  if (assetsError) throw assetsError;

  const libraryIdByAsset = new Map<string, string>();
  const libraryIds = new Set<string>();
  for (const asset of assetsData ?? []) {
    libraryIdByAsset.set(asset.id, asset.library_id);
    libraryIds.add(asset.library_id);
  }

  const fieldTypeById = new Map<string, string>();
  if (libraryIds.size > 0) {
    const { data: fieldDefs, error: fieldError } = await supabase
      .from('library_field_definitions')
      .select('id, data_type')
      .in('library_id', [...libraryIds]);

    if (!fieldError) {
      for (const row of fieldDefs ?? []) {
        fieldTypeById.set(row.id, row.data_type ?? 'string');
      }
    }
  }

  const namesMap: Record<string, string> = {};
  await Promise.all(
    targets.map(async (target) => {
      const result = await loadDisplayForTarget(
        supabase,
        target,
        libraryIdByAsset,
        fieldTypeById
      );
      if (!result) return;
      namesMap[result.cacheKey] = result.label;
      if (!target.fieldId) {
        namesMap[target.assetId] = result.label;
      }
    })
  );

  return namesMap;
}

/** Refresh cache entries for one source asset (optional specific field). */
export async function refreshReferenceDisplayCacheForAsset(
  supabase: SupabaseClient,
  assetId: string,
  fieldId?: string | null
): Promise<Record<string, string>> {
  const { data: asset, error } = await supabase
    .from('library_assets')
    .select('id, library_id')
    .eq('id', assetId)
    .single();

  if (error || !asset) return {};

  const libraryIdByAsset = new Map([[asset.id, asset.library_id as string]]);
  const fieldTypeById = new Map<string, string>();

  const resolvedFieldId =
    fieldId && fieldId.trim() !== ''
      ? fieldId
      : await getFirstFieldId(supabase, asset.library_id as string);

  if (!resolvedFieldId) return {};

  const { data: fieldDef } = await supabase
    .from('library_field_definitions')
    .select('id, data_type')
    .eq('id', resolvedFieldId)
    .maybeSingle();

  if (fieldDef) {
    fieldTypeById.set(fieldDef.id, fieldDef.data_type ?? 'string');
  }

  const result = await loadDisplayForTarget(
    supabase,
    { assetId, fieldId: fieldId && fieldId.trim() !== '' ? fieldId : null },
    libraryIdByAsset,
    fieldTypeById
  );

  if (!result) return {};

  const patch: Record<string, string> = {
    [result.cacheKey]: result.label,
    [assetId]: result.label,
  };
  if (fieldId && fieldId.trim() !== '') {
    patch[referenceCacheKey(assetId, fieldId)] = result.label;
  }

  return patch;
}
