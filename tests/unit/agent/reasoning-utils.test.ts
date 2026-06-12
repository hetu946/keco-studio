import { formatReasoningSeconds, reasoningLabel } from '../../../src/components/agent/reasoning-utils';

describe('reasoning-utils', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(formatReasoningSeconds(500)).toBe('1 秒');
    expect(formatReasoningSeconds(3200)).toBe('3 秒');
  });

  it('formats minute durations', () => {
    expect(formatReasoningSeconds(65_000)).toBe('1 分 5 秒');
    expect(formatReasoningSeconds(120_000)).toBe('2 分');
  });

  it('shows in-progress and completed labels', () => {
    const start = 1_000;
    expect(reasoningLabel(start, undefined, true, 4_500)).toBe('深度思考中（4 秒）');
    expect(reasoningLabel(start, 4_000, false, 9_000)).toBe('已深度思考（3 秒）');
  });
});
