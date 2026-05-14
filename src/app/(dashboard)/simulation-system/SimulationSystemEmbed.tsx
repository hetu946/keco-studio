'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getSimulationOrigin, isSimulationEmbedConfigured } from '@/lib/simulationClientConfig';
import styles from './SimulationSystemEmbed.module.css';

export function SimulationSystemEmbed() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const configured = isSimulationEmbedConfigured();
  const origin = getSimulationOrigin();

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

  return (
    <div className={styles.wrap}>
      <iframe className={styles.frame} title="Simulation system" src={src} />
    </div>
  );
}
