'use client';

import { Button, Select, Space } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import type { ReactionTriggerPairRow } from '../lib/skills/skillTableCodec';
import { REACTION_TRIGGER_ELEMENT_OPTIONS, REACTION_TRIGGER_TYPE_OPTIONS } from './battleReactionTriggerOptions';
import styles from './SkillReactionTriggersEditor.module.css';

export function SkillReactionTriggersEditor(props: {
  value: ReactionTriggerPairRow[];
  onChange: (next: ReactionTriggerPairRow[]) => void;
  disabled?: boolean;
}) {
  const { value, onChange, disabled } = props;
  const pairs = value.length > 0 ? value : [];

  const setPair = (index: number, patch: Partial<ReactionTriggerPairRow>) => {
    const next = pairs.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(pairs.filter((_, i) => i !== index));
  };

  const addPair = () => {
    onChange([...pairs, { element: '', reaction: '' }]);
  };

  return (
    <Space direction="vertical" size={6} className={styles.root}>
      {pairs.map((p, index) => (
        <Space key={index} wrap className={styles.pairRow} align="start">
          <Select
            className={styles.selectElement}
            placeholder="元素"
            allowClear
            disabled={disabled}
            value={p.element || undefined}
            options={REACTION_TRIGGER_ELEMENT_OPTIONS}
            onChange={(v) => setPair(index, { element: v ?? '' })}
          />
          <Select
            className={styles.selectReaction}
            placeholder="反应"
            allowClear
            disabled={disabled}
            value={p.reaction || undefined}
            options={REACTION_TRIGGER_TYPE_OPTIONS}
            onChange={(v) => setPair(index, { reaction: v ?? '' })}
          />
          <Button
            type="text"
            danger
            size="small"
            icon={<MinusCircleOutlined />}
            disabled={disabled}
            onClick={() => removeAt(index)}
            aria-label="删除本条关联反应"
          />
        </Space>
      ))}
      <Button type="dashed" size="small" icon={<PlusOutlined />} disabled={disabled} onClick={addPair} block>
        添加关联反应
      </Button>
    </Space>
  );
}
