/**
 * 战斗技能配表 — 导入条目校验与合并（条目为英文键 Skill 形状对象；Excel 解析见 battleSkillsImportXlsx.ts）
 */

import type {
  Element,
  ElementStrength,
  ReactionType,
  Skill,
  SkillType,
} from '../../types';
import { ELEMENT_STRENGTH_CONFIG } from '../../types';
import { skillsToFlatRows, type SkillFlatRow } from './skillTableCodec';

const ELEMENTS: Element[] = ['fire', 'water', 'thunder', 'grass', 'ice'];
const REACTION_TYPES: ReactionType[] = [
  'vaporize',
  'melt',
  'electrify',
  'overload',
  'burn',
  'freeze',
  'quicken',
];

export interface ImportSkillFailure {
  /** 源文件数组中的下标（从 0 开始） */
  index: number;
  /** 用于展示的标识（多为 id） */
  label: string;
  reason: string;
  raw: unknown;
}

export interface ImportSkillsResult {
  successes: Skill[];
  failures: ImportSkillFailure[];
}

function readFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readNonNegInt(v: unknown, fallback: number): number {
  const n = readFiniteNumber(v);
  if (n === null || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function isElement(s: string): s is Element {
  return (ELEMENTS as readonly string[]).includes(s);
}

function isStrength(s: string): s is ElementStrength {
  return s === 'weak' || s === 'medium' || s === 'strong';
}

function isReactionType(s: string): s is ReactionType {
  return (REACTION_TYPES as readonly string[]).includes(s);
}

function parseAttach(raw: unknown): Skill['attachElement'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const el = o.element;
  const elStr = typeof el === 'string' ? el : '';
  if (elStr !== 'random' && !isElement(elStr)) return undefined;
  const stRaw = o.strength;
  const stStr = typeof stRaw === 'string' ? stRaw : 'weak';
  const strength: ElementStrength = isStrength(stStr) ? stStr : 'weak';
  const dur = readNonNegInt(o.duration, ELEMENT_STRENGTH_CONFIG[strength].duration);
  return {
    element: elStr === 'random' ? 'random' : elStr,
    strength,
    duration: dur > 0 ? dur : ELEMENT_STRENGTH_CONFIG[strength].duration,
  };
}

function parseDot(raw: unknown): Skill['dot'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const damage = readFiniteNumber(o.damage);
  const duration = readNonNegInt(o.duration, 0);
  if (damage === null || damage < 0 || duration <= 0) return undefined;
  return { damage, duration };
}

function parseCrowdControl(raw: unknown): Skill['crowdControl'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (o.type !== 'freeze') return undefined;
  const duration = readNonNegInt(o.duration, 0);
  if (duration <= 0) return undefined;
  return { type: 'freeze', duration };
}

function parseSpecialEffect(raw: unknown): Skill['specialEffect'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const t = o.type;
  if (t !== 'heal' && t !== 'atk_debuff' && t !== 'def_debuff') return undefined;
  const value = readFiniteNumber(o.value);
  if (value === null || value < 0) return undefined;
  const duration = readNonNegInt(o.duration, t === 'heal' ? 0 : 2);
  return { type: t, value, duration };
}

function parseReactionTriggers(raw: unknown): Skill['reactionTrigger'] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: NonNullable<Skill['reactionTrigger']> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const el = typeof o.element === 'string' ? o.element : '';
    const re = typeof o.reaction === 'string' ? o.reaction : '';
    if (!isElement(el) || !isReactionType(re)) continue;
    out.push({ element: el, reaction: re });
  }
  return out.length > 0 ? out : undefined;
}

