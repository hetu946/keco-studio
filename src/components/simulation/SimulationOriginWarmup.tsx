'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  getSimulationOrigin,
  isSimulationEmbedConfigured,
  isSimulationOriginSameAsCurrent,
  isSimulationWarmupEnabled,
} from '@/lib/simulationClientConfig';

const PRECONNECT_ID = 'keco-simulation-preconnect';

/**
 * After the dashboard shell is shown, preconnect + load a hidden iframe to the simulation
 * hub so the first real navigation feels faster (especially Next dev compile on :3001).
 */
export function SimulationOriginWarmup() {
  const pathname = usePathname();
  const [warmSrc, setWarmSrc] = useState<string | null>(null);

  // Skip warmup while the real embed is already on screen: the visible iframe in
  // `SimulationSystemEmbed` loads the same app, so a second hidden instance would
  // just double the work (extra Supabase client + React Query + dev compile).
  const onSimulationRoute = pathname?.startsWith('/simulation-system') ?? false;

  useEffect(() => {
    if (onSimulationRoute) {
      setWarmSrc(null);
      return;
    }
    if (!isSimulationWarmupEnabled() || !isSimulationEmbedConfigured()) {
      return;
    }
    // Never warm Studio's own origin: that would recursively load this app.
    if (isSimulationOriginSameAsCurrent()) {
      return;
    }
    const origin = getSimulationOrigin();
    if (!origin) {
      return;
    }

    if (typeof document !== 'undefined' && !document.getElementById(PRECONNECT_ID)) {
      const link = document.createElement('link');
      link.id = PRECONNECT_ID;
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }

    let cancelled = false;
    const startWarm = () => {
      if (!cancelled) {
        setWarmSrc(`${origin}/simulation-system`);
      }
    };

    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(startWarm, { timeout: 5000 });
    } else {
      timeoutHandle = window.setTimeout(startWarm, 2000);
    }

    return () => {
      cancelled = true;
      if (idleHandle != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle);
      }
      const link = typeof document !== 'undefined' ? document.getElementById(PRECONNECT_ID) : null;
      link?.parentNode?.removeChild(link);
    };
  }, [onSimulationRoute]);

  if (!warmSrc) {
    return null;
  }

  return (
    <iframe
      aria-hidden
      tabIndex={-1}
      title=""
      src={warmSrc}
      style={{
        position: 'fixed',
        right: 0,
        bottom: 0,
        width: '1px',
        height: '1px',
        margin: 0,
        padding: 0,
        border: 0,
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
