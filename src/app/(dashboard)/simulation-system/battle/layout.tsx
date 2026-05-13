import type { Metadata } from 'next';
import { BattleLayoutShell } from './components/BattleLayoutShell';

export const metadata: Metadata = {
  title: '战斗模拟 / Battle Simulator - Keco Studio',
  description: 'PVE回合制战斗模拟与难度评估工具',
};

/**
 * 战斗模拟布局
 */
export default function BattleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BattleLayoutShell>{children}</BattleLayoutShell>;
}
