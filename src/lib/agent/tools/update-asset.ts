/**
 * update_asset — modify an asset's fields (pre_execute confirmation).
 */

import { z } from 'zod';
import { updateAsset as updateAssetService } from '@/lib/services/libraryAssetsService';
import type { AgentTool, ToolContext, ToolResult } from '../types';
import { resolvePropertyValues } from '../field-resolver';
import { findLibraryByName } from './_shared';

const ParamsSchema = z.object({
  libraryName: z.string().min(1).optional(),
  assetId: z.string().min(1),
  name: z.string().optional(),
  propertyValues: z.record(z.unknown()).optional(),
});

async function execute(params: unknown, ctx: ToolContext): Promise<ToolResult> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
  }
  const libraryName = parsed.data.libraryName ?? ctx.currentLibraryName;
  const { assetId, name, propertyValues } = parsed.data;
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

  // Load the existing asset to preserve its name when not changing it, and to
  // validate the asset actually belongs to the resolved library.
  const { data: assetRow, error: assetErr } = await ctx.supabase
    .from('library_assets')
    .select('id, name, library_id')
    .eq('id', assetId)
    .single();
  if (assetErr || !assetRow) {
    return { success: false, error: `Asset "${assetId}" not found.` };
  }
  if (assetRow.library_id !== library.id) {
    return { success: false, error: `Asset "${assetId}" does not belong to library "${library.name}".` };
  }

  const { resolved, unresolved, availableFields } = await resolvePropertyValues(
    ctx.supabase,
    library.id,
    propertyValues
  );
  if (unresolved.length > 0) {
    return {
      success: false,
      error: `Unknown field name(s): ${unresolved.join(', ')}. Available fields: ${availableFields.join(', ') || '(none)'}`,
    };
  }

  try {
    await updateAssetService(ctx.supabase, assetId, name ?? assetRow.name, resolved);
    return {
      success: true,
      displayHint: 'text',
      data: { assetId, libraryId: library.id, libraryName: library.name, name: name ?? assetRow.name },
      invalidateCache: [library.id],
    };
  } catch (e) {
    return { success: false, error: (e as Error).message || 'Failed to update asset.' };
  }
}

export const updateAsset: AgentTool = {
  name: 'update_asset',
  description:
    'Modify fields of an existing asset. Use semantic field names in propertyValues. libraryName defaults to the active library from page context when omitted. Params: assetId (required), libraryName (optional), name (optional), propertyValues.',
  category: 'write',
  confirmationMode: 'pre_execute',
  requiredPermission: 'editor',
  parameters: {
    type: 'object',
    properties: {
      libraryName: {
        type: 'string',
        description: 'Name of the library the asset belongs to. Omit to use the active library from page context.',
      },
      assetId: { type: 'string', description: 'UUID of the asset to update' },
      name: { type: 'string', description: 'New asset name (optional)' },
      propertyValues: {
        type: 'object',
        description: 'Field values to set, keyed by semantic field name. Optional.',
        additionalProperties: true,
      },
    },
    required: ['assetId'],
  },
  execute,
};
