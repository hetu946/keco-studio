/**
 * 战斗技能配表 — 从 Excel（.xlsx）解析为与 JSON 导入一致的英文 Skill 对象，供 importSkillItemsFromArray 校验。
 */

import * as XLSX from 'xlsx';
import type { Element, ElementStrength, ReactionType, Skill } from '../../types';
import { ELEMENT_CONFIG, ELEMENT_STRENGTH_CONFIG, REACTION_CONFIG } from '../../types';
import { BATTLE_SKILLS_SHEET_HEADERS, BATTLE_SKILLS_SHEET_NAME, type BattleSkillsSheetHeader } from './battleSkillsSheetSpec';

const REACTION_PAIR_SEP = /[\u00B7\u30FB·]/;

const ELEMENT_NAME_TO_KEY = new Map<string, Element>();
for (const el of Object.keys(ELEMENT_CONFIG) as Element[]) {
  ELEMENT_NAME_TO_KEY.set(ELEMENT_CONFIG[el].name, el);
}

const REACTION_NAME_TO_KEY = new Map<string, ReactionType>();
for (const rt of Object.keys(REACTION_CONFIG) as ReactionType[]) {
  REACTION_NAME_TO_KEY.set(REACTION_CONFIG[rt].name, rt);
}

const STRENGTH_NAME_TO_KEY = new Map<string, ElementStrength>();
for (const st of Object.keys(ELEMENT_STRENGTH_CONFIG) as ElementStrength[]) {
  STRENGTH_NAME_TO_KEY.set(ELEMENT_STRENGTH_CONFIG[st].name, st);
}

const SPECIAL_LABEL_TO_TYPE = new Map<string, 'heal' | 'atk_debuff' | 'def_debuff'>([
  ['治疗(系数×ATK)', 'heal'],
  ['降攻(比例)', 'atk_debuff'],
  ['降防(比例)', 'def_debuff'],
  ['治疗', 'heal'],
  ['降攻', 'atk_debuff'],
  ['降防', 'def_debuff'],
]);

const TYPE_LABEL_TO_KEY = new Map<string, Skill['type']>([
  ['攻击', 'attack'],
  ['治疗', 'heal'],
  ['attack', 'attack'],
  ['heal', 'heal'],
]);

function cellStr(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
}

function buildHeaderIndex(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  headerRow.forEach((cell, i) => {
    const h = cellStr(cell);
    if (h && !map.has(h)) map.set(h, i);
  });
  return map;
}

function rowToLabelMap(
  headerIndex: Map<string, number>,
  row: unknown[],
): Record<BattleSkillsSheetHeader, string> {
  const out = {} as Record<BattleSkillsSheetHeader, string>;
  for (const key of BATTLE_SKILLS_SHEET_HEADERS) {
    const idx = headerIndex.get(key);
    out[key] = idx === undefined ? '' : cellStr(row[idx]);
  }
  return out;
}

function isRowEmpty(row: Record<BattleSkillsSheetHeader, string>): boolean {
  return !row.id.trim() && !row['名称'].trim();
}

function mapType(label: string): string {
  const t = label.trim();
  return TYPE_LABEL_TO_KEY.get(t) ?? t;
}

function buildAttachElement(row: Record<BattleSkillsSheetHeader, string>): Skill['attachElement'] | undefined {
  const elLabel = row['附着元素'].trim();
  if (!elLabel) return undefined;
  const element =
    elLabel === '随机' ? 'random' : ELEMENT_NAME_TO_KEY.get(elLabel);
  if (!element) return undefined;
  const stLabel = row['附着强度'].trim();
  const strength: ElementStrength =
    stLabel && STRENGTH_NAME_TO_KEY.has(stLabel) ? STRENGTH_NAME_TO_KEY.get(stLabel)! : 'weak';
  const durRaw = row['附着回合'].trim();
  const dur = durRaw ? Math.max(0, Math.floor(Number(durRaw))) : ELEMENT_STRENGTH_CONFIG[strength].duration;
  const duration = Number.isFinite(dur) && dur > 0 ? dur : ELEMENT_STRENGTH_CONFIG[strength].duration;
  return { element, strength, duration };
}

function buildDot(row: Record<BattleSkillsSheetHeader, string>): Skill['dot'] | undefined {
  const d = row['DOT倍率'].trim();
  const t = row['DOT回合'].trim();
  if (!d && !t) return undefined;
  const damage = Number(d);
  const duration = Math.floor(Number(t));
  if (!Number.isFinite(damage) || damage < 0 || !Number.isFinite(duration) || duration <= 0) return undefined;
  return { damage, duration };
}

