import { buildLibraryReferenceSelections } from '../../../src/lib/agent/asset-emptiness';
import type { ReferenceFieldLite } from '../../../src/lib/utils/assetEmptiness';
import type { AssetRow } from '../../../src/lib/types/libraryAssets';

const fields: ReferenceFieldLite[] = [
  { id: 'f1', label: 'ID', orderIndex: 0 },
  { id: 'f2', label: 'IDDD', orderIndex: 1 },
  { id: 'f3', label: 'type', orderIndex: 2 },
];

describe('buildLibraryReferenceSelections', () => {
  it('returns one selection per non-empty cell across non-empty rows', () => {
    const assets: AssetRow[] = [
      { id: 'a1', libraryId: 'lib', name: 'Untitled', propertyValues: { f1: 'hsss', f2: 'vesss' }, rowIndex: 1 },
      { id: 'a2', libraryId: 'lib', name: 'Untitled', propertyValues: { f2: 'version4', f3: '12345' }, rowIndex: 2 },
      { id: 'a3', libraryId: 'lib', name: 'Untitled', propertyValues: { f3: 'int' }, rowIndex: 3 },
    ];

    const selections = buildLibraryReferenceSelections(assets, fields);

    expect(selections).toEqual([
      { assetId: 'a1', fieldId: 'f1', fieldLabel: 'ID', displayValue: 'hsss', rowIndex: 1 },
      { assetId: 'a1', fieldId: 'f2', fieldLabel: 'IDDD', displayValue: 'vesss', rowIndex: 1 },
      { assetId: 'a2', fieldId: 'f2', fieldLabel: 'IDDD', displayValue: 'version4', rowIndex: 2 },
      { assetId: 'a2', fieldId: 'f3', fieldLabel: 'type', displayValue: '12345', rowIndex: 2 },
      { assetId: 'a3', fieldId: 'f3', fieldLabel: 'type', displayValue: 'int', rowIndex: 3 },
    ]);
  });

  it('excludes fully empty rows and keeps UI row order', () => {
    const assets: AssetRow[] = [
      { id: 'a2', libraryId: 'lib', name: 'Untitled', propertyValues: { f1: 'second' }, rowIndex: 2 },
      { id: 'empty', libraryId: 'lib', name: 'Untitled', propertyValues: { f1: '', f2: null }, rowIndex: 3 },
      { id: 'a1', libraryId: 'lib', name: 'Untitled', propertyValues: { f1: 'first' }, rowIndex: 1 },
    ];

    const selections = buildLibraryReferenceSelections(assets, fields);

    expect(selections.map((s) => `${s.rowIndex}:${s.assetId}:${s.displayValue}`)).toEqual([
      '1:a1:first',
      '2:a2:second',
    ]);
  });

  it('returns an empty array when no rows have visible data', () => {
    const assets: AssetRow[] = [
      { id: 'a1', libraryId: 'lib', name: 'Untitled', propertyValues: {}, rowIndex: 1 },
      { id: 'a2', libraryId: 'lib', name: 'Untitled', propertyValues: { f1: '' }, rowIndex: 2 },
    ];

    expect(buildLibraryReferenceSelections(assets, fields)).toEqual([]);
  });
});
