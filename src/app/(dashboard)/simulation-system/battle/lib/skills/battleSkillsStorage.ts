/**
 * 战斗技能配表 — 浏览器本地持久化（IndexedDB 为主，localStorage 镜像便于跨标签 storage 事件与快速回读）
 */

import type { Skill } from '../../types';
import { getBuiltinSkills } from '../../data/skills';
import { idbReadBattleSkillsJson, idbWriteBattleSkillsJson, idbRemoveBattleSkills } from './battleSkillsIndexedDb';
import { BATTLE_SKILLS_STORAGE_KEY, BATTLE_SKILLS_UPDATED_EVENT } from './battleSkillsPersistenceKeys';

export { BATTLE_SKILLS_STORAGE_KEY, BATTLE_SKILLS_UPDATED_EVENT };

export function notifyBattleSkillsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BATTLE_SKILLS_UPDATED_EVENT));
}

function isValidSkillRecord(x: unknown): x is Skill {
  if (!x || typeof x !== 'object') return false;
  const s = x as Skill;
  return (
    typeof s.id === 'string' &&
    s.id.length > 0 &&
    typeof s.name === 'string' &&
    s.name.length > 0 &&
    typeof s.power === 'number' &&
    Number.isFinite(s.power) &&
    typeof s.mpCost === 'number' &&
    Number.isFinite(s.mpCost) &&
    typeof s.maxCooldown === 'number' &&
    Number.isFinite(s.maxCooldown) &&
    typeof s.cooldown === 'number' &&
    (s.type === 'attack' || s.type === 'heal')
  );
}

/** 与 getEffective 一致：解析已存储的 JSON 文本为生效技能列表 */
export function normalizeStoredSkillsJson(raw: string): Skill[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return getBuiltinSkills();
  }
  if (!Array.isArray(data)) return getBuiltinSkills();
  if (data.length === 0) return [];
  const valid = data.filter(isValidSkillRecord);
  if (valid.length === 0) return getBuiltinSkills();
  return valid;
}

/**
 * 从 IndexedDB 优先、其次 localStorage 读取并规范化；必要时在两者之间迁移镜像。
 * 用于首屏与 storage 事件后的刷新（与资源库 IndexedDB 持久化策略一致）。
 */
export async function loadBattleSkillsFromPersistence(): Promise<Skill[]> {
  if (typeof window === 'undefined') return getBuiltinSkills();

  let idbRaw: string | null = null;
  try {
    idbRaw = await idbReadBattleSkillsJson();
  } catch (e) {
    console.warn('[battle-skills] IndexedDB read failed', e);
  }

  let lsRaw: string | null = null;
  try {
    lsRaw = localStorage.getItem(BATTLE_SKILLS_STORAGE_KEY);
  } catch (e) {
    console.warn('[battle-skills] localStorage.getItem failed', e);
  }

  let chosen: string | null = null;
  if (idbRaw != null && idbRaw !== '') {
    chosen = idbRaw;
    if (lsRaw !== chosen) {
      try {
        localStorage.setItem(BATTLE_SKILLS_STORAGE_KEY, chosen);
      } catch (e) {
        console.warn('[battle-skills] localStorage mirror after IDB read failed', e);
      }
    }
  } else if (lsRaw != null && lsRaw !== '') {
    chosen = lsRaw;
    void idbWriteBattleSkillsJson(lsRaw).catch((e) => console.warn('[battle-skills] IndexedDB migrate from localStorage failed', e));
  }

  if (chosen === null) return getBuiltinSkills();
  return normalizeStoredSkillsJson(chosen);
}

export function saveBattleSkillsToStorage(skills: Skill[]): void {
  if (typeof window === 'undefined') return;
  const json = JSON.stringify(skills);
  try {
    localStorage.setItem(BATTLE_SKILLS_STORAGE_KEY, json);
  } catch (e) {
    console.warn('[battle-skills] localStorage.setItem failed', e);
  }
  void idbWriteBattleSkillsJson(json).catch((e) => console.warn('[battle-skills] IndexedDB write failed', e));
  notifyBattleSkillsUpdated();
}

export async function clearBattleSkillsStorage(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BATTLE_SKILLS_STORAGE_KEY);
  } catch (e) {
    console.warn('[battle-skills] localStorage.removeItem failed', e);
  }
  try {
    await idbRemoveBattleSkills();
  } catch (e) {
    console.warn('[battle-skills] IndexedDB remove failed', e);
  }
  notifyBattleSkillsUpdated();
}
