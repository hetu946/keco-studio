import {
  buildReferenceSelectionForAsset,
  getAssetDisplayLabel,
} from '../../src/lib/utils/assetEmptiness';

describe('buildReferenceSelectionForAsset', () => {
  const fields = [
    { id: 'f-id', label: 'ID', orderIndex: 0 },
    { id: 'f-name', label: 'name', orderIndex: 1 },
    { id: 'f-type', label: 'type', orderIndex: 2 },
  ];

  it('picks first non-empty column by order', () => {
    expect(
      buildReferenceSelectionForAsset(
        'asset-1',
        { 'f-id': 'hsssssshssssss', 'f-type': 'int' },
        fields
      )
    ).toEqual({
      assetId: 'asset-1',
      fieldId: 'f-id',
      fieldLabel: 'ID',
      displayValue: 'hsssssshssssss',
    });
  });

  it('skips empty leading columns', () => {
    expect(
      buildReferenceSelectionForAsset('asset-4', { 'f-id': '', 'f-type': 'int' }, fields)
    ).toEqual({
      assetId: 'asset-4',
      fieldId: 'f-type',
      fieldLabel: 'type',
      displayValue: 'int',
    });
  });

  it('returns null when all columns are blank', () => {
    expect(buildReferenceSelectionForAsset('asset-2', { 'f-id': '', 'f-name': null }, fields)).toBeNull();
  });
});

describe('getAssetDisplayLabel', () => {
  it('returns first non-empty value in field order', () => {
    expect(getAssetDisplayLabel({ f1: '', f2: 'int' }, ['f1', 'f2'])).toBe('int');
  });
});
