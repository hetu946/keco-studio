# Keco-Studio Agent Design

**Date**: 2026-06-10  
**Status**: Draft  
**Scope**: keco-studio 专属 agent —— 应用内聊天窗 + 固定 tool 列表 + API 层操作 Supabase

---

## 1. Overview

keco-studio agent 是一个内嵌于应用的 AI 操作员，用户通过聊天面板下指令，agent 通过固定的 tool 列表直接调用 service 层和 Supabase 读写数据。

**核心原则：**

- **API 层操作**：agent 不碰 DOM，直接调 service / 写 Supabase
- **固定 tool 列表**：开发者硬编码 tool schema + handler，加新 tool 不改循环逻辑
- **危险操作需确认**：write 类 tool 执行前暂停，用户确认后才写入（可按对话跳过）
- **对话历史持久化**：支持断点恢复，上下文不丢失

**v1 能力范围：**

- 只读查询（assets、script lines、表数据）
- CRUD 操作（create / update / delete assets）
- Import script 转换（spec.md 中的 LLM 流水线封装为 tool）

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│  keco-studio UI                                 │
│  ┌──────────────────────┐  ┌─────────────────┐  │
│  │  现有页面             │  │  ChatPanel      │  │
│  │  (libraries, etc.)   │  │  (新增组件)      │  │
│  └──────────────────────┘  └───────┬─────────┘  │
└────────────────────────────────────┼────────────┘
                                     │ SSE / REST
                          ┌──────────▼──────────┐
                          │ /api/agent-chat     │
                          │ (新增 API route)     │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │  Agent Core                      │
                    │  ┌───────────┐  ┌────────────┐  │
                    │  │ LLM Client│  │ Tool Router│  │
                    │  │ (DeepSeek)│  │            │  │
                    │  └───────────┘  └─────┬──────┘  │
                    └───────────────────────┼─────────┘
                                            │
                    ┌───────────────────────┼─────────┐
                    │  Tool Handlers        │         │
                    │  ┌──────┐ ┌──────┐ ┌──┴───┐    │
                    │  │query │ │mutate│ │import│    │
                    │  │assets│ │CRUD  │ │script│    │
                    │  └──┬───┘ └──┬───┘ └──┬───┘    │
                    └─────┼────────┼────────┼────────┘
                          │        │        │
                    ┌─────▼────────▼────────▼────────┐
                    │  现有 Service 层 / Supabase     │
                    │  scriptImportService, etc.      │
                    └────────────────────────────────┘
