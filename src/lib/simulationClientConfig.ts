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
