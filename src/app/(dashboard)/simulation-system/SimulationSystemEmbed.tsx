'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  getSimulationOrigin,
  isSimulationEmbedConfigured,
  isSimulationOriginSameAsCurrent,
} from '@/lib/simulationClientConfig';
import styles from './SimulationSystemEmbed.module.css';

export function SimulationSystemEmbed() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const configured = isSimulationEmbedConfigured();
  const origin = getSimulationOrigin();

  // The same-origin check needs `window`, so resolve it after mount to avoid a
  // hydration mismatch (SSR renders the iframe path; client may swap to fallback).
  const [selfEmbed, setSelfEmbed] = useState(false);
  useEffect(() => {
    setSelfEmbed(isSimulationOriginSameAsCurrent());
  }, []);

  const src = useMemo(() => {
    if (!configured || !origin) return '';
    const qs = searchParams.toString();
    const suffix = qs ? `?${qs}` : '';
    return `${origin}${pathname}${suffix}`;
  }, [configured, origin, pathname, searchParams]);

  if (!configured || !origin) {
    return (
      <div className={styles.fallback}>
        <p>未启用模拟器嵌入。若要在本机联动（Keco :3000 + keco-simulation :3001），请在 <code>.env.local</code> 中配置：</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>
          {`NEXT_PUBLIC_SIMULATION_ENABLED=true
NEXT_PUBLIC_SIMULATION_ORIGIN=http://localhost:3001`}
        </pre>
        <p>保存后重启 <code>next dev</code>，并在 sibling 目录启动 <code>keco-simulation</code>（默认端口 3001）。</p>
      </div>
    );
  }

  // Guard against recursive self-embedding: if the simulation origin is the same
  // as Studio's own origin, the iframe would load this very page again and again,
  // freezing the browser. Refuse to render the iframe and explain the misconfig.
  if (selfEmbed) {
    return (
      <div className={styles.fallback}>
        <p>
          检测到 <code>NEXT_PUBLIC_SIMULATION_ORIGIN</code> 与当前 Keco Studio 的域名相同（
          <code>{origin}</code>）。这会让模拟器 iframe 反复加载 Studio 自身，导致页面卡死，因此已停止嵌入。
        </p>
        <p>
          请将 <code>NEXT_PUBLIC_SIMULATION_ORIGIN</code> 指向独立运行的 keco-simulation（本机默认
          <code> http://localhost:3001</code>），保存后重启 <code>next dev</code>。
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <iframe className={styles.frame} title="Simulation system" src={src} />
    </div>
  );
}
