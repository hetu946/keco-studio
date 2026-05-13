/** Excel 工作表名（导出 / 导入一致） */
export const BATTLE_SKILLS_SHEET_NAME = '技能配表';

/** 表头列顺序（导出 / 导入一致；导入时允许列顺序变化，按表头名匹配） */
export const BATTLE_SKILLS_SHEET_HEADERS = [
  'id',
  '名称',
  '类型',
  '伤害倍率',
  'MP',
  '冷却',
  '描述',
  '附着元素',
  '附着强度',
  '附着回合',
  'DOT倍率',
  'DOT回合',
  '冻结回合',
  '特殊效果',
  '特殊数值',
  '特殊持续',
  '关联反应',
] as const;

export type BattleSkillsSheetHeader = (typeof BATTLE_SKILLS_SHEET_HEADERS)[number];
