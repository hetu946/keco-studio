/**
 * 将「经济模拟」中的静态数据导出为单个多 Sheet 的 .xlsx（不含战斗模拟）。
 *
 * 数据源：
 * - `economy/data/*.ts` 数据表
 * - `economy/types/index.ts` UI/展示常量（STAT_CONFIG、品质/阵营/稀有度等）
 * - `economy/calculator/page.tsx` 内联的段位经验倍率（与 playerLevel 公式不同，单独成表）
 * - `simulation-system/page.tsx`、`economy/overview/page.tsx` 中的经济模块路由文案（脚本内同步）
 *
 * 运行：npm run export:simulation-xlsx
 * 输出：`exports/economy-simulation-data.xlsx`
 *
 * 战斗模拟静态表见：`npm run export:battle-simulation-xlsx` → `exports/battle-simulation-data.xlsx`
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

import {
  CHARACTERS,
  TALENTS,
  SKILLS as ECONOMY_SKILLS,
  CAMPS,
  RARITIES,
} from '../src/app/(dashboard)/simulation-system/economy/data/characters';
import {
  STAT_CONFIG,
  QUALITY_COLORS,
  CAMP_COLORS,
  RARITY_CONFIG,
} from '../src/app/(dashboard)/simulation-system/economy/types';
import {
  EQUIPMENTS,
  EQUIPMENT_SLOT_NAMES,
  EQUIPMENT_SERIES,
} from '../src/app/(dashboard)/simulation-system/economy/data/equipment';
import { ARENA_RANK_DATA, ARENA_CONFIG } from '../src/app/(dashboard)/simulation-system/economy/data/arena';
import {
  LEVELS,
  LEVEL_TYPE_CONFIG,
  STAMINA_CONFIG,
} from '../src/app/(dashboard)/simulation-system/economy/data/levels';
import { PRESTIGE_LEVELS, PRESTIGE_TIERS } from '../src/app/(dashboard)/simulation-system/economy/data/prestige';
import {
  PLAYER_LEVELS,
  EXP_CURVE_STAGES,
  LEVEL_TIERS,
  EXP_CURVE_STATS,
} from '../src/app/(dashboard)/simulation-system/economy/data/playerLevel';

type SheetRow = Record<string, string | number | boolean>;

function cellValue(v: unknown): string | number | boolean {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/** 将嵌套对象展平为单列名（便于 Excel 查看） */
function flattenForSheet(obj: Record<string, unknown>, prefix = ''): SheetRow {
  const out: SheetRow = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') {
      if (Array.isArray(v)) {
        out[key] = JSON.stringify(v);
      } else {
        Object.assign(out, flattenForSheet(v as Record<string, unknown>, key));
      }
    } else {
      out[key] = cellValue(v) as string | number | boolean;
    }
  }
  return out;
}

function rowsFromObjects(arr: object[]): SheetRow[] {
  return arr.map((item) => flattenForSheet(item as Record<string, unknown>));
}

function rowsFromRecord(record: Record<string, unknown>): SheetRow[] {
  return Object.entries(record).map(([id, value]) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return { id, ...flattenForSheet(value as Record<string, unknown>) };
    }
    return { id, value: cellValue(value) };
  });
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
  return cleaned || 'Sheet';
}

function appendSheet(wb: XLSX.WorkBook, rows: SheetRow[], sheetName: string): void {
  if (rows.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ _note: '（无数据）' }]);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
}

/**
 * 与 `economy/calculator/page.tsx` 内 calculateDailyTotal 的 tierMultipliers 一致
 *（与 `playerLevel.ts` 里 calcDailyExp 的倍率可能不同，单独成表便于对照）
 */
const CALCULATOR_PAGE_EXP_TIER_MULTIPLIERS: SheetRow[] = [
  { tier: 'beginner', multiplier: 1.0 },
  { tier: 'growth', multiplier: 1.3 },
  { tier: 'mid', multiplier: 1.5 },
  { tier: 'late', multiplier: 1.8 },
  { tier: 'end', multiplier: 2.0 },
  { tier: 'apex', multiplier: 2.5 },
];

