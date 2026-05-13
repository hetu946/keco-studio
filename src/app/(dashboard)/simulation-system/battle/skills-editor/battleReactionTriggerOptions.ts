import type { Element, ReactionType } from '../types';
import { ELEMENT_CONFIG, REACTION_CONFIG } from '../types';

/** 关联反应里的「元素」选项（不含随机；用于展示标签，与附着可分开配置） */
export const REACTION_TRIGGER_ELEMENT_OPTIONS: { value: Element; label: string }[] = (
  ['fire', 'water', 'thunder', 'grass', 'ice'] as const
).map((value) => ({ value, label: ELEMENT_CONFIG[value].name }));

export const REACTION_TRIGGER_TYPE_OPTIONS: { value: ReactionType; label: string }[] = (
  ['vaporize', 'melt', 'electrify', 'overload', 'burn', 'freeze', 'quicken'] as const
).map((value) => ({ value, label: REACTION_CONFIG[value].name }));
