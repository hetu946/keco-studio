import { normalizeFieldDataType } from '../../../src/lib/agent/field-data-type';

describe('normalizeFieldDataType', () => {
  it('accepts canonical data types', () => {
    expect(normalizeFieldDataType('int')).toBe('int');
    expect(normalizeFieldDataType('string')).toBe('string');
    expect(normalizeFieldDataType('boolean')).toBe('boolean');
  });

  it('maps common aliases', () => {
    expect(normalizeFieldDataType('integer')).toBe('int');
    expect(normalizeFieldDataType('Integer')).toBe('int');
    expect(normalizeFieldDataType('文本')).toBe('string');
    expect(normalizeFieldDataType('整数')).toBe('int');
  });

  it('returns null for unsupported types', () => {
    expect(normalizeFieldDataType('unknown')).toBeNull();
    expect(normalizeFieldDataType('')).toBeNull();
  });
});
