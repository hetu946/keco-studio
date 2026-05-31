import { useCallback, useMemo, useState } from 'react';
import type { AssetRow, PropertyConfig } from '@/lib/types/libraryAssets';
import {
  filterRowsByColumnFilters,
  getFilterDisplayValue,
  pruneColumnFilters,
} from '@/lib/utils/columnValueFilter';

export function useColumnValueFilters(rows: AssetRow[], properties: PropertyConfig[]) {
  const [columnFilters, setColumnFilters] = useState<Map<string, Set<string>>>(new Map());

  const filteredRows = useMemo(() => {
    return filterRowsByColumnFilters(rows, columnFilters, properties);
  }, [rows, columnFilters, properties]);

  const applyColumnFilter = useCallback(
    (propertyId: string, selectedValues: Set<string>, allValues: Set<string>) => {
      setColumnFilters((prev) => {
        const next = new Map(prev);
        const allSelected =
          allValues.size === selectedValues.size &&
          Array.from(allValues).every((value) => selectedValues.has(value));

        if (allSelected) {
          next.delete(propertyId);
        } else {
          next.set(propertyId, new Set(selectedValues));
        }

        return pruneColumnFilters(rows, properties, next);
      });
    },
    [rows, properties]
  );

  const isColumnFiltered = useCallback(
    (propertyId: string) => columnFilters.has(propertyId),
    [columnFilters]
  );

  const getAppliedFilterValues = useCallback(
    (propertyId: string) => columnFilters.get(propertyId),
    [columnFilters]
  );

  const getRowsForColumnFilter = useCallback(
    (propertyId: string) => filterRowsByColumnFilters(rows, columnFilters, properties, propertyId),
    [rows, columnFilters, properties]
  );

  return {
    filteredRows,
    applyColumnFilter,
    isColumnFiltered,
    getAppliedFilterValues,
    getRowsForColumnFilter,
  };
}
