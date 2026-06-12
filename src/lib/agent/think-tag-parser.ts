/**
 * Incrementally splits LLM content deltas that embed reasoning inside
 * think / redacted_reasoning XML-style tags.
 */

const THINK_OPEN = '<' + 'think' + '>';
const THINK_CLOSE = '<' + '/' + 'think' + '>';
const REDACTED_OPEN = '<' + 'redacted_reasoning' + '>';
const REDACTED_CLOSE = '<' + '/' + 'redacted_reasoning' + '>';

const OPEN_TAGS = [THINK_OPEN, REDACTED_OPEN] as const;
const CLOSE_TAGS = [THINK_CLOSE, REDACTED_CLOSE] as const;

function findPartialTagSuffix(s: string, tags: readonly string[]): number {
  for (const tag of tags) {
    for (let len = Math.min(s.length, tag.length - 1); len >= 1; len--) {
      if (tag.startsWith(s.slice(-len))) return len;
    }
  }
  return 0;
}

function findEarliest(input: string, from: number, needles: readonly string[]): number {
  let best = -1;
  for (const needle of needles) {
    const idx = input.indexOf(needle, from);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

export type ThinkParsePiece = { kind: 'reasoning' | 'text'; content: string };

export class ThinkTagParser {
  private insideThink = false;
  private carry = '';

  /** Feed a content delta; yields visible text and reasoning segments separately. */
  *feed(chunk: string): Generator<ThinkParsePiece> {
    let input = this.carry + chunk;
    this.carry = '';

    let i = 0;
    while (i < input.length) {
      if (!this.insideThink) {
        const openIdx = findEarliest(input, i, OPEN_TAGS);
        if (openIdx === -1) {
          const rest = input.slice(i);
          const partial = findPartialTagSuffix(rest, OPEN_TAGS);
          if (partial > 0) {
            const emit = rest.slice(0, rest.length - partial);
            if (emit) yield { kind: 'text', content: emit };
            this.carry = rest.slice(rest.length - partial);
          } else if (rest) {
            yield { kind: 'text', content: rest };
          }
          return;
        }
        if (openIdx > i) yield { kind: 'text', content: input.slice(i, openIdx) };
        const matchedOpen = OPEN_TAGS.find((t) => input.startsWith(t, openIdx))!;
        this.insideThink = true;
        i = openIdx + matchedOpen.length;
      } else {
        const closeIdx = findEarliest(input, i, CLOSE_TAGS);
        if (closeIdx === -1) {
          const rest = input.slice(i);
          const partial = findPartialTagSuffix(rest, CLOSE_TAGS);
          if (partial > 0) {
            const emit = rest.slice(0, rest.length - partial);
            if (emit) yield { kind: 'reasoning', content: emit };
            this.carry = rest.slice(rest.length - partial);
          } else if (rest) {
            yield { kind: 'reasoning', content: rest };
          }
          return;
        }
        if (closeIdx > i) yield { kind: 'reasoning', content: input.slice(i, closeIdx) };
        const matchedClose = CLOSE_TAGS.find((t) => input.startsWith(t, closeIdx))!;
        this.insideThink = false;
        i = closeIdx + matchedClose.length;
      }
    }
  }
}
