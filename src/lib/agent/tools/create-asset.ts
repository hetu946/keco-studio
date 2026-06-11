/**
 * create_asset — add a new asset to a library (pre_execute confirmation).
 */

import { z } from 'zod';
import { createAsset as createAssetService } from '@/lib/services/libraryAssetsService';
import {
  resolveAgentReferencePropertyValues,
  validateReferencePropertyValues,
} from '../asset-emptiness';
import type { AgentTool, ToolContext, ToolResult } from '../types';
import { resolvePropertyValues } from '../field-resolver';
import { getLibraryProperties, resolveLibraryForTool } from './_shared';

const ParamsSchema = z.object({
  libraryName: z.string().min(1).optional(),
  name: z.string().min(1),
  propertyValues: z.record(z.unknown()).optional(),
});

async function execute(params: unknown, ctx: ToolContext): Promise<ToolResult> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
  }
  const libraryName = parsed.data.libraryName ?? ctx.currentLibraryName;
  const { name, propertyValues } = parsed.data;
  if (!libraryName) {
    return {
      success: false,
      error: 'No library specified. Ask the user which library, or navigate to a library page first.',
    };
  }

  const libraryResult = await resolveLibraryForTool(ctx.supabase, ctx.projectId, libraryName, ctx);
  if (!libraryResult.ok) {
    return { success: false, error: libraryResult.error };
  }
  const library = libraryResult.library;

  const [properties, { resolved, unresolved, availableFields }] = await Promise.all([
    getLibraryProperties(ctx.supabase, library.id),
    resolvePropertyValues(ctx.supabase, library.id, propertyValues),
  ]);
  if (unresolved.length > 0) {
    return {
      success: false,
      error: `Unknown field name(s): ${unresolved.join(', ')}. Available fields: ${availableFields.join(', ') || '(none)'}`,
    };
  }

  let resolvedWithReferences: Record<string, unknown>;
  try {
    resolvedWithReferences = await resolveAgentReferencePropertyValues(
      ctx.supabase,
      properties,
      resolved
    );
  } catch (e) {
    return { success: false, error: (e as Error).message || 'Failed to resolve reference values.' };
  }

  const referenceValidation = await validateReferencePropertyValues(
    ctx.supabase,
    properties,
    resolvedWithReferences
  );
  if (!referenceValidation.ok) {
    return { success: false, error: referenceValidation.error };
  }

  try {
    const assetId = await createAssetService(ctx.supabase, library.id, name, resolvedWithReferences);
    return {
      success: true,
      displayHint: 'text',
      data: { assetId, libraryId: library.id, libraryName: library.name, name },
      invalidateCache: [library.id],
    };
  } catch (e) {
    return { success: false, error: (e as Error).message || 'Failed to create asset.' };
  }
}

export const createAsset: AgentTool = {
  name: 'create_asset',
  description:
    'Add a new asset (row) to a library. Use semantic field names in propertyValues (e.g. {"类型": "character"}). Reference fields cannot target empty assets. libraryName defaults to the user\'s active library from page context when omitted. Params: name (required), libraryName (optional), propertyValues.',
  category: 'write',
  confirmationMode: 'pre_execute',
  requiredPermission: 'editor',
  parameters: {
    type: 'object',
    properties: {
      libraryName: {
        type: 'string',
        description: 'Name of the target library. Omit to use the active library from page context.',
      },
      name: { type: 'string', description: 'Name of the new asset' },
      propertyValues: {
        type: 'object',
        description: 'Field values keyed by semantic field name. Optional.',
        additionalProperties: true,
      },
    },
    required: ['name'],
  },
  execute,
};
