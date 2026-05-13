'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '../Sidebar.module.css';

/**
 * 模拟系统入口 - Sidebar Entry
 * 在侧边栏提供快速访问模拟系统工具的入口
 */
export function SidebarSimulationSystemEntry() {
  const pathname = usePathname();
  const simBase = '/simulation-system';
  const paths = {
    hub: simBase,
    battle: `${simBase}/battle`,
    skills: `${simBase}/battle/skills`,
  };

  const isActive = (key: 'hub' | 'battle' | 'skills') => {
    if (key === 'hub') return pathname === simBase;
    if (key === 'battle') return pathname === paths.battle;
    if (key === 'skills') return pathname.startsWith(paths.skills);
    return false;
  };

  const linkClass = (key: 'hub' | 'battle' | 'skills') =>
    `${styles.item} ${styles.itemInactive}${isActive(key) ? ` ${styles.itemSecondaryActive}` : ''}`;

  return (
    <div className={styles.simulationSystemBlock}>
      <Link
        href={paths.hub}
        className={linkClass('hub')}
        title="模拟系统首页"
        style={{ cursor: 'pointer', textDecoration: 'none' }}
      >
        <span style={{ fontSize: '18px', marginRight: '8px' }}>🎮</span>
        <span className={styles.itemText}>模拟系统</span>
      </Link>
      <Link
        href={paths.battle}
        className={linkClass('battle')}
        title="战斗模拟"
        style={{ cursor: 'pointer', textDecoration: 'none', paddingLeft: '1.75rem', fontSize: '13px' }}
      >
        <span className={styles.itemText}>战斗模拟</span>
      </Link>
      <Link
        href={paths.skills}
        className={linkClass('skills')}
        title="技能配表（本机）"
        style={{ cursor: 'pointer', textDecoration: 'none', paddingLeft: '1.75rem', fontSize: '13px' }}
      >
        <span className={styles.itemText}>技能配表</span>
      </Link>
    </div>
  );
}
