import { useCallback, useMemo, useState } from 'react';
import type { AssetRow, PropertyConfig } from '@/lib/types/libraryAssets';
import {
  applyColumnFilterByRowIds,
  buildPropertyById,
  createEmptyRowVisibilityFilterState,
  filterRowsByVisibility,
  getCheckedFilterValuesForColumn,
  isColumnFilterActive,
  type ColumnFilterOptions,
} from '@/lib/utils/columnValueFilter';

export function useColumnValueFilters(
  rows: AssetRow[],
  properties: PropertyConfig[],
  assetNamesCache: Record<string, string> = {}
) {
  const filterOptions: ColumnFilterOptions = { assetNamesCache };
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
        applyColumnFilterByRowIds(rows, property, selectedValues, prev, properties, filterOptions)
      );
    },
    [rows, properties, propertyById, assetNamesCache]
  );

  const isColumnFiltered = useCallback(
    (propertyId: string) => {
      const property = propertyById.get(propertyId);
      if (!property) return false;
      return isColumnFilterActive(rows, property, hiddenRowIds, properties, filterOptions);
    },
    [rows, hiddenRowIds, properties, propertyById, assetNamesCache]
  );

  const getCheckedFilterValues = useCallback(
    (propertyId: string) => {
      const property = propertyById.get(propertyId);
      if (!property) return new Set<string>();
      return getCheckedFilterValuesForColumn(
        rows,
        property,
        hiddenRowIds,
        properties,
        filterOptions
      );
    },
    [rows, hiddenRowIds, properties, propertyById, assetNamesCache]
  );

  return {
    filteredRows,
    applyColumnFilter,
    isColumnFiltered,
    getCheckedFilterValues,
  };
}
