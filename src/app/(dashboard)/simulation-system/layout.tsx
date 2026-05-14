import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Simulation System - Keco Studio',
  description: 'Economy and battle simulation (embedded when enabled)',
};

export default function SimulationSystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
