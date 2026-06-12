/**
 * Field name -> fieldId resolution for create_asset / update_asset.
 *
 * The LLM works with semantic field names (e.g. "类型", "标签"). This module maps
 * them to the internal library_field_definitions ids, the same data source as
 * the schema/predefine page.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface FieldResolution {
  /** fieldId -> value, ready for createAsset/updateAsset propertyValues. */
  resolved: Record<string, unknown>;
  /** Semantic field names that could not be matched. */
  unresolved: string[];
  /** All available field labels for the library (for error feedback to the LLM). */
  availableFields: string[];
}

interface FieldDef {
  id: string;
  label: string;
}

async function loadFieldDefs(supabase: SupabaseClient, libraryId: string): Promise<FieldDef[]> {
  const { data, error } = await supabase
    .from('library_field_definitions')
    .select('id, label')
    .eq('library_id', libraryId);
  if (error) {
    throw new Error(`Failed to load field definitions: ${error.message}`);
  }
  return (data ?? []).map((row) => ({ id: row.id as string, label: row.label as string }));
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Translate semantic field-name keyed values into fieldId-keyed values.
 * Matching is exact first, then case-insensitive / trimmed.
 */
export async function resolvePropertyValues(
  supabase: SupabaseClient,
  libraryId: string,
  propertyValues: Record<string, unknown> | undefined
): Promise<FieldResolution> {
  const defs = await loadFieldDefs(supabase, libraryId);
  const availableFields = defs.map((d) => d.label);

  const resolved: Record<string, unknown> = {};
  const unresolved: string[] = [];

  if (!propertyValues || Object.keys(propertyValues).length === 0) {
    return { resolved, unresolved, availableFields };
  }

  const byExact = new Map<string, string>();
  const byNorm = new Map<string, string>();
  for (const def of defs) {
    byExact.set(def.label, def.id);
    byNorm.set(norm(def.label), def.id);
  }

  for (const [name, value] of Object.entries(propertyValues)) {
    // Allow the LLM to pass a fieldId directly (idempotent / advanced use).
    if (defs.some((d) => d.id === name)) {
      resolved[name] = value;
      continue;
    }
    const fieldId = byExact.get(name) ?? byNorm.get(norm(name));
    if (fieldId) {
      resolved[fieldId] = value;
    } else {
      unresolved.push(name);
    }
  }

  return { resolved, unresolved, availableFields };
}
