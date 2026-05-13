import { Button, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SkillFlatRow } from '../lib/skills/skillTableCodec';
import { ATTACH_OPTIONS, SPECIAL_OPTIONS, STRENGTH_OPTIONS } from './battleSkillsEditorConstants';
import { SkillReactionTriggersEditor } from './SkillReactionTriggersEditor';
import colStyles from './BattleSkillsTableColumns.module.css';

export function createBattleSkillsTableColumns(params: {
  updateRow: (index: number, patch: Partial<SkillFlatRow>) => void;
  removeRow: (index: number) => void;
  editorDisabled?: boolean;
}): ColumnsType<SkillFlatRow & { _idx: number }> {
  const { updateRow, removeRow, editorDisabled } = params;

  return [
    {
      title: ' ',
      key: 'rowNum',
      width: 44,
      align: 'center',
      onCell: () => ({
        className: colStyles.rowNumCell,
      }),
      render: (_, r) => <span className={colStyles.rowNumText}>{r._idx + 1}</span>,
    },
    {
      title: 'id',
      dataIndex: 'id',
      width: 130,
      render: (_, r) => (
        <Input
          value={r.id}
          onChange={(e) => updateRow(r._idx, { id: e.target.value })}
          placeholder="必填，英文下划线"
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      width: 100,
      render: (_, r) => (
        <Input value={r.name} onChange={(e) => updateRow(r._idx, { name: e.target.value })} placeholder="必填" />
      ),
    },
    {
      title: '类型',
      width: 88,
      render: (_, r) => (
        <Select
          className={colStyles.selectFullWidth}
          value={r.type}
          options={[
            { value: 'attack', label: '攻击' },
            { value: 'heal', label: '治疗' },
          ]}
          onChange={(v) => updateRow(r._idx, { type: v })}
        />
      ),
    },
    {
      title: '伤害倍率',
      width: 88,
      render: (_, r) => (
        <Input value={r.power} onChange={(e) => updateRow(r._idx, { power: e.target.value })} placeholder="1" />
      ),
    },
    {
      title: 'MP',
      width: 72,
      render: (_, r) => (
        <Input value={r.mpCost} onChange={(e) => updateRow(r._idx, { mpCost: e.target.value })} placeholder="0" />
      ),
    },
    {
      title: '冷却',
      width: 72,
      render: (_, r) => (
        <Input
          value={r.maxCooldown}
          onChange={(e) => updateRow(r._idx, { maxCooldown: e.target.value })}
          placeholder="0"
        />
      ),
    },
    {
      title: '描述',
      width: 160,
      render: (_, r) => (
        <Input
          value={r.description}
          onChange={(e) => updateRow(r._idx, { description: e.target.value })}
          placeholder="可选"
        />
      ),
    },
    {
      title: '附着元素',
      width: 100,
      render: (_, r) => (
        <Select
          className={colStyles.selectFullWidth}
          value={r.attachElement || ''}
          options={ATTACH_OPTIONS}
          onChange={(v) => updateRow(r._idx, { attachElement: v ?? '' })}
        />
      ),
    },
    {
      title: '附着强度',
      width: 88,
      render: (_, r) => (
        <Select
          className={colStyles.selectFullWidth}
          value={r.attachStrength}
          options={STRENGTH_OPTIONS}
          onChange={(v) => updateRow(r._idx, { attachStrength: v })}
        />
      ),
    },
    {
      title: '附着回合',
      width: 80,
      render: (_, r) => (
        <Input
          value={r.attachDuration}
          onChange={(e) => updateRow(r._idx, { attachDuration: e.target.value })}
          placeholder="默认按强度"
        />
      ),
    },
    {
      title: 'DOT倍率',
      width: 80,
      render: (_, r) => (
        <Input value={r.dotDamage} onChange={(e) => updateRow(r._idx, { dotDamage: e.target.value })} />
      ),
    },
    {
      title: 'DOT回合',
      width: 80,
      render: (_, r) => (
        <Input value={r.dotDuration} onChange={(e) => updateRow(r._idx, { dotDuration: e.target.value })} />
      ),
    },
    {
      title: '冻结回合',
      width: 88,
      render: (_, r) => (
        <Input
          value={r.freezeDuration}
          onChange={(e) => updateRow(r._idx, { freezeDuration: e.target.value })}
          placeholder="0"
        />
      ),
    },
    {
      title: '特殊效果',
      width: 120,
      render: (_, r) => (
        <Select
          className={colStyles.selectFullWidth}
          value={r.specialType || ''}
          options={SPECIAL_OPTIONS}
          onChange={(v) => updateRow(r._idx, { specialType: v ?? '' })}
        />
      ),
    },
    {
      title: '特殊数值',
      width: 80,
      render: (_, r) => (
        <Input value={r.specialValue} onChange={(e) => updateRow(r._idx, { specialValue: e.target.value })} />
      ),
    },
    {
      title: '特殊持续',
      width: 88,
      render: (_, r) => (
        <Input
          value={r.specialDuration}
          onChange={(e) => updateRow(r._idx, { specialDuration: e.target.value })}
        />
      ),
    },
    {
      title: '关联反应',
      width: 268,
      render: (_, r) => (
        <SkillReactionTriggersEditor
          value={r.reactionTriggers}
          onChange={(next) => updateRow(r._idx, { reactionTriggers: next })}
          disabled={editorDisabled}
        />
      ),
    },
    {
      title: '',
      key: 'op',
      width: 56,
      render: (_, r) => (
        <Button type="link" danger size="small" onClick={() => removeRow(r._idx)}>
          删
        </Button>
      ),
    },
  ];
}
