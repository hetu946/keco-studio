/**
 * Client-visible flags for embedding the standalone simulation app (keco-simulation).
 * Both must be set at build/dev-server start for the sidebar + iframe routes to activate.
 */
export function isSimulationEmbedConfigured(): boolean {
  return (
    process.env.NEXT_PUBLIC_SIMULATION_ENABLED === 'true' &&
    Boolean(process.env.NEXT_PUBLIC_SIMULATION_ORIGIN?.trim())
  );
}

export function getSimulationOrigin(): string {
  return (process.env.NEXT_PUBLIC_SIMULATION_ORIGIN ?? '').replace(/\/$/, '');
}

/** When embed is on, warm the simulation origin unless explicitly disabled. */
export function isSimulationWarmupEnabled(): boolean {
  if (!isSimulationEmbedConfigured()) return false;
  return process.env.NEXT_PUBLIC_SIMULATION_WARMUP !== 'false';
}

/**
 * True when the configured simulation origin resolves to the same origin as the
 * current page. Embedding the simulation app from Studio's own origin makes the
 * iframe load Studio inside itself recursively, which hangs the browser.
 * Returns false during SSR (no window) so callers must re-check after mount.
 */
export function isSimulationOriginSameAsCurrent(): boolean {
  if (typeof window === 'undefined') return false;
  const origin = getSimulationOrigin();
  if (!origin) return false;
  try {
    return new URL(origin, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}
