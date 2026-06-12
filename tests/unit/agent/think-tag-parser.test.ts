import { ThinkTagParser } from '../../../src/lib/agent/think-tag-parser';

const THINK_OPEN = '<' + 'think' + '>';
const THINK_CLOSE = '<' + '/' + 'think' + '>';
const REDACTED_OPEN = '<' + 'redacted_reasoning' + '>';
const REDACTED_CLOSE = '<' + '/' + 'redacted_reasoning' + '>';

function parseAll(chunks: string[]) {
  const parser = new ThinkTagParser();
  const pieces: Array<{ kind: 'reasoning' | 'text'; content: string }> = [];
  for (const chunk of chunks) {
    for (const piece of parser.feed(chunk)) {
      pieces.push(piece);
    }
  }
  return pieces;
}

function join(pieces: ReturnType<typeof parseAll>, kind: 'reasoning' | 'text') {
  return pieces.filter((p) => p.kind === kind).map((p) => p.content).join('');
}

describe('ThinkTagParser', () => {
  it('splits a complete think block from one chunk', () => {
    const input = `Hello ${THINK_OPEN}inner${THINK_CLOSE} world`;
    const pieces = parseAll([input]);
    expect(join(pieces, 'text')).toBe('Hello  world');
    expect(join(pieces, 'reasoning')).toBe('inner');
  });

  it('handles think tags split across chunks', () => {
    const pieces = parseAll([
      'Hel',
      'lo ',
      THINK_OPEN.slice(0, 5),
      THINK_OPEN.slice(5) + 'rea',
      'soning' + THINK_CLOSE + ' world',
    ]);
    expect(join(pieces, 'text')).toBe('Hello  world');
    expect(join(pieces, 'reasoning')).toBe('reasoning');
  });

  it('supports redacted_reasoning tags', () => {
    const input = `Start ${REDACTED_OPEN}reasoning${REDACTED_CLOSE} end`;
    const pieces = parseAll([input]);
    expect(join(pieces, 'text')).toBe('Start  end');
    expect(join(pieces, 'reasoning')).toBe('reasoning');
  });

  it('passes through plain text without tags', () => {
    const pieces = parseAll(['Just plain text']);
    expect(join(pieces, 'text')).toBe('Just plain text');
    expect(join(pieces, 'reasoning')).toBe('');
  });
});
