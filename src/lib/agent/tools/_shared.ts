/**
 * Re-exports server-safe data access helpers for tool handlers.
 * @see ../data-access.ts
 */

import {
  findLibraryByName,
  getLibraryProperties,
  buildFieldLabelMap,
  type ResolvedLibrary,
  type LibraryResolveOptions,
} from '../data-access';

export {
  findLibraryByName,
  getLibraryProperties,
  buildFieldLabelMap,
  type ResolvedLibrary,
  type LibraryResolveOptions,
};

export function libraryResolveOptionsFromContext(ctx: {
  currentLibraryId?: string;
  currentFolderId?: string;
}): import('../data-access').LibraryResolveOptions {
  return {
    preferredLibraryId: ctx.currentLibraryId,
    preferredFolderId: ctx.currentFolderId,
  };
}

export function formatAmbiguousLibraryError(
  libraryName: string,
  matches: Array<{ id: string; name: string }>
): string {
  const ids = matches.map((m) => m.id).join(', ');
  return `Multiple libraries named "${libraryName}" exist in this project. Open the target library in the UI or pass its UUID. Matching ids: ${ids}`;
}

type LibraryLookupResult =
  | { ok: true; library: import('../data-access').ResolvedLibrary }
  | { ok: false; error: string };

export async function resolveLibraryForTool(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  projectId: string,
  libraryName: string,
  ctx: { currentLibraryId?: string; currentFolderId?: string }
): Promise<LibraryLookupResult> {
  const { library, available, ambiguousMatches } = await findLibraryByName(
    supabase,
    projectId,
    libraryName,
    libraryResolveOptionsFromContext(ctx)
  );
  if (ambiguousMatches && ambiguousMatches.length > 1) {
    return { ok: false, error: formatAmbiguousLibraryError(libraryName, ambiguousMatches) };
  }
  if (!library) {
    return {
      ok: false,
      error: `Library "${libraryName}" not found. Available libraries: ${available.join(', ') || '(none)'}`,
    };
  }
  return { ok: true, library };
}
