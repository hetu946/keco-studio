/** 与资源页资产编辑类似的防抖间隔（ms）——仅用于单元格编辑 */
export const AUTOSAVE_DEBOUNCE_MS = 1500;

/** 与资源库表格分页习惯一致：每页固定条数 */
export const PAGE_SIZE = 10;

export const TABLE_SCROLL_X = 2212;

export const ATTACH_OPTIONS = [
  { value: '', label: '无' },
  { value: 'random', label: '随机' },
  { value: 'fire', label: '火' },
  { value: 'water', label: '水' },
  { value: 'thunder', label: '雷' },
  { value: 'grass', label: '草' },
  { value: 'ice', label: '冰' },
];

export const STRENGTH_OPTIONS = [
  { value: 'weak', label: '弱' },
  { value: 'medium', label: '中' },
  { value: 'strong', label: '强' },
];

export const SPECIAL_OPTIONS = [
  { value: '', label: '无' },
  { value: 'heal', label: '治疗(系数×ATK)' },
  { value: 'atk_debuff', label: '降攻(比例)' },
  { value: 'def_debuff', label: '降防(比例)' },
];
