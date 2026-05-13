/**
 * 战斗技能配表 — 导出为 Excel（.xlsx）
 */

import * as XLSX from 'xlsx';
import type { Skill } from '../../types';
import { ELEMENT_CONFIG, ELEMENT_STRENGTH_CONFIG, REACTION_CONFIG } from '../../types';
import { BATTLE_SKILLS_SHEET_HEADERS, BATTLE_SKILLS_SHEET_NAME } from './battleSkillsSheetSpec';

function typeLabel(type: Skill['type']): string {
  return type === 'heal' ? '治疗' : '攻击';
}

function specialEffectLabel(se: NonNullable<Skill['specialEffect']>): string {
  if (se.type === 'heal') return '治疗(系数×ATK)';
  if (se.type === 'atk_debuff') return '降攻(比例)';
  return '降防(比例)';
}

function skillToDataRow(skill: Skill): (string | number)[] {
  const attach = skill.attachElement;
  const attachEl = attach
    ? attach.element === 'random'
      ? '随机'
      : ELEMENT_CONFIG[attach.element].name
    : '';
  const attachSt = attach ? ELEMENT_STRENGTH_CONFIG[attach.strength].name : '';
  const attachDur = attach ? String(attach.duration) : '';

  const dot = skill.dot;
  const dotDamage = dot ? dot.damage : '';
  const dotDur = dot ? dot.duration : '';

  const freeze =
    skill.crowdControl?.type === 'freeze' ? skill.crowdControl.duration : '';

  const se = skill.specialEffect;
  const seType = se ? specialEffectLabel(se) : '';
  const seVal = se ? se.value : '';
  const seDur = se ? se.duration : '';

  const reactions =
    skill.reactionTrigger?.length ?
      skill.reactionTrigger
        .map((x) => `${ELEMENT_CONFIG[x.element].name}·${REACTION_CONFIG[x.reaction].name}`)
        .join('；')
    : '';

  return [
    skill.id,
    skill.name,
    typeLabel(skill.type),
    skill.power,
    skill.mpCost,
    skill.maxCooldown,
    skill.description ?? '',
    attachEl,
    attachSt,
    attachDur,
    dotDamage,
    dotDur,
    freeze,
    seType,
    seVal,
    seDur,
    reactions,
  ];
}

/** 生成 .xlsx 二进制（Uint8Array），供浏览器下载 */
export function buildBattleSkillsXlsxBuffer(skills: Skill[]): Uint8Array {
  const aoa: (string | number)[][] = [[...BATTLE_SKILLS_SHEET_HEADERS], ...skills.map(skillToDataRow)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, BATTLE_SKILLS_SHEET_NAME);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

export function downloadBattleSkillsXlsx(filename: string, buffer: Uint8Array): void {
  if (typeof window === 'undefined') return;
  const copy = buffer.slice();
  const blob = new Blob([copy], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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
