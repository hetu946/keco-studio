/**
 * Server-safe data access for agent tools.
 *
 * Several existing services (libraryService, folderService) are marked 'use client'
 * because they use globalRequestCache. API routes must not import them — this
 * module re-implements the small subset of queries the agent needs via direct
 * Supabase calls and authorizationService (withAuthCache bypasses client cache on server).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyLibraryAccess, verifyProjectAccess, verifyFolderAccess } from '@/lib/services/authorizationService';
import type { AssetRow, PropertyConfig } from '@/lib/types/libraryAssets';

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export interface ResolvedLibrary {
  id: string;
  name: string;
}

type FieldDefinitionRow = {
  id: string;
  library_id: string;
  section: string;
  label: string;
  description: string | null;
  data_type: string;
  enum_options: string[] | null;
  reference_libraries: string[] | null;
  formula_expression: string | null;
  order_index: number;
};

function normalizeValue(input: unknown): unknown {
  if (input === null || input === undefined) return null;
  let value = input;
  if (typeof value === 'string' && value.trim() !== '') {
    try {
      value = JSON.parse(value);
    } catch {
      // keep as plain string
    }
  }
  return value;
}

function mapDataTypeToValueType(dataType: string): PropertyConfig['valueType'] {
  switch (dataType) {
    case 'string':
      return 'string';
    case 'int':
    case 'float':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'enum';
    default:
      return 'other';
  }
}

/** List all libraries in a project (no client-side cache). */
export async function listProjectLibraries(
  supabase: SupabaseClient,
  projectId: string
): Promise<Array<{ id: string; name: string }>> {
  await verifyProjectAccess(supabase, projectId);
  const { data, error } = await supabase
    .from('libraries')
    .select('id, name')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id as string, name: row.name as string }));
}

/**
 * Resolve a library by name (or UUID) within a project.
 */
export async function findLibraryByName(
  supabase: SupabaseClient,
  projectId: string,
  libraryName: string
): Promise<{ library: ResolvedLibrary | null; available: string[] }> {
  const all = await listProjectLibraries(supabase, projectId);
  const available = all.map((l) => l.name);

  const exact = all.find((l) => l.name === libraryName);
  if (exact) return { library: exact, available };

  const ci = all.find((l) => l.name.trim().toLowerCase() === libraryName.trim().toLowerCase());
  if (ci) return { library: ci, available };

  if (isUuid(libraryName)) {
    await verifyLibraryAccess(supabase, libraryName);
    const { data, error } = await supabase
      .from('libraries')
      .select('id, name')
      .eq('id', libraryName)
      .eq('project_id', projectId)
      .maybeSingle();
    if (!error && data) {
      return { library: { id: data.id, name: data.name }, available };
    }
  }

  return { library: null, available };
}

/** Load field definitions for a library (server-safe). */
export async function getLibraryProperties(
  supabase: SupabaseClient,
  libraryId: string
): Promise<PropertyConfig[]> {
  await verifyLibraryAccess(supabase, libraryId);

  const { data, error } = await supabase
    .from('library_field_definitions')
    .select('*')
    .eq('library_id', libraryId)
    .order('section', { ascending: true })
    .order('order_index', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as FieldDefinitionRow[];
  const properties: PropertyConfig[] = [];

  for (let row of rows) {
    if (row.data_type === 'media') {
      row = { ...row, data_type: 'image' };
    }
    const sectionId = `${row.library_id}:${row.section}`;
    properties.push({
      id: row.id,
      sectionId,
      key: row.id,
      name: row.label,
      description: row.description,
      valueType: mapDataTypeToValueType(row.data_type),
      dataType: row.data_type as PropertyConfig['dataType'],
      referenceLibraries: row.reference_libraries || undefined,
      enumOptions: row.enum_options || undefined,
      formulaExpression: row.formula_expression || undefined,
      orderIndex: row.order_index,
    });
  }

  properties.sort((a, b) => a.orderIndex - b.orderIndex);
  return properties;
}

/** Load assets with property values for a library (server-safe). */
export async function getLibraryAssets(
  supabase: SupabaseClient,
  libraryId: string
): Promise<AssetRow[]> {
  await verifyLibraryAccess(supabase, libraryId);

  const { data: assetData, error: assetError } = await supabase
    .from('library_assets')
    .select('id, library_id, name, created_at, row_index')
    .eq('library_id', libraryId)
    .order('row_index', { ascending: true })
    .order('id', { ascending: true });
  if (assetError) throw assetError;

  const assets = assetData ?? [];
  if (assets.length === 0) return [];

  const assetIds = assets.map((a) => a.id);
  const { data: valueData, error: valueError } = await supabase
    .from('library_asset_values')
    .select('asset_id, field_id, value_json')
    .in('asset_id', assetIds);
  if (valueError) throw valueError;

  const rowsByAssetId = new Map<string, AssetRow>();
  for (const asset of assets) {
    rowsByAssetId.set(asset.id, {
      id: asset.id,
      libraryId: asset.library_id,
      name: asset.name,
      propertyValues: {},
      created_at: asset.created_at,
      rowIndex: asset.row_index ?? undefined,
    });
  }

  for (const value of valueData ?? []) {
    const row = rowsByAssetId.get(value.asset_id);
    if (!row) continue;
    row.propertyValues[value.field_id] = normalizeValue(value.value_json);
  }

  return Array.from(rowsByAssetId.values());
}

/** Load a folder row (server-safe). */
export async function getFolderRow(
  supabase: SupabaseClient,
  folderId: string
): Promise<{ id: string; project_id: string; name: string } | null> {
  if (!isUuid(folderId)) {
    throw new Error('Invalid folder ID format');
  }
  await verifyFolderAccess(supabase, folderId);

  const { data, error } = await supabase
    .from('folders')
    .select('id, project_id, name')
    .eq('id', folderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function buildFieldLabelMap(properties: PropertyConfig[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of properties) {
    map[p.key] = p.name;
  }
  return map;
}