/** 与 `simulation-system/page.tsx` 模块列表一致（无 React icon） */
const UI_MAIN_ECONOMY_MODULES: SheetRow[] = [
  {
    id: 'characters',
    name: '角色养成',
    nameEn: 'Characters',
    path: '/simulation-system/economy/characters',
    description: '武将培养、属性成长，天赋系统',
    color: '#1890ff',
  },
  {
    id: 'equipment',
    name: '装备系统 / Equipment',
    nameEn: 'Equipment',
    path: '/simulation-system/economy/equipment',
    description: '装备强化、打造、品阶属性',
    color: '#fa8c16',
  },
  {
    id: 'arena',
    name: '竞技场 / Arena',
    nameEn: 'Arena',
    path: '/simulation-system/economy/arena',
    description: '竞技场对战、排名奖励、声望计算',
    color: '#f5222d',
  },
  {
    id: 'levels',
    name: '关卡系统 / Levels',
    nameEn: 'Levels',
    path: '/simulation-system/economy/levels',
    description: '关卡消耗与收益计算',
    color: '#52c41a',
  },
  {
    id: 'prestige',
    name: '忍阶声望 / Prestige',
    nameEn: 'Prestige',
    path: '/simulation-system/economy/prestige',
    description: '忍阶晋升、声望积累、每日收益',
    color: '#eb2f96',
  },
  {
    id: 'calculator',
    name: '综合计算器 / Calculator',
    nameEn: 'Calculator',
    path: '/simulation-system/economy/calculator',
    description: '综合收益与成长路线规划',
    color: '#13c2c2',
  },
];

/** 与 `economy/overview/page.tsx` 中 MODULES 一致 */
const UI_ECONOMY_OVERVIEW_MODULES: SheetRow[] = [
  {
    id: 'characters',
    name: '角色养成',
    nameEn: 'Characters',
    path: '/simulation-system/economy/characters',
    description: '武将培养、属性成长，天赋系统',
    color: '#1890ff',
  },
  {
    id: 'equipment',
    name: '装备系统',
    nameEn: 'Equipment',
    path: '/simulation-system/economy/equipment',
    description: '装备强化、打造、品阶属性',
    color: '#fa8c16',
  },
  {
    id: 'arena',
    name: '竞技场',
    nameEn: 'Arena',
    path: '/simulation-system/economy/arena',
    description: '竞技场对战、排名奖励、声望计算',
    color: '#f5222d',
  },
  {
    id: 'levels',
    name: '关卡系统',
    nameEn: 'Levels',
    path: '/simulation-system/economy/levels',
    description: '关卡消耗与收益计算',
    color: '#52c41a',
  },
  {
    id: 'prestige',
    name: '忍阶声望',
    nameEn: 'Prestige',
    path: '/simulation-system/economy/prestige',
    description: '忍阶晋升、声望积累、每日收益',
    color: '#eb2f96',
  },
  {
    id: 'calculator',
    name: '综合计算器',
    nameEn: 'Calculator',
    path: '/simulation-system/economy/calculator',
    description: '综合收益与成长路线规划',
    color: '#13c2c2',
  },
];

const outDir = path.join(process.cwd(), 'exports');
const outFile = path.join(outDir, 'economy-simulation-data.xlsx');

const wb = XLSX.utils.book_new();

