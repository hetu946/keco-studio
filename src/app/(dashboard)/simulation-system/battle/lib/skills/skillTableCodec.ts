/**
 * 技能配表行 ↔ Skill 转换（可选字段用默认值）
 */

import type { Element, ElementStrength, ReactionType, Skill, SkillType } from '../../types';
import { ELEMENT_STRENGTH_CONFIG } from '../../types';

const ELEMENTS: Element[] = ['fire', 'water', 'thunder', 'grass', 'ice'];
const REACTIONS: ReactionType[] = [
  'vaporize',
  'melt',
  'electrify',
  'overload',
  'burn',
  'freeze',
  'quicken',
];

function parseNum(s: string, fallback: number): number {
  const n = Number(String(s).trim());
  return Number.isFinite(n) ? n : fallback;
}

function parseIntNonNeg(s: string, fallback: number): number {
  const n = Math.floor(Number(String(s).trim()));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function isElement(s: string): s is Element {
  return ELEMENTS.includes(s as Element);
}

function isStrength(s: string): s is ElementStrength {
  return s === 'weak' || s === 'medium' || s === 'strong';
}

function isSkillType(s: string): s is SkillType {
  return s === 'attack' || s === 'heal';
}

function isReactionType(s: string): s is ReactionType {
  return (REACTIONS as readonly string[]).includes(s);
}

/** 表格中「关联反应」一行（元素 + 反应类型），保存时只写入两者皆合法的项 */
export interface ReactionTriggerPairRow {
  element: string;
  reaction: string;
}

/** 表格编辑用扁平行（字符串便于 Input 受控） */
export interface SkillFlatRow {
  id: string;
  name: string;
  type: string;
  power: string;
  mpCost: string;
  maxCooldown: string;
  description: string;
  /** 空 = 无附着；random 或元素名 */
  attachElement: string;
  attachStrength: string;
  attachDuration: string;
  dotDamage: string;
  dotDuration: string;
  freezeDuration: string;
  specialType: string;
  specialValue: string;
  specialDuration: string;
  /** 用于技能卡展示的多组「元素 + 反应类型」，无需手写 JSON */
  reactionTriggers: ReactionTriggerPairRow[];
}

export function emptySkillFlatRow(): SkillFlatRow {
  return {
    id: '',
    name: '',
    type: 'attack',
    power: '1',
    mpCost: '0',
    maxCooldown: '0',
    description: '',
    attachElement: '',
    attachStrength: 'weak',
    attachDuration: '',
    dotDamage: '',
    dotDuration: '',
    freezeDuration: '0',
    specialType: '',
    specialValue: '',
    specialDuration: '',
    reactionTriggers: [],
  };
}

export function skillToFlatRow(skill: Skill): SkillFlatRow {
  const attach = skill.attachElement;
  const dot = skill.dot;
  const cc = skill.crowdControl;
  const se = skill.specialEffect;

  return {
    id: skill.id,
    name: skill.name,
    type: skill.type,
    power: String(skill.power),
    mpCost: String(skill.mpCost),
    maxCooldown: String(skill.maxCooldown),
    description: skill.description ?? '',
    attachElement: attach ? attach.element : '',
    attachStrength: attach?.strength ?? 'weak',
    attachDuration: attach ? String(attach.duration) : '',
    dotDamage: dot ? String(dot.damage) : '',
    dotDuration: dot ? String(dot.duration) : '',
    freezeDuration: cc?.type === 'freeze' ? String(cc.duration) : '0',
    specialType: se?.type ?? '',
    specialValue: se ? String(se.value) : '',
    specialDuration: se ? String(se.duration) : '',
    reactionTriggers:
      skill.reactionTrigger?.map((x) => ({ element: x.element, reaction: x.reaction })) ?? [],
  };
}

/**
 * 将一行转为 Skill；校验失败返回 { error }
 * id、name 必填；id 仅字母数字下划线
 */
export function flatRowToSkill(row: SkillFlatRow): { skill: Skill } | { error: string } {
  const id = row.id.trim();
  const name = row.name.trim();
  if (!id) return { error: '技能 id 不能为空' };
  if (!/^[a-zA-Z0-9_]+$/.test(id)) return { error: `技能 id 仅允许字母、数字、下划线：${id}` };
  if (!name) return { error: `技能「${id}」名称不能为空` };

  const type: SkillType = isSkillType(row.type.trim()) ? (row.type.trim() as SkillType) : 'attack';
  const power = parseNum(row.power, 1);
  const mpCost = parseIntNonNeg(row.mpCost, 0);
  const maxCooldown = parseIntNonNeg(row.maxCooldown, 0);

  const skill: Skill = {
    id,
    name,
    type,
    power: power < 0 ? 0 : power,
    mpCost,
    cooldown: 0,
    maxCooldown,
    description: row.description.trim() || '—',
  };

  const attachEl = row.attachElement.trim();
  if (attachEl && (attachEl === 'random' || isElement(attachEl))) {
    const strengthRaw = row.attachStrength.trim();
    const strength: ElementStrength = isStrength(strengthRaw) ? strengthRaw : 'weak';
    const defaultDur = ELEMENT_STRENGTH_CONFIG[strength].duration;
    const duration = row.attachDuration.trim()
      ? parseIntNonNeg(row.attachDuration, defaultDur)
      : defaultDur;
    skill.attachElement = {
      element: attachEl === 'random' ? 'random' : attachEl,
      strength,
      duration: duration > 0 ? duration : defaultDur,
    };
  }

  const dotD = row.dotDamage.trim();
  const dotT = row.dotDuration.trim();
  if (dotD || dotT) {
    const damage = parseNum(dotD, 0);
    const duration = parseIntNonNeg(dotT, 0);
    if (duration > 0 && damage >= 0) {
      skill.dot = { damage, duration };
    }
  }

  const freeze = parseIntNonNeg(row.freezeDuration, 0);
  if (freeze > 0) {
    skill.crowdControl = { type: 'freeze', duration: freeze };
  }

  const st = row.specialType.trim();
  if (st === 'heal' || st === 'atk_debuff' || st === 'def_debuff') {
    const value = parseNum(row.specialValue, 0);
    const duration = parseIntNonNeg(row.specialDuration, st === 'heal' ? 0 : 2);
    skill.specialEffect = {
      type: st,
      value: value < 0 ? 0 : value,
      duration,
    };
  }

  const triggers: { element: Element; reaction: ReactionType }[] = [];
  for (const p of row.reactionTriggers) {
    const el = p.element.trim();
    const re = p.reaction.trim();
    if (!el || !re) continue;
    if (!isElement(el) || !isReactionType(re)) continue;
    triggers.push({ element: el, reaction: re });
  }
  if (triggers.length > 0) {
    skill.reactionTrigger = triggers;
  }

  return { skill };
}

/**
 * 从表格行收集技能：跳过空行、校验失败的行、重复 id（保留最先出现的一条）。
 */
export function collectValidSkillsFromRows(rows: SkillFlatRow[]): Skill[] {
  const skills: Skill[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.id.trim() && !row.name.trim()) continue;
    const r = flatRowToSkill(row);
    if ('error' in r) continue;
    if (seen.has(r.skill.id)) continue;
    seen.add(r.skill.id);
    skills.push(r.skill);
  }
  return skills;
}

export function skillsToFlatRows(skills: Skill[]): SkillFlatRow[] {
  return skills.map(skillToFlatRow);
}
