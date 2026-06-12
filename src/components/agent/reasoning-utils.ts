/**
 * Helpers for rendering assistant reasoning duration labels.
 */

export function formatReasoningSeconds(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem > 0 ? `${minutes} 分 ${rem} 秒` : `${minutes} 分`;
}

export function reasoningDurationMs(
  startedAt?: number,
  endedAt?: number,
  now = Date.now()
): number | undefined {
  if (!startedAt) return undefined;
  const end = endedAt ?? now;
  return Math.max(0, end - startedAt);
}

export function reasoningLabel(
  startedAt: number | undefined,
  endedAt: number | undefined,
  isThinking: boolean,
  now = Date.now()
): string {
  if (!startedAt) return '深度思考';
  const ms = reasoningDurationMs(startedAt, endedAt, now);
  if (ms === undefined) return '深度思考';
  const duration = formatReasoningSeconds(ms);
  return isThinking ? `深度思考中（${duration}）` : `已深度思考（${duration}）`;
}
