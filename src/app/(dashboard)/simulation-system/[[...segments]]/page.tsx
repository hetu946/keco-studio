import { Suspense } from 'react';
import { SimulationSystemEmbed } from '../SimulationSystemEmbed';

export default function SimulationSystemEmbedPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>正在加载模拟器…</div>}>
      <SimulationSystemEmbed />
    </Suspense>
  );
}
