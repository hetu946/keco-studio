'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from '../Sidebar.module.css';

/**
 * Simulation system entry in the sidebar: quick links into simulation-system routes.
 */
export function SidebarSimulationSystemEntry() {
  const pathname = usePathname();
  const simBase = '/simulation-system';
  const paths = {
    hub: simBase,
    battle: `${simBase}/battle`,
    skills: `${simBase}/battle/skills`,
    studioLibraries: `${simBase}/battle/studio-libraries`,
    localTables: `${simBase}/battle/local-tables`,
  };

  const isActive = (key: 'hub' | 'battle' | 'skills' | 'studioLibraries' | 'localTables') => {
    if (key === 'hub') return pathname === simBase;
    if (key === 'battle') return pathname === paths.battle;
    if (key === 'skills') return pathname.startsWith(paths.skills);
    if (key === 'studioLibraries') return pathname.startsWith(paths.studioLibraries);
    if (key === 'localTables') return pathname.startsWith(paths.localTables);
    return false;
  };

  const linkClass = (key: 'hub' | 'battle' | 'skills' | 'studioLibraries' | 'localTables') =>
    `${styles.item} ${styles.itemInactive}${isActive(key) ? ` ${styles.itemSecondaryActive}` : ''}`;

  return (
    <div className={styles.simulationSystemBlock}>
      <Link
        href={paths.hub}
        className={linkClass('hub')}
        title="Simulation system home"
        style={{ cursor: 'pointer', textDecoration: 'none' }}
      >
        <span className={styles.itemText}>Simulation system</span>
      </Link>
      <Link
        href={paths.battle}
        className={linkClass('battle')}
        title="Battle simulator"
        style={{ cursor: 'pointer', textDecoration: 'none', paddingLeft: '1.75rem', fontSize: '13px' }}
      >
        <span className={styles.itemText}>Battle simulator</span>
      </Link>
      <Link
        href={paths.skills}
        className={linkClass('skills')}
        title="Battle skills (local)"
        style={{ cursor: 'pointer', textDecoration: 'none', paddingLeft: '1.75rem', fontSize: '13px' }}
      >
        <span className={styles.itemText}>Battle skills</span>
      </Link>
      <Link
        href={paths.studioLibraries}
        className={linkClass('studioLibraries')}
        title="Studio project library tables (iframe or local Supabase copy UI)"
        style={{ cursor: 'pointer', textDecoration: 'none', paddingLeft: '1.75rem', fontSize: '13px' }}
      >
        <span className={styles.itemText}>Project tables</span>
      </Link>
      <Link
        href={paths.localTables}
        className={linkClass('localTables')}
        title="Local tables and write-back queue (IndexedDB)"
        style={{ cursor: 'pointer', textDecoration: 'none', paddingLeft: '1.75rem', fontSize: '13px' }}
      >
        <span className={styles.itemText}>Local tables</span>
      </Link>
    </div>
  );
}
