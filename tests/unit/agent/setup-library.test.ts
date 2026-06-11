import { groupFieldsBySection, type SetupFieldInput } from '../../../src/lib/agent/tools/setup-library';

describe('groupFieldsBySection', () => {
  it('groups fields by their section preserving order', () => {
    const fields: SetupFieldInput[] = [
      { label: 'ID', dataType: 'string', section: 'section1' },
      { label: 'HP', dataType: 'int', section: 'stats' },
      { label: 'Name', dataType: 'string', section: 'section1' },
    ];

    const grouped = groupFieldsBySection(fields);

    expect(Object.keys(grouped)).toEqual(['section1', 'stats']);
    expect(grouped.section1.map((f) => f.label)).toEqual(['ID', 'Name']);
    expect(grouped.stats.map((f) => f.label)).toEqual(['HP']);
  });

  it('defaults missing section to "section1"', () => {
    const fields: SetupFieldInput[] = [
      { label: 'ID', dataType: 'string' },
      { label: 'Name', dataType: 'string', section: '  ' },
    ];

    const grouped = groupFieldsBySection(fields);

    expect(Object.keys(grouped)).toEqual(['section1']);
    expect(grouped.section1.map((f) => f.label)).toEqual(['ID', 'Name']);
  });
});
