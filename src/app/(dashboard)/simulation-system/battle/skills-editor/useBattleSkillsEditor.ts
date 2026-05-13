'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Modal, message } from 'antd';
import {
  clearBattleSkillsStorage,
  loadBattleSkillsFromPersistence,
  saveBattleSkillsToStorage,
} from '../lib/skills/battleSkillsStorage';
import {
  importSkillItemsFromArray,
  mergeImportedSkillsIntoFlatRows,
  type ImportSkillFailure,
} from '../lib/skills/battleSkillsImportExport';
import { parseBattleSkillsXlsxToSkillItems } from '../lib/skills/battleSkillsImportXlsx';
import { buildBattleSkillsXlsxBuffer, downloadBattleSkillsXlsx } from '../lib/skills/battleSkillsExportXlsx';
import { getBuiltinSkills } from '../data/skills';
import {
  collectValidSkillsFromRows,
  emptySkillFlatRow,
  skillsToFlatRows,
  type SkillFlatRow,
} from '../lib/skills/skillTableCodec';
import { AUTOSAVE_DEBOUNCE_MS, PAGE_SIZE } from './battleSkillsEditorConstants';
import { createBattleSkillsTableColumns } from './createBattleSkillsTableColumns';

export function useBattleSkillsEditor() {
  const [persistReady, setPersistReady] = useState(false);
  const [rows, setRows] = useState<SkillFlatRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const lastSavedSigRef = useRef<string | null>(null);
  const pendingJumpToLastPageRef = useRef(false);
  const rowsRef = useRef(rows);
  const debounceTimerRef = useRef<number | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    success: number;
    failures: ImportSkillFailure[];
  } | null>(null);

  rowsRef.current = rows;

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const flushSaveFlatRows = useCallback(
    (flatRows: SkillFlatRow[]) => {
      clearDebounceTimer();
      const skills = collectValidSkillsFromRows(flatRows);
      const sig = JSON.stringify(skills);
      saveBattleSkillsToStorage(skills);
      lastSavedSigRef.current = sig;
      setLastSavedAt(Date.now());
    },
    [clearDebounceTimer],
  );

  useEffect(() => {
    let cancelled = false;
    void loadBattleSkillsFromPersistence().then((skills) => {
      if (cancelled) return;
      const next = skillsToFlatRows(skills);
      setRows(next);
      lastSavedSigRef.current = JSON.stringify(collectValidSkillsFromRows(next));
      setCurrentPage(1);
      setPersistReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (pendingJumpToLastPageRef.current) {
      pendingJumpToLastPageRef.current = false;
      setCurrentPage(maxPage);
      return;
    }
    setCurrentPage((p) => Math.min(p, maxPage));
  }, [rows.length]);

  useEffect(() => {
    if (!persistReady || lastSavedSigRef.current === null) return;

    clearDebounceTimer();
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      const flat = rowsRef.current;
      const skills = collectValidSkillsFromRows(flat);
      const sig = JSON.stringify(skills);
      if (sig === lastSavedSigRef.current) return;
      saveBattleSkillsToStorage(skills);
      lastSavedSigRef.current = sig;
      setLastSavedAt(Date.now());
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      clearDebounceTimer();
    };
  }, [rows, clearDebounceTimer, persistReady]);

  const updateRow = useCallback((index: number, patch: Partial<SkillFlatRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }, []);

  const addRow = useCallback(() => {
    pendingJumpToLastPageRef.current = true;
    setRows((prev) => {
      const next = [...prev, emptySkillFlatRow()];
      flushSaveFlatRows(next);
      return next;
    });
  }, [flushSaveFlatRows]);

  const removeRow = useCallback(
    (index: number) => {
      setRows((prev) => {
        const next = prev.filter((_, i) => i !== index);
        flushSaveFlatRows(next);
        return next;
      });
    },
    [flushSaveFlatRows],
  );

  const handleResetBuiltin = useCallback(async () => {
    clearDebounceTimer();
    await clearBattleSkillsStorage();
    const builtin = getBuiltinSkills();
    const flat = skillsToFlatRows(builtin);
    setRows(flat);
    lastSavedSigRef.current = JSON.stringify(builtin);
    setLastSavedAt(null);
    setCurrentPage(1);
    message.success('已恢复内置技能并清除本地配表');
  }, [clearDebounceTimer]);

  const handleClearTable = useCallback(() => {
    Modal.confirm({
      title: '清除整张表格？',
      content:
        '将删除所有行并立即写入本机。战斗页将暂无可用技能，直至你重新添加行或点击「恢复内置默认」。',
      okText: '清除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        clearDebounceTimer();
        setRows([]);
        flushSaveFlatRows([]);
        setCurrentPage(1);
        message.success('已清空表格');
      },
    });
  }, [clearDebounceTimer, flushSaveFlatRows]);

  const handleExportSkills = useCallback(() => {
    const skills = collectValidSkillsFromRows(rowsRef.current);
    const buf = buildBattleSkillsXlsxBuffer(skills);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '-');
    downloadBattleSkillsXlsx(`battle-skills-export-${stamp}.xlsx`, buf);
    message.success(`已导出 ${skills.length} 条有效技能为 Excel（.xlsx）`);
  }, []);

  const handlePickImportFile = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (!(result instanceof ArrayBuffer)) {
          message.error('读取文件失败');
          return;
        }
        const buf = new Uint8Array(result);
        let items: unknown[];
        try {
          items = parseBattleSkillsXlsxToSkillItems(buf);
        } catch (err) {
          message.error(err instanceof Error ? err.message : 'Excel 解析失败');
          return;
        }
        if (items.length === 0) {
          message.error('未找到数据行（除表头外至少填写 id、名称）');
          return;
        }
        const { successes, failures } = importSkillItemsFromArray(items);

        if (successes.length > 0) {
          setRows((prev) => {
            const merged = mergeImportedSkillsIntoFlatRows(prev, successes);
            flushSaveFlatRows(merged);
            return merged;
          });
          message.success(`成功导入 ${successes.length} 条技能`);
        } else if (failures.length > 0) {
          message.warning('未导入任何技能，请查看失败原因');
        }

        if (failures.length > 0) {
          setImportSummary({
            total: items.length,
            success: successes.length,
            failures,
          });
        } else {
          setImportSummary(null);
        }
      };
      reader.onerror = () => {
        message.error('读取文件失败');
      };
      reader.readAsArrayBuffer(file);
    },
    [flushSaveFlatRows],
  );

  const handleCloseImportSummary = useCallback(() => {
    setImportSummary(null);
  }, []);

  const columns = useMemo(
    () => createBattleSkillsTableColumns({ updateRow, removeRow, editorDisabled: !persistReady }),
    [updateRow, removeRow, persistReady],
  );

  const start = (currentPage - 1) * PAGE_SIZE;
  const dataSource = rows.slice(start, start + PAGE_SIZE).map((row, i) => ({
    ...row,
    _idx: start + i,
  }));

  return {
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
  };
}
