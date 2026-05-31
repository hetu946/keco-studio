import type { AssetRow, PropertyConfig } from '@/lib/types/libraryAssets';
import { valueToDisplayString } from '@/lib/utils/cellValueReplace';
import {
  evaluateFormulaForRow,
  getCustomFormulaExpressionFromCellValue,
} from '@/components/libraries/utils/formulaEvaluation';

/** Display string used as the filter key for a cell value. */
export function getFilterDisplayValue(
  row: AssetRow,
  property: PropertyConfig | undefined,
  allProperties: PropertyConfig[] = []
): string {
  if (!property) return '';

  if (property.dataType === 'formula') {
    const customExpr = getCustomFormulaExpressionFromCellValue(row.propertyValues[property.key]);
    const effectiveExpr = customExpr ?? property.formulaExpression;
    if (!effectiveExpr) return '';

    const result = evaluateFormulaForRow(effectiveExpr, row, allProperties);
    if (typeof result === 'boolean') return result ? 'true' : 'false';
    if (result === null || result === undefined) return '';
    return String(result);
  }

  return valueToDisplayString(row.propertyValues[property.key], property.dataType ?? '');
}

export function filterRowsByColumnFilters(
  rows: AssetRow[],
  columnFilters: Map<string, Set<string>>,
  properties: PropertyConfig[],
  excludePropertyId?: string
): AssetRow[] {
  if (columnFilters.size === 0) return rows;

  return rows.filter((row) => {
    for (const [propertyId, allowedValues] of columnFilters) {
      if (propertyId === excludePropertyId) continue;
      const property = properties.find((p) => p.id === propertyId);
      if (!property) continue;
      const display = getFilterDisplayValue(row, property, properties);
      if (!allowedValues.has(display)) return false;
    }
    return true;
  });
}

export function pruneColumnFilters(
  rows: AssetRow[],
  properties: PropertyConfig[],
  columnFilters: Map<string, Set<string>>
): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>();

  for (const [propertyId, allowedValues] of columnFilters) {
    const property = properties.find((p) => p.id === propertyId);
    if (!property) continue;

    const contextRows = filterRowsByColumnFilters(rows, columnFilters, properties, propertyId);
    const validValues = new Set(collectColumnUniqueValues(contextRows, property, properties));
    const pruned = new Set<string>();
    for (const value of allowedValues) {
      if (validValues.has(value)) pruned.add(value);
    }

    const allSelected =
      validValues.size > 0 &&
      pruned.size === validValues.size &&
      Array.from(validValues).every((value) => pruned.has(value));

    if (!allSelected) {
      next.set(propertyId, pruned);
    }
  }

  return next;
}

export function collectColumnUniqueValues(
  rows: AssetRow[],
  property: PropertyConfig | undefined,
  allProperties: PropertyConfig[]
): string[] {
  if (!property) return [];

  const values = new Set<string>();
  for (const row of rows) {
    values.add(getFilterDisplayValue(row, property, allProperties));
  }

  return Array.from(values).sort((a, b) => {
    if (a === '' && b !== '') return 1;
    if (b === '' && a !== '') return -1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function formatFilterValueLabel(value: string): string {
  return value === '' ? '(Blank)' : value;
}

export function getFilterValueInitial(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}
