/**
 * 将「战斗模拟」中的静态配置导出为单个多 Sheet 的 .xlsx。
 *
 * 数据源：
 * - `battle/types/index.ts`：元素、反应、默认属性、MP 规则等
 * - `battle/data/skills.ts`：技能表
 * - `battle/core/battleLogic.ts`：伤害公式、元素反应配对、回合流程（公式说明与代码同源）
 * - `simulation-system/page.tsx` 中的战斗模块入口文案（脚本内同步）
 *
 * 运行：npm run export:battle-simulation-xlsx
 * 输出：`exports/battle-simulation-data.xlsx`
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

import {
  ELEMENT_CONFIG,
  ELEMENT_STRENGTH_CONFIG,
  REACTION_CONFIG,
  DEFAULT_PLAYER_STATS,
  DEFAULT_MONSTER_STATS,
  MP_CONFIG,
} from '../src/app/(dashboard)/simulation-system/battle/types';
import { SKILLS } from '../src/app/(dashboard)/simulation-system/battle/data/skills';
import { ELEMENT_REACTION_PAIR_MAP } from '../src/app/(dashboard)/simulation-system/battle/core/battleLogic';
import type { Element, ReactionType } from '../src/app/(dashboard)/simulation-system/battle/types';

type SheetRow = Record<string, string | number | boolean>;

function cellValue(v: unknown): string | number | boolean {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

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

/** 与 `battleLogic.ts` 中 `calculateDamage` 一致 */
const BATTLE_RULES_FORMULAS: SheetRow[] = [
  {
    id: 'dmg_core',
    category: '伤害',
    name: '技能最终伤害（主公式）',
    formula:
      'ceil( ATK * power * (ATK / (ATK + DEF)) * reactionMultiplier * extraMultiplier )',
    codeRef: 'battleLogic.ts → calculateDamage',
    notes:
      'ATK/DEF 为攻击方/受击方当前值；power 为技能倍率；全部乘法后向上取整。',
  },
  {
    id: 'dmg_def_ratio',
    category: '伤害',
    name: '防御折算系数',
    formula: 'ATK / (ATK + DEF)',
    codeRef: 'battleLogic.ts → calculateDamage 内 defenseReduction',
    notes: '与 (ATK * power) 相乘，等价于常见「攻击越高穿甲收益」形态。',
  },
  {
    id: 'rxn_mult',
    category: '元素反应',
    name: '增幅类倍率 reactionMultiplier',
    formula: '来自 REACTION_CONFIG[reaction].multiplier；无则 1',
    codeRef: 'battleLogic.ts → executeSkill',
    notes: '如蒸发/融化等使用配置表 multiplier。',
  },
  {
    id: 'rxn_quicken_extra',
    category: '元素反应',
    name: '激化额外乘区 extraMultiplier',
    formula: '目标带 quicken buff 且技能附着为雷/草：1 + buff.value；否则 1',
    codeRef: 'battleLogic.ts → executeSkill',
    notes: '与 reactionMultiplier 同时传入 calculateDamage。',
  },
  {
    id: 'rxn_pair_lookup',
    category: '元素反应',
    name: '反应类型判定',
    formula: 'attackElement × defender.currentElement → ReactionType | null',
    codeRef: 'battleLogic.ts → ELEMENT_REACTION_PAIR_MAP / checkElementReaction',
    notes: '仅当技能有非 random 的 attachElement 且目标身上有元素附着时参与判定；详见 battle_reaction_pairs 表。',
  },
  {
    id: 'rxn_config_extraDamage',
    category: '元素反应',
    name: 'REACTION_CONFIG.extraDamage（剧变系数）',
    formula: '配置表为「× ATK」的系数；源码中另有分支计算 ceil(ATK*extraDamage)',
    codeRef: 'battleLogic.ts → executeSkill（与 calculateDamage 联立）',
    notes:
      '请以当前 battleLogic 源码为准做数值验算；导出表 battle_reactions 含各反应 multiplier/extraDamage 配置。',
  },
  {
    id: 'heal_skill',
    category: '治疗',
    name: '治疗类 specialEffect.heal',
    formula: 'ceil( attacker.ATK * specialEffect.value )，HP 不超过 maxHp',
    codeRef: 'battleLogic.ts → executeSkill',
    notes: '在伤害段之前处理。',
  },
  {
    id: 'dot_turn_end',
    category: 'DOT',
    name: '灼烧每回合伤害',
    formula: 'ceil( 当前单位.ATK * dot.damage )，扣 HP；回合数减 1',
    codeRef: 'battleLogic.ts → processTurnEnd',
    notes: '在受击方自己回合结束时结算自身 dot。',
  },
  {
    id: 'mp_skill',
    category: 'MP',
    name: '技能 MP 消耗',
    formula: '施放时 attacker.mp -= skill.mpCost',
    codeRef: 'battleLogic.ts → executeSkill',
    notes: '',
  },
  {
    id: 'mp_turn_regen',
    category: 'MP',
    name: '回合结束 MP 回复',
    formula: 'unit.mp = min(maxMp, unit.mp + MP_CONFIG.mpPerTurn)',
    codeRef: 'battleLogic.ts → processTurnEnd',
    notes: '每单位回合结束各结算一次。',
  },
  {
    id: 'elem_attach_duration',
    category: '元素附着',
    name: '附着持续',
    formula: '技能指定 duration；回合结束 remainingTurns -= 1，至 0 清除',
    codeRef: 'battleLogic.ts → executeSkill / processTurnEnd',
    notes: '',
  },
  {
    id: 'freeze_control',
    category: '控制',
    name: '冻结跳过行动',
    formula: 'processTurnStart：若 control.type===freeze 则本回合不行动',
    codeRef: 'battleLogic.ts → processTurnStart',
    notes: '回合结束 remainingTurns 递减见 processTurnEnd。',
  },
  {
    id: 'skill_cd',
    category: '冷却',
    name: '技能冷却',
    formula: '施放后若 maxCooldown>0 则 cooldowns[skillId]=maxCooldown；每回合结束 cd>0 则 -1',
    codeRef: 'battleLogic.ts → setSkillCooldown / reduceCooldowns',
    notes: '',
  },
  {
    id: 'battle_result',
    category: '胜负',
    name: '结束判定',
    formula: '双方 HP 与 0 比较 → player_win / monster_win / draw',
    codeRef: 'battleLogic.ts → checkBattleResult',
    notes: '',
  },
];

