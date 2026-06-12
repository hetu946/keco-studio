'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/lib/SupabaseContext';
import { getActiveSectionName } from '@/lib/agent/page-context';
import type { ChatItem, SendContext } from './types';

let idCounter = 0;
const nextId = () => `item_${Date.now()}_${idCounter++}`;

interface ParsedSSE {
  type: string;
  [key: string]: unknown;
}

/**
 * Manages the agent conversation: SSE streaming, message state, confirmation
 * round-trips, and cache invalidation after writes.
 */
export function useAgentChat(ctx: SendContext) {
  const supabase = useSupabase();
  const router = useRouter();

  const [items, setItems] = useState<ChatItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const streamingAssistantIdRef = useRef<string | null>(null);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);

  const setConv = (id: string | undefined) => {
    conversationIdRef.current = id;
    setConversationId(id);
  };

  const appendItem = useCallback((item: ChatItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<ChatItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const invalidateCaches = useCallback(
    async (paths: string[]) => {
      try {
        const { globalRequestCache } = await import('@/lib/hooks/useRequestCache');
        for (const libraryId of paths) {
          globalRequestCache.invalidate(`library:${libraryId}`);
          globalRequestCache.invalidate(`library:info:${libraryId}`);
          globalRequestCache.invalidate(`assets:list:${libraryId}`);
          globalRequestCache.invalidate(`field-definitions:${libraryId}`);
        }
      } catch {
        // best-effort
      }
      // Let any open library page reload its data, then refresh server components.
      window.dispatchEvent(new CustomEvent('agent:data-updated', { detail: { paths } }));
      router.refresh();
    },
    [router]
  );

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  }, [supabase]);

  /**
   * Consume an SSE stream from a Response, mutating chat state as events arrive.
   */
  const consumeStream = useCallback(
    async (response: Response) => {
      const convHeader = response.headers.get('X-Conversation-Id');
      if (convHeader) setConv(convHeader);

      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      // Track the active assistant text bubble and the active tool-call card.
      let assistantId: string | null = null;
      let toolCallId: string | null = null;

      const ensureAssistantBubble = () => {
        if (!assistantId) {
          assistantId = nextId();
          streamingAssistantIdRef.current = assistantId;
          setStreamingAssistantId(assistantId);
          appendItem({ id: assistantId, role: 'assistant' });
        }
        return assistantId;
      };

      const handleEvent = (event: ParsedSSE) => {
        switch (event.type) {
          case 'reasoning_delta': {
            const delta = String(event.content ?? '');
            const id = ensureAssistantBubble();
            const now = Date.now();
            setItems((prev) =>
              prev.map((it) => {
                if (it.id !== id) return it;
                return {
                  ...it,
                  reasoning: (it.reasoning ?? '') + delta,
                  reasoningStartedAt: it.reasoningStartedAt ?? now,
                };
              })
            );
            break;
          }
          case 'text_delta': {
            const delta = String(event.content ?? '');
            const id = ensureAssistantBubble();
            const now = Date.now();
            setItems((prev) =>
              prev.map((it) => {
                if (it.id !== id) return it;
                const patch: Partial<ChatItem> = { text: (it.text ?? '') + delta };
                if (it.reasoning && !it.reasoningEndedAt) {
                  patch.reasoningEndedAt = now;
                }
                return { ...it, ...patch };
              })
            );
            break;
          }
          case 'tool_call_start': {
            assistantId = null;
            streamingAssistantIdRef.current = null;
            setStreamingAssistantId(null);
            toolCallId = nextId();
            appendItem({
              id: toolCallId,
              role: 'tool',
              toolCall: { tool: String(event.tool ?? ''), args: String(event.args ?? ''), status: 'running' },
            });
            break;
          }
          case 'tool_call_end': {
            break;
          }
          case 'tool_result': {
            if (toolCallId) {
              updateItem(toolCallId, {
                toolCall: {
                  tool: String(event.tool ?? ''),
                  status: 'success',
                  data: event.data,
                  displayHint: event.displayHint ? String(event.displayHint) : undefined,
                },
              });
            }
            break;
          }
          case 'confirmation_request': {
            assistantId = null;
            streamingAssistantIdRef.current = null;
            setStreamingAssistantId(null);
            appendItem({
              id: nextId(),
              role: 'confirmation',
              confirmation: {
                actionId: String(event.actionId ?? ''),
                tool: String(event.tool ?? ''),
                args: event.args,
                confirmationMode: (event.confirmationMode as ConfirmationModeValue) ?? 'pre_execute',
                preview: event.preview,
              },
            });
            break;
          }
          case 'cache_invalidated': {
            const paths = Array.isArray(event.paths) ? (event.paths as string[]) : [];
            void invalidateCaches(paths);
            break;
          }
          case 'error': {
            assistantId = null;
            streamingAssistantIdRef.current = null;
            setStreamingAssistantId(null);
            appendItem({ id: nextId(), role: 'error', error: String(event.message ?? 'Unknown error') });
            break;
          }
          case 'done':
            break;
          default:
            break;
        }
      };

      const finalizeStreamingAssistant = () => {
        const id = streamingAssistantIdRef.current;
        if (!id) return;
        const now = Date.now();
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id || !it.reasoning) return it;
            const patch: Partial<ChatItem> = {};
            if (!it.reasoningStartedAt) patch.reasoningStartedAt = now;
            if (!it.reasoningEndedAt) patch.reasoningEndedAt = now;
            return Object.keys(patch).length ? { ...it, ...patch } : it;
          })
        );
        streamingAssistantIdRef.current = null;
        setStreamingAssistantId(null);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!frame.startsWith('data:')) continue;
          const payload = frame.slice('data:'.length).trim();
          try {
            handleEvent(JSON.parse(payload) as ParsedSSE);
          } catch {
            // ignore malformed frame
          }
        }
      }
      finalizeStreamingAssistant();
    },
    [appendItem, updateItem, invalidateCaches]
  );

  const send = useCallback(
    async (message: string) => {
      if (isStreaming || !message.trim()) return;
      appendItem({ id: nextId(), role: 'user', text: message });
      setIsStreaming(true);
      abortRef.current = new AbortController();
      try {
        const token = await getToken();
        const response = await fetch('/api/agent-chat', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            conversationId: conversationIdRef.current,
            projectId: ctx.projectId,
            message,
            currentFolderId: ctx.currentFolderId,
            currentFolderName: ctx.currentFolderName,
            currentLibraryId: ctx.currentLibraryId,
            currentLibraryName: ctx.currentLibraryName,
            currentSectionName: ctx.currentSectionName ?? getActiveSectionName(ctx.currentLibraryId),
          }),
          signal: abortRef.current.signal,
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Request failed' }));
          appendItem({ id: nextId(), role: 'error', error: err.error || `Request failed (${response.status})` });
          return;
        }
        await consumeStream(response);
      } catch (e) {
        appendItem({ id: nextId(), role: 'error', error: (e as Error).message || 'Network error' });
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, appendItem, getToken, ctx, consumeStream]
  );

  const confirm = useCallback(
    async (actionId: string, decision: 'approve' | 'reject') => {
      if (isStreaming) return;
      // Mark the confirmation card as resolved.
      setItems((prev) =>
        prev.map((it) =>
          it.confirmation?.actionId === actionId
            ? { ...it, confirmation: { ...it.confirmation, resolved: decision === 'approve' ? 'approved' : 'rejected' } }
            : it
        )
      );
      setIsStreaming(true);
      abortRef.current = new AbortController();
      try {
        const token = await getToken();
        const response = await fetch('/api/agent-chat/confirm', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            actionId,
            decision,
            currentFolderId: ctx.currentFolderId,
            currentFolderName: ctx.currentFolderName,
            currentLibraryId: ctx.currentLibraryId,
            currentLibraryName: ctx.currentLibraryName,
            currentSectionName: ctx.currentSectionName ?? getActiveSectionName(ctx.currentLibraryId),
          }),
          signal: abortRef.current.signal,
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Request failed' }));
          appendItem({ id: nextId(), role: 'error', error: err.error || `Request failed (${response.status})` });
          return;
        }
        await consumeStream(response);
      } catch (e) {
        appendItem({ id: nextId(), role: 'error', error: (e as Error).message || 'Network error' });
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, getToken, ctx, consumeStream, appendItem]
  );

  const startNewConversation = useCallback(() => {
    abortRef.current?.abort();
    setConv(undefined);
    setItems([]);
    setIsStreaming(false);
  }, []);

  const loadConversation = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      setConv(id);
      setItems([]);
      try {
        const token = await getToken();
        const res = await fetch(`/api/agent-chat/conversations/${id}/messages?limit=200`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return;
        const { messages } = (await res.json()) as {
          messages: Array<{ id: string; role: string; content: Record<string, unknown> }>;
        };
        const loaded: ChatItem[] = [];
        for (const m of messages) {
          const body = (m.content ?? {}) as Record<string, unknown>;
          const text = typeof body.content === 'string' ? body.content : '';
          if (m.role === 'user' && text) {
            loaded.push({ id: m.id, role: 'user', text });
          } else if (m.role === 'assistant' && text && !body.tool_calls) {
            loaded.push({ id: m.id, role: 'assistant', text });
          } else if (m.role === 'tool') {
            // Show a compact tool result card from history.
            let data: unknown;
            try {
              data = typeof text === 'string' ? JSON.parse(text) : text;
            } catch {
              data = text;
            }
            const toolName = Array.isArray(body.tool_calls) ? '' : '';
            loaded.push({
              id: m.id,
              role: 'tool',
              toolCall: { tool: toolName || 'tool', status: 'success', data },
            });
          }
        }
        setItems(loaded);
      } catch {
        // ignore
      }
    },
    [getToken]
  );

  const appendNote = useCallback(
    (text: string) => {
      appendItem({ id: nextId(), role: 'assistant', text });
    },
    [appendItem]
  );

  return {
    items,
    isStreaming,
    streamingAssistantId,
    conversationId,
    send,
    confirm,
    startNewConversation,
    loadConversation,
    appendNote,
  };
}

type ConfirmationModeValue = 'pre_execute' | 'post_preview' | 'meta';