```

### Layers

| Layer | Responsibility | Status |
|-------|---------------|--------|
| **ChatPanel** | Chat UI, message list, input, confirmation cards | New |
| **`/api/agent-chat`** | SSE streaming, auth, conversation management | New |
| **Agent Core** | ReAct loop, LLM calls, tool routing | New |
| **Tool Handlers** | Each tool's implementation, calls existing services | New |
| **Existing Services / Supabase** | Actual data operations | Reused |

### Data Flow (one typical request)

1. User types in ChatPanel → POST `/api/agent-chat` (with messages + conversationId)
2. API route starts Agent Core → calls DeepSeek (with tools definition)
3. DeepSeek returns tool_call → Agent Core routes to matching Tool Handler
4. If write tool → pause → push `confirmation_request` SSE event to frontend
5. User confirms → POST `/api/agent-chat/confirm` → Tool Handler executes → result back to Agent Core
6. Agent Core feeds tool result back to DeepSeek → DeepSeek returns text summary
7. Text summary streams via SSE to ChatPanel

---

## 3. Tool System

### Tool Interface

```typescript
// src/lib/agent/types.ts
interface AgentTool {
  name: string;              // e.g. "query_assets"
  description: string;       // Natural language description for LLM
  parameters: JSONSchema;    // JSON Schema for parameters
  category: "read" | "write"; // Determines if confirmation is needed
  execute: (params: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

interface ToolContext {
  userId: string;
  projectId: string;
  supabase: SupabaseClient;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  displayHint?: "table" | "text" | "list" | "script_preview"; // Frontend rendering hint
}
```

### v1 Tool List

| Tool | Category | Description |
|------|----------|-------------|
| `query_assets` | read | Query library assets by name, type, tag, etc. |
| `query_script_lines` | read | Query script lines and branch structure |
| `query_table` | read | Read-only query on specified table (restricted fields) |
| `create_asset` | write | Add a new asset to a library |
| `update_asset` | write | Modify an existing asset's fields |
| `delete_asset` | write | Delete an asset |
| `import_script` | write | LLM conversion + parseText + import (from spec.md pipeline) |
| `set_conversation_option` | write | Set conversation-level options (e.g. skipConfirmation) |

### Tool Registration

```typescript
// src/lib/agent/tools/index.ts
export const allTools: AgentTool[] = [
  queryAssets,
  createAsset,
  // ...
];

export function getToolsForLlm(): ChatCompletionTool[] {
  return allTools.map(t => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function resolveTool(name: string): AgentTool | undefined {
  return allTools.find(t => t.name === name);
}
```

Adding a new tool: **write one file → import → add to `allTools` array**. No changes to the ReAct loop.

---

## 4. Confirmation Flow

### Mechanism

Write tools pause before execution. A `confirmation_request` SSE event is pushed to the frontend. The frontend renders a confirmation card. User confirms or cancels via a new POST request.

### Pending Action Store

Server-side in-memory Map keyed by conversationId:

```typescript
interface PendingAction {
  id: string;                // uuid
  conversationId: string;
  toolName: string;
  args: unknown;
  createdAt: number;
  status: "pending" | "approved" | "rejected";
}
```

TTL: 30 minutes, then auto-cleaned.

### Sequence (Short Connection)

```
User: "Add a character Nova"
  │
  ▼ POST /api/agent-chat (SSE)
  │
Agent Core:
  ├─ LLM returns tool_call: create_asset({name: "Nova", type: "character"})
  ├─ category === "write" → create PendingAction
  ├─ SSE push: { type: "confirmation_request", actionId: "xxx", tool: "create_asset", args: {...} }
  ├─ SSE connection closes
  │
  ▼ Frontend renders confirmation card:
  │  "About to execute: create_asset
  │   Args: { name: 'Nova', type: 'character' }
  │   [Confirm] [Cancel]"
  │
  ▼ User clicks [Confirm]
  │
  ▼ POST /api/agent-chat/confirm  { actionId: "xxx", decision: "approve" }
  │
Agent Core:
  ├─ Load conversation history from store (full context restored)
  ├─ Execute tool → get result
  ├─ Feed result back to LLM
  ├─ LLM returns summary: "Created character Nova"
  └─ SSE push: { type: "text", content: "Created character Nova" }
```

### Context Recovery

Conversation history is persisted in `agent_conversations` + `agent_messages` tables. When user confirms and opens a new SSE connection, Agent Core loads the full history → rebuilds messages array → sends to DeepSeek → LLM has full context.

### Skip Confirmation

Per-conversation setting stored in conversation metadata:

```typescript
interface ConversationMeta {
  id: string;
  userId: string;
  skipConfirmation: boolean;
  projectId: string;
  createdAt: Date;
}
```

User triggers via chat: "skip confirmation" / "don't ask one by one" → LLM calls `set_conversation_option` tool → sets `skipConfirmation = true`.

---

## 5. Chat UI + Streaming

### ChatPanel Placement

Collapsible sidebar / floating panel in the layout layer:

```
┌──────────────────────────────────────────┐
│  keco-studio main UI                     │
│  (libraries, script editor, etc.)        │
│                                          │
│                              ┌─────────┐ │
│                              │ Chat    │ │
│                              │ Panel   │ │
│                              │         │ │
│                              │ [messages]
│                              │         │ │
│                              │ [confirm card]
│                              │         │ │
│                              │ [input] │ │
│                              └─────────┘ │
└──────────────────────────────────────────┘
```

### Message Types & Rendering

| Message Type | Rendering |
|-------------|-----------|
| `user_text` | Standard chat bubble |
| `assistant_text` | Markdown rendered (streaming, character by character) |
| `tool_call` | Collapsible card: tool name + args summary + status (running/success/failure) |
| `confirmation_request` | Card with [Confirm] [Cancel] buttons |
| `error` | Red alert + retry button |

### SSE Event Protocol

```typescript
type SSEEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; tool: string; args: string }
  | { type: "tool_call_end" }
  | { type: "tool_result"; tool: string; data: unknown; displayHint: string }
  | { type: "confirmation_request"; actionId: string; tool: string; args: unknown }
  | { type: "done" }
  | { type: "error"; message: string }
```

### Conversation Persistence (Supabase)

```sql
CREATE TABLE agent_conversations (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  project_id uuid REFERENCES projects(id),
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE agent_messages (
  id uuid PRIMARY KEY,
  conversation_id uuid REFERENCES agent_conversations(id),
  role text,           -- 'user' | 'assistant' | 'tool'
  content jsonb,       -- Full message body (including tool_calls, tool_results)
  created_at timestamptz DEFAULT now()
);
```

### Entry & Interaction

- Chat icon in layout top-right / sidebar, click to expand ChatPanel
- ChatPanel shows conversation history for current project (switchable)
- New conversation = new conversationId, bound to current projectId
- Input: Enter to send, Shift+Enter for newline

---

## 6. LLM Integration & ReAct Loop

### Agent Core Main Loop

```typescript
async function runAgentTurn(input: AgentTurnInput): AsyncGenerator<SSEEvent> {
  const messages = await loadConversationHistory(input.conversationId);
  messages.push({ role: "user", content: input.userMessage });

  let maxIterations = 10;

  while (maxIterations-- > 0) {
    const response = await callLlm(messages, getToolsForLlm());

    // 1. LLM returns text → stream to frontend, done
    if (response.finish_reason === "stop") {
      for await (const delta of streamText(response)) {
        yield { type: "text_delta", content: delta };
      }
      await saveMessage(input.conversationId, { role: "assistant", content: response.content });
      yield { type: "done" };
      return;
    }

    // 2. LLM returns tool_calls → process each
    if (response.finish_reason === "tool_calls") {
      await saveMessage(input.conversationId, { role: "assistant", tool_calls: response.tool_calls });

      for (const call of response.tool_calls) {
        const tool = resolveTool(call.function.name);

        // Write tool + confirmation not skipped → request confirmation
        if (tool.category === "write" && !input.conversationMeta.skipConfirmation) {
          const actionId = createPendingAction({ conversationId, tool, args: call.function.arguments });
          yield { type: "confirmation_request", actionId, tool: tool.name, args: call.function.arguments };
          await suspendConversation(input.conversationId, { pendingCall: call, messages });
          return; // Close SSE, wait for /api/agent-chat/confirm to resume
        }

        // Execute directly
        yield { type: "tool_call_start", tool: tool.name, args: call.function.arguments };
        const result = await tool.execute(parseArgs(call.function.arguments), toolContext);
        yield { type: "tool_result", tool: tool.name, data: result.data, displayHint: result.displayHint };

        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
  }

  yield { type: "error", message: "Agent reached maximum iterations" };
}
```

### Confirmation Resume Endpoint

```
POST /api/agent-chat/confirm
1. Read suspended state (pendingCall + messages)
2. If approved → execute tool → add tool_result to messages → restart runAgentTurn
3. If rejected → add "user cancelled" as tool_result → restart runAgentTurn
```

### LLM Client

```typescript
// src/lib/agent/llm-client.ts
// DeepSeek OpenAI-compatible API

async function callLlm(messages: ChatMessage[], tools: ChatCompletionTool[]) {
  const response = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [systemPrompt, ...messages],
      tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });
  return response.json();
}
```

### System Prompt

```text
You are Keco Assistant, an AI agent for the keco-studio Galgame script management system.

You help users manage their project data through tool calls. You can:
- Query assets, script lines, and table data
- Create, update, and delete assets
- Convert narrative text into standard import script format

RULES:
1. Always use tools to fetch real data before answering questions. Never fabricate data.
2. For write operations, explain what you're about to do before calling the tool.
3. If a tool call fails, explain the error and suggest alternatives.
4. Respond in the same language the user uses.
5. Be concise. Show data in structured format when appropriate.
6. Branch labels use letter O + digit (O1, O2, Oend), never 01, 02.
7. When the user says "skip confirmation" or equivalent, call set_conversation_option to enable skip mode.

CURRENT CONTEXT:
- Project: {projectName}
- Project ID: {projectId}
- Current library (if any): {libraryName}
```

---

## 7. Import Script Tool

### Position

`import_script` is a write tool in the agent, encapsulating the full pipeline from spec.md:

```
User pastes/inputs free text
    ↓
Agent calls import_script tool
    ↓
┌──────────────────────────────────────┐
│  import_script tool internals        │
│                                      │
│  1. Try parseText(raw) directly      │
│     → success → skip LLM            │
│  2. Failure → call DeepSeek to       │
│     convert to standard format       │
│  3. sanitize → parseText → validate  │
│  4. Validation fails → retry ≤2x    │
│     with error messages              │
│  5. Final result → pending → confirm │
│  6. Confirmed → scriptImportService  │
└──────────────────────────────────────┘
```

### Tool Schema

```json
{
  "name": "import_script",
  "description": "Convert free-form narrative text into keco-studio standard script format and import it as a library. Use this when the user pastes story text, wants to create a script from prose, or asks to import narrative content.",
  "parameters": {
    "type": "object",
    "properties": {
      "libraryName": { "type": "string", "description": "Name for the new library" },
      "sourceText": { "type": "string", "description": "The raw narrative text to convert" },
      "characterMapping": {
        "type": "object",
        "description": "Optional mapping of character names to types. e.g. {\"Atana\": 1, \"AI\": 2}",
        "additionalProperties": { "type": "number", "enum": [1, 2, 3, 5] }
      }
    },
    "required": ["libraryName", "sourceText"]
  }
}
```

### Relationship with Direct parseText

```
User inputs text
    │
    ├─ Via agent chat: "Help me import this story" → agent calls import_script tool
    │
    └─ Via ImportScriptModal: upload .txt file → existing flow unchanged
```

Both paths end at `parseText()` + `scriptImportService`. Agent path adds an LLM pre-conversion layer.

### Import Confirmation Special Handling

import_script is special — user needs to **preview the conversion result** before deciding:

```
Agent calls import_script
    ↓
Tool completes conversion → gets ScriptLine[]
    ↓
Returns displayHint: "script_preview"
data: {
  libraryName: "Chapter 1",
  lineCount: 45,
  dialogueCount: 38,
  optionCount: 3,
  previewLines: ScriptLine[],
  fullText: string,             // Standard format text, pasteable into modal for editing
  errors: string[]
}
    ↓
Frontend renders preview card:
┌─────────────────────────────────┐
│ Chapter 1                       │
│ 45 lines · 38 dialogues · 3 options
│ ┌─────────────────────────────┐ │
│ │ 【Start｜Afternoon...】     │ │
│ │ (Type3·Narrator) At three.. │ │
│ │ ...                         │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Edit in Import Modal]  [Import Directly]  [Cancel]
└─────────────────────────────────┘
```

- **[Edit in Import Modal]**: Fill fullText into existing ImportScriptModal textarea, user fine-tunes then imports
- **[Import Directly]**: Skip manual editing, import directly
- **[Cancel]**: Discard

---

## 8. Error Handling & Limits

### Error Layers

| Layer | Error Type | Handling |
|-------|-----------|---------|
| **LLM** | API timeout / rate limit / bad response | Auto retry 1x (exponential backoff); still fails → push `error` event |
| **Tool** | Execution failure (DB error, permission denied) | Return `{ success: false, error }` → feed to LLM → LLM explains to user |
| **Agent** | Infinite loop (N consecutive tool_calls with no text) | `maxIterations = 10` cutoff → push error + save context |
| **Confirmation** | User never confirms (pending action expires) | 30-min TTL, auto-clean; next message shows "unfinished action" prompt |

### Anti-Hallucination Guards

Each tool handler validates parameters internally:

```typescript
async function execute(params: unknown, ctx: ToolContext): Promise<ToolResult> {
  // 1. Schema validation (zod)
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
  }

  // 2. Business validation (library exists, asset type valid)
  const library = await findLibrary(ctx.supabase, ctx.projectId, parsed.data.libraryName);
  if (!library) {
    return { success: false, error: `Library "${parsed.data.libraryName}" not found. Available: ${availableList}` };
  }

  // 3. Execute
}
```

LLM receives `success: false` tool result and adapts — either corrects params and retries, or tells user "couldn't find that library, can you confirm the name?"

### Rate & Cost Limits

```typescript
interface RateLimits {
  maxTurnsPerMinute: 10;
  maxToolCallsPerTurn: 8;
  maxTokensPerDay: 500_000;
}
```

Exceeding limits returns a friendly message, not a raw error.

### Audit Traces

Every agent turn records a full trace:

```typescript
interface AgentTrace {
  conversationId: string;
  turnId: string;
  userMessage: string;
  llmCalls: Array<{
    input: ChatMessage[];
    output: ChatCompletion;
    latencyMs: number;
    tokenUsage: { prompt: number; completion: number };
  }>;
  toolCalls: Array<{
    tool: string;
    args: unknown;
    result: ToolResult;
    latencyMs: number;
  }>;
  confirmations: Array<{
    actionId: string;
    decision: "approved" | "rejected";
    latencyMs: number;
  }>;
  totalLatencyMs: number;
  createdAt: Date;
}
```

Stored in `agent_traces` table for debugging, cost tracking, and optimization analysis.

---

## 9. File Structure

### New Files

```
src/lib/agent/
├── types.ts                    # AgentTool, ToolContext, ToolResult, SSEEvent
├── core.ts                     # runAgentTurn — ReAct loop
├── llm-client.ts               # DeepSeek API wrapper (streaming + non-streaming)
├── confirmation.ts             # PendingAction store + suspend/resume
├── conversation-store.ts       # Conversation history read/write
├── prompts.ts                  # System prompt template
├── index.ts                    # Public entry
└── tools/
    ├── index.ts                # Tool registry
    ├── query-assets.ts
    ├── query-script-lines.ts
    ├── query-table.ts
    ├── create-asset.ts
    ├── update-asset.ts
    ├── delete-asset.ts
    ├── import-script.ts        # spec.md LLM conversion pipeline as tool
    └── set-conversation-option.ts

src/app/api/agent-chat/
├── route.ts                    # POST — SSE streaming response
└── confirm/
    └── route.ts                # POST — Confirm/cancel suspended action

src/components/agent/
├── ChatPanel.tsx               # Main panel (collapsible sidebar)
├── ChatMessage.tsx             # Message rendering (text/tool_call/confirmation/error)
├── ChatInput.tsx               # Input box
├── ConfirmationCard.tsx        # Confirmation action card
├── ToolCallCard.tsx            # Tool call status card
├── ScriptPreviewCard.tsx       # import_script preview card
├── ConversationList.tsx        # Conversation history list
├── useAgentChat.ts             # SSE connection + message state hook
└── types.ts                    # Frontend message types
```

### Database Changes

```sql
-- 3 new tables
agent_conversations    -- Conversation metadata
agent_messages         -- Message history (including tool_calls)
agent_traces           -- Audit traces
```

### Environment Variables

```bash
# .env.local additions
DEEPSEEK_API_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=sk-xxx
```

---

## 10. Implementation Phases

4 phases, each independently verifiable:

| Phase | Content | Validation |
|-------|---------|-----------|
| **Phase 1: Skeleton** | `agent/types.ts` + `llm-client.ts` + `core.ts` (no tools) + ChatPanel UI + SSE connection | Can type in ChatPanel, LLM streams reply |
| **Phase 2: Read tools** | `query_assets` + `query_script_lines` + `query_table` | "What characters are in this project?" returns real data |
| **Phase 3: Write tools + confirmation** | `create_asset` + `update_asset` + `delete_asset` + full confirmation flow | Create/update/delete assets go through confirmation, history recoverable |
| **Phase 4: Import script** | `import_script` tool + ScriptPreviewCard + integration with existing ImportScriptModal | Paste prose → preview → import success |

Each phase follows TDD: write tests first, then implement.
