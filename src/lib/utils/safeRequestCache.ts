/**
 * Client-only request cache helpers safe to call from API routes and services.
 * useRequestCache is a 'use client' module — on the server the import may be
 * incomplete, so we no-op instead of throwing.
 */

export async function invalidateRequestCache(key?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { globalRequestCache } = await import('@/lib/hooks/useRequestCache');
    if (typeof globalRequestCache?.invalidate === 'function') {
      globalRequestCache.invalidate(key);
    }
  } catch {
    // best-effort client cache bust
  }
}