function buildCrowdControl(row: Record<BattleSkillsSheetHeader, string>): Skill['crowdControl'] | undefined {
  const f = row['冻结回合'].trim();
  if (!f) return undefined;
  const duration = Math.floor(Number(f));
  if (!Number.isFinite(duration) || duration <= 0) return undefined;
  return { type: 'freeze', duration };
}

function buildSpecialEffect(row: Record<BattleSkillsSheetHeader, string>): Skill['specialEffect'] | undefined {
  const lab = row['特殊效果'].trim();
  if (!lab) return undefined;
  const type = SPECIAL_LABEL_TO_TYPE.get(lab);
  if (!type) return undefined;
  const value = Number(row['特殊数值'].trim());
  if (!Number.isFinite(value) || value < 0) return undefined;
  const durRaw = row['特殊持续'].trim();
  const duration = durRaw ? Math.max(0, Math.floor(Number(durRaw))) : type === 'heal' ? 0 : 2;
  if (!Number.isFinite(duration)) return undefined;
  return { type, value, duration: Number.isFinite(duration) ? duration : 0 };
}

function buildReactionTrigger(
  row: Record<BattleSkillsSheetHeader, string>,
): Skill['reactionTrigger'] | undefined {
  const raw = row['关联反应'].trim();
  if (!raw) return undefined;
  const segments = raw.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
  const out: NonNullable<Skill['reactionTrigger']> = [];
  for (const seg of segments) {
    const parts = seg.split(/[\u00B7\u30FB·]/).map((s) => s.trim());
    if (parts.length !== 2) continue;
    const [elName, reName] = parts;
    const element = ELEMENT_NAME_TO_KEY.get(elName);
    const reaction = REACTION_NAME_TO_KEY.get(reName);
    if (!element || !reaction) continue;
    out.push({ element, reaction });
  }
  return out.length > 0 ? out : undefined;
}

/** 将一行（中文表头）转为 importSkillItemsFromArray 所需的英文键对象 */
export function excelLabelRowToSkillLikeObject(row: Record<BattleSkillsSheetHeader, string>): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: row.id.trim(),
    name: row['名称'].trim(),
    type: mapType(row['类型']),
    power: row['伤害倍率'].trim() === '' ? undefined : Number(row['伤害倍率']),
    mpCost: row['MP'].trim() === '' ? undefined : Number(row['MP']),
    maxCooldown: row['冷却'].trim() === '' ? undefined : Number(row['冷却']),
    cooldown: 0,
    description: row['描述'].trim() || '—',
  };

  const attach = buildAttachElement(row);
  if (attach) o.attachElement = attach;

  const dot = buildDot(row);
  if (dot) o.dot = dot;

  const cc = buildCrowdControl(row);
  if (cc) o.crowdControl = cc;

  const se = buildSpecialEffect(row);
  if (se) o.specialEffect = se;

  const rt = buildReactionTrigger(row);
  if (rt) o.reactionTrigger = rt;

  return o;
}

/**
 * 解析本应用导出的 .xlsx（或表头与之一致的工作表）。返回与 JSON 导入相同的条目数组。
 * @throws Error 工作簿无法解析、缺少工作表、表头不匹配等
 */
export function parseBattleSkillsXlsxToSkillItems(buffer: Uint8Array): unknown[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames.includes(BATTLE_SKILLS_SHEET_NAME)
    ? BATTLE_SKILLS_SHEET_NAME
    : wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('工作簿中没有工作表');
  }
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
  if (!aoa.length) {
    throw new Error('工作表为空');
  }
  const headerRow = aoa[0];
  const headerIndex = buildHeaderIndex(headerRow);
  for (const required of ['id', '名称'] as const) {
    if (!headerIndex.has(required)) {
      throw new Error(`表头缺少必要列「${required}」，请使用本页「导出配置」生成的 Excel 或保持相同表头`);
    }
  }

  const items: unknown[] = [];
  for (let r = 1; r < aoa.length; r += 1) {
    const rawRow = aoa[r] ?? [];
    const padded = [...rawRow];
    while (padded.length < headerRow.length) padded.push('');
    const labelRow = rowToLabelMap(headerIndex, padded);
    if (isRowEmpty(labelRow)) continue;
    items.push(excelLabelRowToSkillLikeObject(labelRow));
  }

  return items;
}
