'use client';

import { usePathname } from 'next/navigation';
import { BattleBreadcrumb } from './BattleBreadcrumb';

/**
 * 战斗区布局外壳：技能配表子路由使用独立面包屑，不重复显示「战斗模拟」单层屑
 */
export function BattleLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideBattleCrumb = pathname.startsWith('/simulation-system/battle/skills');

  return (
    <>
      {!hideBattleCrumb && <BattleBreadcrumb />}
      {children}
    </>
  );
}
