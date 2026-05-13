import type { Metadata } from 'next';
import { BattleSkillsBreadcrumb } from '../components/BattleSkillsBreadcrumb';

export const metadata: Metadata = {
  title: '战斗技能配表 - Keco Studio',
  description: '编辑战斗模拟器技能数据，保存在本机浏览器',
};

export default function BattleSkillsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BattleSkillsBreadcrumb />
      {children}
    </>
  );
}
