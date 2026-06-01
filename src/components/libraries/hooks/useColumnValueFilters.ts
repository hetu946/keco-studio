import { useCallback, useMemo, useState } from 'react';
import type { AssetRow, PropertyConfig } from '@/lib/types/libraryAssets';
import {
  applyColumnFilterByRowIds,
  buildPropertyById,
  createEmptyRowVisibilityFilterState,
  filterRowsByVisibility,
  getCheckedFilterValuesForColumn,
  isColumnFilterActive,
} from '@/lib/utils/columnValueFilter';

export function useColumnValueFilters(rows: AssetRow[], properties: PropertyConfig[]) {
  const [hiddenRowIds, setHiddenRowIds] = useState<Set<string>>(
    () => createEmptyRowVisibilityFilterState().hiddenRowIds
  );

  const propertyById = useMemo(() => buildPropertyById(properties), [properties]);

  const filteredRows = useMemo(() => {
    return filterRowsByVisibility(rows, hiddenRowIds);
  }, [rows, hiddenRowIds]);

  const applyColumnFilter = useCallback(
    (propertyId: string, selectedValues: Set<string>, _allValues: Set<string>) => {
      const property = propertyById.get(propertyId);
      if (!property) return;

      setHiddenRowIds((prev) =>
        applyColumnFilterByRowIds(rows, property, selectedValues, prev, properties)
      );
    },
    [rows, properties, propertyById]
  );

  const isColumnFiltered = useCallback(
    (propertyId: string) => {
      const property = propertyById.get(propertyId);
      if (!property) return false;
      return isColumnFilterActive(rows, property, hiddenRowIds, properties);
    },
    [rows, hiddenRowIds, properties, propertyById]
  );

  const getCheckedFilterValues = useCallback(
    (propertyId: string) => {
      const property = propertyById.get(propertyId);
      if (!property) return new Set<string>();
      return getCheckedFilterValuesForColumn(rows, property, hiddenRowIds, properties);
    },
    [rows, hiddenRowIds, properties, propertyById]
  );

  return {
    filteredRows,
    applyColumnFilter,
    isColumnFiltered,
    getCheckedFilterValues,
  };
}
