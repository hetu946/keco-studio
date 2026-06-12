import type { PropertyConfig } from '@/lib/types/libraryAssets';

const CANONICAL_DATA_TYPES = [
  'string',
  'string_array',
  'int',
  'int_array',
  'float',
  'float_array',
  'boolean',
  'enum',
  'date',
  'reference',
  'multimedia',
  'audio',
  'formula',
] as const satisfies readonly PropertyConfig['dataType'][];

type CanonicalDataType = (typeof CANONICAL_DATA_TYPES)[number];

const ALIASES: Record<string, CanonicalDataType> = {
  integer: 'int',
  number: 'int',
  num: 'int',
  float: 'float',
  double: 'float',
  bool: 'boolean',
  text: 'string',
  str: 'string',
  文本: 'string',
  字符串: 'string',
  整数: 'int',
  整型: 'int',
  浮点: 'float',
  布尔: 'boolean',
  枚举: 'enum',
  日期: 'date',
  引用: 'reference',
  公式: 'formula',
};

export const SUPPORTED_FIELD_DATA_TYPES = CANONICAL_DATA_TYPES;

export function normalizeFieldDataType(input: string): PropertyConfig['dataType'] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase().replace(/\s+/g, '_');
  if ((CANONICAL_DATA_TYPES as readonly string[]).includes(lower)) {
    return lower as CanonicalDataType;
  }

  const alias = ALIASES[trimmed] ?? ALIASES[lower];
  return alias ?? null;
}
