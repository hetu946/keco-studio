'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Button, Card, Pagination, Space, Spin, Table, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { BattleSkillsEditorHelpCollapse } from '../skills-editor/BattleSkillsEditorHelpCollapse';
import { ImportSkillsSummaryModal } from '../skills-editor/ImportSkillsSummaryModal';
import { AUTOSAVE_DEBOUNCE_MS, PAGE_SIZE, TABLE_SCROLL_X } from '../skills-editor/battleSkillsEditorConstants';
import { useBattleSkillsEditor } from '../skills-editor/useBattleSkillsEditor';
import type { SkillFlatRow } from '../lib/skills/skillTableCodec';
import styles from './BattleSkillsEditor.module.css';

const { Summary } = Table;

function formatSavedAt(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function BattleSkillsEditorPage() {
  const {
    persistReady,
    rows,
    currentPage,
    setCurrentPage,
    lastSavedAt,
    columns,
    dataSource,
    addRow,
    handleClearTable,
    handleResetBuiltin,
    importFileInputRef,
    importSummary,
    handleExportSkills,
    handlePickImportFile,
    handleImportFileChange,
    handleCloseImportSummary,
  } = useBattleSkillsEditor();

  const tableScrollStyle = {
    '--battle-skills-table-min-width': `${TABLE_SCROLL_X}px`,
  } as CSSProperties;

  return (
    <div className={styles.root}>
      <Space direction="vertical" size="large" className={styles.stack}>
        <div className={styles.toolbar}>
          <div>
            <Typography.Title level={4} className={styles.title}>
              战斗技能配表
            </Typography.Title>
            <Typography.Text type="secondary">
              编辑后约 {AUTOSAVE_DEBOUNCE_MS / 1000} 秒自动写入本机；增删行会<strong>立即保存</strong>。前往{' '}
              <Link href="/simulation-system/battle">战斗模拟</Link>。
            </Typography.Text>
            <div className={styles.savedAtWrap}>
              <Typography.Text type="secondary" className={styles.savedAt}>
                {lastSavedAt != null ? `上次保存：${formatSavedAt(lastSavedAt)}` : '与已载入数据一致时尚未写入'}
              </Typography.Text>
            </div>
          </div>
          <Space wrap>
            <Button onClick={handleExportSkills} disabled={!persistReady}>
              导出配置
            </Button>
            <Button onClick={handlePickImportFile} disabled={!persistReady}>
              导入配置
            </Button>
            <input
              ref={importFileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className={styles.hiddenFileInput}
              onChange={handleImportFileChange}
              aria-hidden
            />
            <Button danger onClick={handleClearTable}>
              清除整张表格
            </Button>
            <Button danger onClick={handleResetBuiltin}>
              恢复内置默认
            </Button>
          </Space>
        </div>

        <BattleSkillsEditorHelpCollapse />

        <ImportSkillsSummaryModal
          open={importSummary != null && importSummary.failures.length > 0}
          totalInFile={importSummary?.total ?? 0}
          successCount={importSummary?.success ?? 0}
          failures={importSummary?.failures ?? []}
          onClose={handleCloseImportSummary}
        />

        <Spin spinning={!persistReady}>
          <Card size="small" className={styles.cardNoBodyPad}>
            <div className={styles.tableScroll} style={tableScrollStyle}>
              <Table<SkillFlatRow & { _idx: number }>
                size="small"
                rowKey="_idx"
                columns={columns}
                dataSource={dataSource}
                pagination={false}
                summary={() => (
                  <Summary>
                    <Summary.Row className={styles.summaryRow}>
                      <Summary.Cell index={0} align="center">
                        <Button
                          type="text"
                          size="small"
                          icon={<PlusOutlined className={styles.addRowIcon} />}
                          onClick={addRow}
                          aria-label="新增一行"
                          disabled={!persistReady}
                          className={styles.addRowButton}
                        />
                      </Summary.Cell>
                      <Summary.Cell index={1} colSpan={columns.length - 1}>
                        {' '}
                      </Summary.Cell>
                    </Summary.Row>
                  </Summary>
                )}
              />
            </div>
            <div className={styles.paginationBar}>
              <Pagination
                size="small"
                current={currentPage}
                pageSize={PAGE_SIZE}
                total={rows.length}
                showSizeChanger={false}
                hideOnSinglePage={false}
                showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`}
                onChange={(page) => setCurrentPage(page)}
                disabled={!persistReady}
              />
            </div>
          </Card>
        </Spin>
      </Space>
    </div>
  );
}
