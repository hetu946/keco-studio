'use client';

import { Button, Modal, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ImportSkillFailure } from '../lib/skills/battleSkillsImportExport';
import { buildBattleSkillsFailuresDownloadPayload, downloadJsonFile } from '../lib/skills/battleSkillsImportExport';
import styles from './ImportSkillsSummaryModal.module.css';

export type ImportSkillsSummaryModalProps = {
  open: boolean;
  totalInFile: number;
  successCount: number;
  failures: ImportSkillFailure[];
  onClose: () => void;
};

export function ImportSkillsSummaryModal(props: ImportSkillsSummaryModalProps) {
  const { open, totalInFile, successCount, failures, onClose } = props;

  const handleDownloadFailures = () => {
    const text = buildBattleSkillsFailuresDownloadPayload(failures);
    downloadJsonFile(`battle-skills-import-failures-${Date.now()}.json`, text);
  };

  const columns: ColumnsType<ImportSkillFailure> = [
    {
      title: '序号',
      dataIndex: 'index',
      width: 64,
      render: (v: number) => v + 1,
    },
    {
      title: '标识',
      dataIndex: 'label',
      width: 140,
      ellipsis: true,
    },
    {
      title: '失败原因',
      dataIndex: 'reason',
      ellipsis: true,
    },
  ];

  return (
    <Modal
      title="导入结果"
      open={open}
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          关闭
        </Button>
      }
      width={720}
      destroyOnHidden
    >
      <Typography.Paragraph className={styles.summary}>
        文件中共有 <strong>{totalInFile}</strong> 条：成功 <strong>{successCount}</strong> 条，失败{' '}
        <strong>{failures.length}</strong> 条。
      </Typography.Paragraph>
      {failures.length > 0 ? (
        <>
          <Table<ImportSkillFailure>
            size="small"
            rowKey={(r) => String(r.index)}
            columns={columns}
            dataSource={failures}
            pagination={false}
            scroll={{ y: 280 }}
            className={styles.failTable}
          />
          <Button type="primary" onClick={handleDownloadFailures}>
            下载失败条目
          </Button>
        </>
      ) : null}
    </Modal>
  );
}