function normalizeOneSkill(item: unknown, index: number): { skill: Skill } | { label: string; reason: string } {
  if (!item || typeof item !== 'object') {
    return { label: `#${index + 1}`, reason: '不是合法的对象' };
  }
  const o = item as Record<string, unknown>;

  const idRaw = o.id;
  const id = typeof idRaw === 'string' ? idRaw.trim() : '';
  if (!id) {
    return { label: `#${index + 1}`, reason: '缺少 id 或 id 不是字符串' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(id)) {
    return { label: id, reason: 'id 仅允许字母、数字、下划线' };
  }

  const nameRaw = o.name;
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
  if (!name) {
    return { label: id, reason: '缺少 name 或名称为空' };
  }

  const typeRaw = o.type;
  const typeStr = typeof typeRaw === 'string' ? typeRaw.trim() : '';
  if (typeStr !== 'attack' && typeStr !== 'heal') {
    return { label: id, reason: 'type 须为 attack 或 heal' };
  }
  const type: SkillType = typeStr as SkillType;

  const power = readFiniteNumber(o.power);
  if (power === null || power < 0) {
    return { label: id, reason: 'power 须为非负有限数字' };
  }

  const mpCost = readFiniteNumber(o.mpCost);
  if (mpCost === null || mpCost < 0) {
    return { label: id, reason: 'mpCost 须为非负有限数字' };
  }

  const maxCooldown = readFiniteNumber(o.maxCooldown);
  if (maxCooldown === null || maxCooldown < 0) {
    return { label: id, reason: 'maxCooldown 须为非负有限数字' };
  }

  let cooldown = readFiniteNumber(o.cooldown);
  if (cooldown === null || cooldown < 0) {
    cooldown = 0;
  }

  const descRaw = o.description;
  const description =
    typeof descRaw === 'string' && descRaw.trim() !== '' ? descRaw.trim() : '—';

  const skill: Skill = {
    id,
    name,
    type,
    power,
    mpCost,
    cooldown,
    maxCooldown,
    description,
  };

  const attach = parseAttach(o.attachElement);
  if (attach) skill.attachElement = attach;

  const dot = parseDot(o.dot);
  if (dot) skill.dot = dot;

  const cc = parseCrowdControl(o.crowdControl);
  if (cc) skill.crowdControl = cc;

  const se = parseSpecialEffect(o.specialEffect);
  if (se) skill.specialEffect = se;

  const rt = parseReactionTriggers(o.reactionTrigger);
  if (rt) skill.reactionTrigger = rt;

  return { skill };
}

/**
 * 按文件顺序校验；同一文件内重复 id 仅保留首次，其余记为失败。
 */
export function importSkillItemsFromArray(items: unknown[]): ImportSkillsResult {
  const successes: Skill[] = [];
  const failures: ImportSkillFailure[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const r = normalizeOneSkill(item, i);
    if ('reason' in r) {
      failures.push({
        index: i,
        label: r.label,
        reason: r.reason,
        raw: item,
      });
      continue;
    }
    if (seenIds.has(r.skill.id)) {
      failures.push({
        index: i,
        label: r.skill.id,
        reason: '与文件中靠前条目的 id 重复',
        raw: item,
      });
      continue;
    }
    seenIds.add(r.skill.id);
    successes.push(r.skill);
  }

  return { successes, failures };
}

/**
 * 将导入成功的技能按 id 合并进当前表格行：已存在 id 则替换该行，否则追加到末尾。
 */
export function mergeImportedSkillsIntoFlatRows(current: SkillFlatRow[], imported: Skill[]): SkillFlatRow[] {
  const next = [...current];
  for (const skill of imported) {
    const flat = skillsToFlatRows([skill])[0];
    const i = next.findIndex((r) => r.id.trim() === skill.id);
    if (i >= 0) next[i] = flat;
    else next.push(flat);
  }
  return next;
}

export function buildBattleSkillsFailuresDownloadPayload(failures: ImportSkillFailure[]): string {
  return JSON.stringify(
    {
      source: 'keco-battle-skills-import-failures',
      exportedAt: new Date().toISOString(),
      failures,
    },
    null,
    2,
  );
}

export function downloadJsonFile(filename: string, jsonText: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
