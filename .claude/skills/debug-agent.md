---
name: debug-agent
description: How to debug agent system issues in keco-studio
whenToUse: Use when the agent behaves unexpectedly, tool calls fail, or the confirmation flow gets stuck
---

# Debug Agent System Issues

## Common Symptoms and Where to Look

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| Wrong tool called | LLM misguided by prompt rules | `src/lib/agent/prompts.ts` RULES section |
| Tool execution fails | Param validation or service error | Tool's `execute()` logic, Zod schema |
| Confirmation stuck | Pending action not resumed | `agent_pending_actions` table |
| Preview not shown | Missing `displayHint` or bad preview data | Tool `execute()` return value |
| SSE stream broken | API route error or timeout | Network tab, server logs |
| Write succeeds but UI stale | Missing cache invalidation | ToolResult `invalidateCache` field |

## Debug Data Sources

**Database tables (Supabase):**
- `agent_traces` — full execution traces per turn
- `agent_conversations` / `agent_messages` — conversation history and tool call content
- `agent_pending_actions` — suspended states awaiting user confirmation

**Browser DevTools:**
- Network tab → filter SSE → inspect event stream from `/api/agent-chat`
- Look for `tool_call`, `tool_result`, `confirmation_required`, `error` events

## Key Code Paths

```
User message
  → POST /api/agent-chat/route.ts
    → runAgentTurn() in core.ts
      → LLM call → tool resolution via resolveTool()
      → execute() or pause for confirmation
  → POST /api/agent-chat/confirm/route.ts (on user approve/reject)
    → resumeAgentTurn() → executeImport() for post_preview tools
```

| File | Role |
|------|------|
| `src/app/api/agent-chat/route.ts` | SSE entry, auth, context assembly |
| `src/lib/agent/core.ts` | ReAct loop, confirmation pausing |
| `src/app/api/agent-chat/confirm/route.ts` | Resume after user decision |
| `src/lib/agent/tools/index.ts` | `resolveTool()`, `allTools` registry |
| `src/lib/agent/workflows/index.ts` | Workflow registry (`allSkills`) |
| `src/lib/agent/confirmation.ts` | Pending action load/save |
| `src/lib/agent/conversation-store.ts` | Conversation and meta persistence |

## Quick Diagnostic Checklist

1. **Reproduce** — note the user message, page context (library/folder), and tool name called
2. **Check prompt rules** — does a RULE in `prompts.ts` conflict with expected behavior?
3. **Inspect tool params** — look at `agent_messages` for the assistant tool_call args
4. **Run tool logic locally** — unit test the tool's `execute()` with the same params
5. **Check confirmation state** — query `agent_pending_actions` for stuck rows
6. **Verify permissions** — `requiredPermission: 'editor'` blocks viewers silently via core.ts
7. **Check SSE events** — confirm the stream emits `done` or `error`, not hanging mid-turn

## Confirmation Mode Reference

- `pre_execute`: Pauses before `execute()`. User sees proposed args.
- `post_preview`: Runs `execute()` first (preview), pauses before `executeImport()`.
- `meta`: Confirms the meta-change itself (`set_conversation_option`).

`skipConfirmation` in conversation meta only affects `pre_execute` tools.
