/**
 * query_script_lines — read script lines and branch structure of a library.
 *
 * Reverses the import column mapping: matches library_field_definitions labels
 * against SCRIPT_COLUMNS, then reconstructs a structured line per asset row.
 */

import { z } from 'zod';
import { getLibraryAssets } from '../data-access';
import { SCRIPT_COLUMNS } from '@/lib/script-parser';
import type { AgentTool, ToolContext, ToolResult } from '../types';
import {
  errorFromLookupResult,
  getLibraryProperties,
  libraryFromLookupResult,
  resolveLibraryForTool,
} from './_shared';

const ParamsSchema = z.object({
  libraryName: z.string().min(1).optional(),
});

const col = (name: string) => SCRIPT_COLUMNS.indexOf(name as (typeof SCRIPT_COLUMNS)[number]);

async function execute(params: unknown, ctx: ToolContext): Promise<ToolResult> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
  }
  const libraryName = parsed.data.libraryName ?? ctx.currentLibraryName;
  if (!libraryName) {
    return {
      success: false,
      error: 'No library specified. Ask the user which library, or navigate to a library page first.',
    };
  }

  const libraryResult = await resolveLibraryForTool(ctx.supabase, ctx.projectId, libraryName, ctx);
  const libraryLookupError = errorFromLookupResult(libraryResult);
  if (libraryLookupError !== undefined) {
    return { success: false, error: libraryLookupError };
  }
  const library = libraryFromLookupResult(libraryResult);

  const properties = await getLibraryProperties(ctx.supabase, library.id);

  // Map SCRIPT_COLUMNS label -> fieldId.
  const fieldIdByColumn = new Map<string, string>();
  for (const p of properties) {
    if (SCRIPT_COLUMNS.includes(p.name as (typeof SCRIPT_COLUMNS)[number])) {
      fieldIdByColumn.set(p.name, p.key);
    }
  }

  const missing = SCRIPT_COLUMNS.filter((c) => !fieldIdByColumn.has(c));
  if (missing.length > SCRIPT_COLUMNS.length / 2) {
    return {
      success: false,
      error: `Library "${library.name}" is not a script library (missing columns: ${missing.join(', ')}). Use query_assets for regular libraries.`,
    };
  }

  const get = (values: Record<string, unknown>, columnName: string): string => {
    const fieldId = fieldIdByColumn.get(columnName);
    if (!fieldId) return '';
    const v = values[fieldId];
    return v == null ? '' : String(v);
  };

  const assets = await getLibraryAssets(ctx.supabase, library.id);

  const lines = assets.map((asset) => {
    const values = asset.propertyValues ?? {};
    const options: Array<{ text: string; jump: string }> = [];
    for (const i of [0, 1, 2]) {
      const text = get(values, `Option${i}`);
      const jump = get(values, `Option${i}_Next`);
      if (text || jump) options.push({ text, jump });
    }
    const typeRaw = get(values, 'Type');
    return {
      label: get(values, 'Label'),
      type: typeRaw === '' ? 0 : Number(typeRaw),
      name: get(values, 'Name'),
      content: get(values, 'Content'),
      if: get(values, 'If'),
      commands: get(values, 'Commands'),
      options,
    };
  });

  return {
    success: true,
    displayHint: 'list',
    data: {
      libraryId: library.id,
      libraryName: library.name,
      lineCount: lines.length,
      lines,
    },
  };
}

export const queryScriptLines: AgentTool = {
  name: 'query_script_lines',
  description:
    'Query the script lines and branch structure of a script library. Returns structured lines with label, type, speaker name, content, and options. libraryName defaults to the active library from page context when omitted.',
  category: 'read',
  confirmationMode: 'pre_execute', // unused for read tools
  parameters: {
    type: 'object',
    properties: {
      libraryName: {
        type: 'string',
        description: 'Name of the script library to query. Omit to use the active library from page context.',
      },
    },
    required: [],
  },
  execute,
};
