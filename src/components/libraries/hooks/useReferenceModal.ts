import { useState, useEffect, useCallback } from 'react';
import type { AssetRow, PropertyConfig } from '@/lib/types/libraryAssets';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReferenceDisplayCache,
  normalizeReferenceSelections,
  referenceSelectionsToValue,
  refreshReferenceDisplayCacheForAsset,
  type ReferenceSelection,
} from '@/lib/utils/referenceValue';

// Compatible interface for yRows (supports both Y.Array and mock objects)
interface YRowsLike {
  length: number;
  toArray: () => AssetRow[];
  insert: (index: number, content: AssetRow[]) => void;
  delete: (index: number, length: number) => void;
}

export type UseReferenceModalParams = {
  setNewRowData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  allRowsSource: AssetRow[];
  yRows: YRowsLike;
  onUpdateAsset?: (assetId: string, assetName: string, propertyValues: Record<string, any>) => Promise<void>;
  /** Rows used to build reference display cache (should match table/filter data). */
  cacheRows: AssetRow[];
  newRowData: Record<string, any>;
  properties: PropertyConfig[];
  editingCell: { rowId: string; propertyKey: string } | null;
  isAddingRow: boolean;
  supabase: SupabaseClient | null;
  setOptimisticEditUpdates: React.Dispatch<React.SetStateAction<Map<string, { name: string; propertyValues: Record<string, any> }>>>;
};

/**
 * useReferenceModal - Reference 选择弹窗：状态、assetNames 缓存、加载、打开/应用/关闭
 */
export function useReferenceModal(params: UseReferenceModalParams) {
  const {
    setNewRowData,
    allRowsSource,
    yRows,
    onUpdateAsset,
    cacheRows,
    newRowData,
    properties,
    editingCell,
    isAddingRow,
    supabase,
    setOptimisticEditUpdates,
  } = params;

  const [referenceModalOpen, setReferenceModalOpen] = useState(false);
  const [referenceModalProperty, setReferenceModalProperty] = useState<PropertyConfig | null>(null);
  const [referenceModalValue, setReferenceModalValue] = useState<unknown>(null);
  const [referenceModalRowId, setReferenceModalRowId] = useState<string | null>(null);
  const [assetNamesCache, setAssetNamesCache] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadAssetNames = async () => {
      if (!supabase) return;
      try {
        const namesMap = await buildReferenceDisplayCache(supabase, {
          rows: cacheRows,
          newRowData,
          properties,
          isAddingRow,
        });
        if (Object.keys(namesMap).length === 0) return;
        setAssetNamesCache((prev) => ({ ...prev, ...namesMap }));
      } catch (e) {
        console.error('Failed to load asset names:', e);
      }
    };
    loadAssetNames();
  }, [cacheRows, newRowData, properties, editingCell, isAddingRow, supabase]);

  const mergeAssetNamesCache = useCallback((patch: Record<string, string>) => {
    if (Object.keys(patch).length === 0) return;
    setAssetNamesCache((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const refreshFromSource = async (event: Event) => {
      const ev = event as CustomEvent<{ assetId?: string; fieldId?: string }>;
      if (!ev.detail?.assetId || !supabase) return;
      try {
        const patch = await refreshReferenceDisplayCacheForAsset(
          supabase,
          ev.detail.assetId,
          ev.detail.fieldId
        );
        if (Object.keys(patch).length === 0) return;
        setAssetNamesCache((prev) => ({ ...prev, ...patch }));
      } catch (e) {
        console.error('Failed to refresh asset name:', e);
      }
    };

    window.addEventListener('assetUpdated', refreshFromSource as EventListener);
    window.addEventListener('referenceSourceUpdated', refreshFromSource as EventListener);
    return () => {
      window.removeEventListener('assetUpdated', refreshFromSource as EventListener);
      window.removeEventListener('referenceSourceUpdated', refreshFromSource as EventListener);
    };
  }, [supabase]);

  const handleOpenReferenceModal = useCallback((property: PropertyConfig, currentValue: unknown, rowId: string) => {
    setReferenceModalProperty(property);
    setReferenceModalValue(currentValue);
    setReferenceModalRowId(rowId);
    setReferenceModalOpen(true);
  }, []);

  const handleApplyReference = useCallback(async (selections: ReferenceSelection[] | null) => {
    if (!referenceModalProperty || !referenceModalRowId) return;
    const normalizedSelections = normalizeReferenceSelections(selections);
    const nextValue = referenceSelectionsToValue(normalizedSelections);
    if (referenceModalRowId === 'new') {
      setNewRowData((prev) => ({ ...prev, [referenceModalProperty.key]: nextValue }));
    } else {
      const row = allRowsSource.find((r) => r.id === referenceModalRowId);
      if (row && onUpdateAsset) {
        const arr = yRows.toArray();
        const rowIndex = arr.findIndex((r) => r.id === referenceModalRowId);
        if (rowIndex >= 0) {
          const updatedPropertyValues: Record<string, any> = {
            ...row.propertyValues,
            [referenceModalProperty.key]: nextValue,
          };
          yRows.delete(rowIndex, 1);
          yRows.insert(rowIndex, [{ ...row, propertyValues: updatedPropertyValues }]);
        }
        const toSave: Record<string, any> = {
          ...row.propertyValues,
          [referenceModalProperty.key]: nextValue,
        };
        await onUpdateAsset(row.id, row.name, toSave);
      }
    }
    setReferenceModalOpen(false);
    setReferenceModalProperty(null);
    setReferenceModalValue(null);
    setReferenceModalRowId(null);
  }, [referenceModalProperty, referenceModalRowId, setNewRowData, allRowsSource, yRows, onUpdateAsset]);

  const handleCloseReferenceModal = useCallback(() => {
    setReferenceModalOpen(false);
    setReferenceModalProperty(null);
    setReferenceModalValue(null);
    setReferenceModalRowId(null);
  }, []);

  return {
    referenceModalOpen,
    referenceModalProperty,
    referenceModalValue,
    referenceModalRowId,
    assetNamesCache,
    mergeAssetNamesCache,
    handleOpenReferenceModal,
    handleApplyReference,
    handleCloseReferenceModal,
  };
}
