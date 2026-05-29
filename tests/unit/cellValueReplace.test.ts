import {
  applyCellValueReplace,
  findNormalizedMatchSpan,
  valueToDisplayString,
} from '@/lib/utils/cellValueReplace';

describe('cellValueReplace reference fields', () => {
  it('matches and replaces text in reference displayValue', () => {
    const currentValue = [
      {
        assetId: 'asset-1',
        fieldId: 'field-notes',
        displayValue: 'Alpha findToken value',
      },
    ];

    expect(findNormalizedMatchSpan(valueToDisplayString(currentValue, 'reference'), 'findToken')).not.toBeNull();

    const result = applyCellValueReplace({
      currentValue,
      dataType: 'reference',
      find: 'findToken',
      replace: 'replacedToken',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.afterDisplay).toContain('replacedToken');
    expect(result.afterDisplay).not.toContain('findToken');
    expect(result.newValue).toEqual([
      expect.objectContaining({
        assetId: 'asset-1',
        displayValue: 'Alpha replacedToken value',
      }),
    ]);
  });

  it('rejects reference cells with no matching displayValue', () => {
    const result = applyCellValueReplace({
      currentValue: [{ assetId: 'a1', displayValue: 'no match here' }],
      dataType: 'reference',
      find: 'missing',
      replace: 'x',
    });
    expect(result.ok).toBe(false);
  });
});
