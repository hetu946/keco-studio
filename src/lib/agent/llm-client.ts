/**
 * DeepSeek streaming client (OpenAI-compatible Chat Completions API).
 *
 * Parses the upstream SSE stream and re-yields normalized StreamChunk values.
 * Includes a single automatic retry with exponential backoff on transient
 * network / 5xx / 429 errors before the first chunk is read.
 */

import type { ChatMessage, OpenAITool, StreamChunk } from './types';

const DEEPSEEK_BASE = (process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

interface StreamLlmOptions {
  temperature?: number;
  maxTokens?: number;
  tools?: OpenAITool[];
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestStream(
  messages: ChatMessage[],
  options: StreamLlmOptions
): Promise<Response> {
  if (!DEEPSEEK_API_KEY) {
    throw new LlmError('DEEPSEEK_API_KEY is not configured.');
  }

  const body: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 4096,
    stream: true,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = 'auto';
    // v1: one tool call per turn keeps the ReAct loop simple.
    body.parallel_tool_calls = false;
  }

  return fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });
}

/**
 * Stream a chat completion from DeepSeek, yielding normalized chunks.
 */
export async function* streamLlm(
  messages: ChatMessage[],
  options: StreamLlmOptions = {}
): AsyncGenerator<StreamChunk> {
  let response: Response | null = null;
  let lastError: unknown = null;

  // Retry once on transient errors before any chunk is consumed.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await requestStream(messages, options);
      if (response.ok && response.body) break;

      const retriable = response.status >= 500 || response.status === 429;
      if (!retriable || attempt === 1) {
        const text = await response.text().catch(() => '');
        throw new LlmError(`DeepSeek request failed (${response.status}): ${text.slice(0, 500)}`);
      }
      lastError = new LlmError(`DeepSeek transient error (${response.status})`);
    } catch (err) {
      if (err instanceof LlmError && !`${err.message}`.includes('transient')) {
        // Non-retriable application error — rethrow immediately.
        if (attempt === 1) throw err;
      }
      lastError = err;
      if (attempt === 1) throw err;
    }
    await sleep(500 * (attempt + 1));
  }

  if (!response || !response.body) {
    throw lastError instanceof Error ? lastError : new LlmError('DeepSeek stream unavailable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by blank lines; process complete lines.
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!rawLine.startsWith('data:')) continue;

        const payload = rawLine.slice('data:'.length).trim();
        if (payload === '[DONE]') return;

        let parsed: DeepSeekChunk;
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }

        const choice = parsed.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta;

        if (delta?.content) {
          yield { type: 'text_delta', content: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            yield {
              type: 'tool_call_delta',
              index: tc.index ?? 0,
              id: tc.id,
              name: tc.function?.name,
              arguments: tc.function?.arguments,
            };
          }
        }

        if (choice.finish_reason) {
          yield {
            type: 'finish',
            reason: choice.finish_reason,
            usage: parsed.usage,
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Non-streaming convenience wrapper used by the import_script LLM conversion
 * step (it needs the full text before parsing, so streaming buys nothing there).
 */
export async function completeLlm(
  messages: ChatMessage[],
  options: StreamLlmOptions = {}
): Promise<string> {
  let text = '';
  for await (const chunk of streamLlm(messages, options)) {
    if (chunk.type === 'text_delta') text += chunk.content;
  }
  return text;
}

interface DeepSeekChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}