const BATTLE_FLOW_EXECUTE_SKILL: SheetRow[] = [
  { step: 1, phase: 'executeSkill', action: '扣除 MP', detail: 'skill.mpCost；若>0 写 mp_cost 日志' },
  { step: 2, phase: 'executeSkill', action: '治疗分支', detail: 'specialEffect.type===heal 时按 ATK×value 回血' },
  {
    step: 3,
    phase: 'executeSkill',
    action: '伤害分支',
    detail:
      'power>0：元素反应判定 → calculateDamage 得 totalDamage → 扣 defender.hp → damage / element_reaction 日志',
  },
  { step: 4, phase: 'executeSkill', action: '附加元素', detail: 'attachElement：random 则随机元素，否则指定' },
  { step: 5, phase: 'executeSkill', action: 'DOT', detail: 'skill.dot → defender.dot' },
  { step: 6, phase: 'executeSkill', action: '冻结', detail: 'crowdControl.type===freeze' },
  {
    step: 7,
    phase: 'executeSkill',
    action: 'Debuff',
    detail: 'specialEffect atk_debuff / def_debuff → defender.buffs',
  },
];

const BATTLE_FLOW_TURN_END: SheetRow[] = [
  { step: 1, phase: 'processTurnEnd', action: 'DOT 结算', detail: '见公式表 dot_turn_end' },
  { step: 2, phase: 'processTurnEnd', action: '元素附着递减', detail: 'remainingTurns-1，0 则清除' },
  { step: 3, phase: 'processTurnEnd', action: 'Buff 递减', detail: '各 buff 回合 -1，到期移除' },
  { step: 4, phase: 'processTurnEnd', action: '控制递减', detail: 'freeze 回合 -1，到期清除' },
  { step: 5, phase: 'processTurnEnd', action: 'MP 自然回复', detail: '见公式表 mp_turn_regen' },
];

function rowsFromReactionPairMap(
  map: Record<Element, Partial<Record<Element, ReactionType>>>
): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const [attackElement, targets] of Object.entries(map) as [
    Element,
    Partial<Record<Element, ReactionType>>,
  ][]) {
    for (const [defenderElement, reaction] of Object.entries(targets)) {
      rows.push({
        attackElement,
        defenderElement,
        reaction: reaction as string,
      });
    }
  }
  return rows;
}

/** 与 `simulation-system/page.tsx` 中 BATTLE_MODULES 一致（无 React icon） */
const UI_MAIN_BATTLE_MODULES: SheetRow[] = [
  {
    id: 'battle-simulator',
    name: '战斗模拟 / Battle Sim',
    nameEn: 'Battle Simulator',
    path: '/simulation-system/battle',
    description: 'PVE回合制战斗模拟与难度评估',
    color: '#fa541c',
  },
];

const outDir = path.join(process.cwd(), 'exports');
const outFile = path.join(outDir, 'battle-simulation-data.xlsx');

const wb = XLSX.utils.book_new();

appendSheet(wb, BATTLE_RULES_FORMULAS, 'battle_rules_formulas');
appendSheet(wb, rowsFromReactionPairMap(ELEMENT_REACTION_PAIR_MAP), 'battle_reaction_pairs');
appendSheet(wb, BATTLE_FLOW_EXECUTE_SKILL, 'battle_flow_execute_skill');
appendSheet(wb, BATTLE_FLOW_TURN_END, 'battle_flow_turn_end');

appendSheet(wb, rowsFromRecord(ELEMENT_CONFIG as unknown as Record<string, unknown>), 'battle_elements');
appendSheet(
  wb,
  rowsFromRecord(ELEMENT_STRENGTH_CONFIG as unknown as Record<string, unknown>),
  'battle_element_strength'
);
appendSheet(wb, rowsFromRecord(REACTION_CONFIG as unknown as Record<string, unknown>), 'battle_reactions');
appendSheet(wb, rowsFromObjects(Object.values(SKILLS) as object[]), 'battle_skills');
appendSheet(wb, [flattenForSheet({ ...DEFAULT_PLAYER_STATS } as Record<string, unknown>)], 'battle_default_player');
appendSheet(wb, [flattenForSheet({ ...DEFAULT_MONSTER_STATS } as Record<string, unknown>)], 'battle_default_monster');
appendSheet(wb, [flattenForSheet({ ...MP_CONFIG } as Record<string, unknown>)], 'battle_mp_config');
appendSheet(wb, UI_MAIN_BATTLE_MODULES, 'ui_main_battle_modules');

fs.mkdirSync(outDir, { recursive: true });
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(outFile, buf);

// eslint-disable-next-line no-console -- CLI script
console.log(`已写入: ${outFile}`);