appendSheet(wb, rowsFromObjects(CHARACTERS as object[]), 'econ_characters');
appendSheet(wb, rowsFromObjects(TALENTS as object[]), 'econ_talents');
appendSheet(wb, rowsFromObjects(ECONOMY_SKILLS as object[]), 'econ_skills');
appendSheet(wb, CAMPS.map((c) => ({ camp: c })), 'econ_camps');
appendSheet(wb, RARITIES.map((r) => ({ rarity: r })), 'econ_rarities');
appendSheet(wb, rowsFromRecord(STAT_CONFIG as unknown as Record<string, unknown>), 'econ_stat_config');
appendSheet(
  wb,
  Object.entries(QUALITY_COLORS).map(([quality, color]) => ({
    quality: Number(quality),
    color,
  })),
  'econ_quality_colors'
);
appendSheet(wb, rowsFromRecord(CAMP_COLORS as unknown as Record<string, unknown>), 'econ_camp_colors');
appendSheet(wb, rowsFromRecord(RARITY_CONFIG as unknown as Record<string, unknown>), 'econ_rarity_config');
appendSheet(wb, CALCULATOR_PAGE_EXP_TIER_MULTIPLIERS, 'econ_calc_page_exp_mult');
appendSheet(wb, rowsFromObjects(EQUIPMENTS as object[]), 'econ_equipments');
appendSheet(
  wb,
  Object.entries(EQUIPMENT_SLOT_NAMES).map(([slot, name]) => ({
    slot: Number(slot),
    name: String(name),
  })),
  'econ_equipment_slots'
);
appendSheet(
  wb,
  EQUIPMENT_SERIES.map((name, index) => ({ index, name })),
  'econ_equipment_series'
);
appendSheet(wb, rowsFromObjects(ARENA_RANK_DATA as object[]), 'econ_arena_ranks');
appendSheet(wb, [flattenForSheet({ ...ARENA_CONFIG } as Record<string, unknown>)], 'econ_arena_config');
appendSheet(wb, rowsFromObjects(LEVELS as object[]), 'econ_levels');
appendSheet(
  wb,
  Object.entries(LEVEL_TYPE_CONFIG).map(([levelType, cfg]) => ({
    levelType,
    ...(cfg as Record<string, unknown>),
  })) as SheetRow[],
  'econ_level_types'
);
appendSheet(wb, [flattenForSheet({ ...STAMINA_CONFIG } as Record<string, unknown>)], 'econ_stamina');
appendSheet(wb, rowsFromObjects(PRESTIGE_LEVELS as object[]), 'econ_prestige_levels');
appendSheet(
  wb,
  Object.entries(PRESTIGE_TIERS).map(([tierKey, cfg]) => ({
    tierKey,
    ...(cfg as Record<string, unknown>),
  })) as SheetRow[],
  'econ_prestige_tiers'
);
appendSheet(wb, rowsFromObjects(PLAYER_LEVELS as object[]), 'econ_player_levels');
appendSheet(
  wb,
  Object.entries(EXP_CURVE_STAGES).map(([stageKey, cfg]) => ({
    stageKey,
    ...(cfg as Record<string, unknown>),
  })) as SheetRow[],
  'econ_exp_curve_stages'
);
appendSheet(
  wb,
  Object.entries(LEVEL_TIERS).map(([tierKey, cfg]) => ({
    tierKey,
    ...(cfg as Record<string, unknown>),
  })) as SheetRow[],
  'econ_level_tiers'
);
appendSheet(wb, [{ totalExpToMax: EXP_CURVE_STATS.totalExpToMax }], 'econ_exp_stats_summary');
appendSheet(
  wb,
  Object.entries(EXP_CURVE_STATS.tierExpRatio).map(([tier, v]) => ({
    tier,
    levels: v.levels,
    totalExp: v.totalExp,
    ratio: v.ratio,
  })),
  'econ_exp_stats_by_tier'
);

appendSheet(wb, UI_MAIN_ECONOMY_MODULES, 'ui_main_economy_modules');
appendSheet(wb, UI_ECONOMY_OVERVIEW_MODULES, 'ui_economy_overview_mods');

fs.mkdirSync(outDir, { recursive: true });
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(outFile, buf);

// eslint-disable-next-line no-console -- CLI script
console.log(`已写入: ${outFile}`);
