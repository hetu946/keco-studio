/**
 * query_assets — read library assets by name / type / tag.
 */

import { z } from 'zod';
import { getLibraryAssets } from '../data-access';
import type { AgentTool, ToolContext, ToolResult } from '../types';
import { buildFieldLabelMap, findLibraryByName, getLibraryProperties } from './_shared';

const ParamsSchema = z.object({
  libraryName: z.string().min(1).optional(),
  nameFilter: z.string().optional(),
  type: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

const TYPE_FIELD_LABELS = ['类型', 'type', 'Type'];

async function execute(params: unknown, ctx: ToolContext): Promise<ToolResult> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
  }
  const libraryName = parsed.data.libraryName ?? ctx.currentLibraryName;
  const { nameFilter, type, limit } = parsed.data;
  if (!libraryName) {
    return {
      success: false,
      error: 'No library specified. Ask the user which library, or navigate to a library page first.',
    };
  }

  const { library, available } = await findLibraryByName(ctx.supabase, ctx.projectId, libraryName);
  if (!library) {
    return {
      success: false,
      error: `Library "${libraryName}" not found. Available libraries: ${available.join(', ') || '(none)'}`,
    };
  }

  const properties = await getLibraryProperties(ctx.supabase, library.id);
  const labelMap = buildFieldLabelMap(properties);
  const assets = await getLibraryAssets(ctx.supabase, library.id);

  const typeFieldId = properties.find((p) => TYPE_FIELD_LABELS.includes(p.name))?.key;

  let rows = assets.map((asset) => {
    const values: Record<string, unknown> = {};
    for (const [fieldId, value] of Object.entries(asset.propertyValues ?? {})) {
      const label = labelMap[fieldId] ?? fieldId;
      values[label] = value;
    }
    return { id: asset.id, name: asset.name, values };
  });

  if (nameFilter) {
    const needle = nameFilter.trim().toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(needle));
  }
  if (type && typeFieldId) {
    const typeLabel = labelMap[typeFieldId];
    const needle = type.trim().toLowerCase();
    rows = rows.filter((r) => String(r.values[typeLabel] ?? '').toLowerCase().includes(needle));
  }
  if (limit) {
    rows = rows.slice(0, limit);
  }

  return {
    success: true,
    displayHint: 'table',
    data: {
      libraryId: library.id,
      libraryName: library.name,
      columns: properties.map((p) => p.name),
      rowCount: rows.length,
      rows,
    },
  };
}

export const queryAssets: AgentTool = {
  name: 'query_assets',
  description:
    'Query library assets by name, type, or tag. libraryName defaults to the active library from page context when omitted. Params: libraryName (optional), nameFilter, type, limit.',
  category: 'read',
  confirmationMode: 'pre_execute', // unused for read tools
  parameters: {
    type: 'object',
    properties: {
      libraryName: {
        type: 'string',
        description: 'Name of the library to query. Omit to use the active library from page context.',
      },
      nameFilter: { type: 'string', description: 'Optional substring filter on asset name' },
      type: { type: 'string', description: 'Optional value filter on the type field' },
      limit: { type: 'number', description: 'Max rows to return (default all, max 200)' },
    },
    required: [],
  },
  execute,
};
