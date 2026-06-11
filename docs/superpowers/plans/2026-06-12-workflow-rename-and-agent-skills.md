# Workflow Rename & Agent Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the internal `skills/` folder to `workflows/` to avoid naming confusion with Anthropic Agent Skills, and create 3 Anthropic-standard skill files to guide developers working on keco-studio's agent system.

**Architecture:** Two independent changes: (1) a minimal-scope folder rename affecting only the directory path and one import statement, preserving all variable names and comments; (2) three new markdown files in `.claude/skills/` following the Anthropic Agent Skill standard with YAML frontmatter and concise developer guidance.

**Tech Stack:** TypeScript (agent system), Markdown with YAML frontmatter (Anthropic skills)

**Spec:** `docs/superpowers/specs/2026-06-12-workflow-rename-and-agent-skills-design.md`

---

## File Structure

### Part 1: Rename
| Action | Path | Responsibility |
|--------|------|----------------|
| `git mv` | `src/lib/agent/skills/` → `src/lib/agent/workflows/` | Contains workflow implementations (update-row, set-reference, setup-library) |
| Modify | `src/lib/agent/tools/index.ts:21` | Update import path from `'../skills'` to `'../workflows'` |

### Part 2: Anthropic Skills
| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `.claude/skills/add-tool.md` | Guide for adding new atomic agent tools |
| Create | `.claude/skills/add-workflow.md` | Guide for adding new multi-step workflows |
| Create | `.claude/skills/debug-agent.md` | Guide for debugging agent system issues |

---

## Task 1: Rename `skills/` folder to `workflows/`

**Files:**
- Move: `src/lib/agent/skills/` → `src/lib/agent/workflows/`
- Modify: `src/lib/agent/tools/index.ts:21`

- [ ] **Step 1: Rename the folder using git mv**

```bash
cd /home/hetu/project/keco-studio
git mv src/lib/agent/skills src/lib/agent/workflows
```

Expected: Folder renamed, git tracks the move.

- [ ] **Step 2: Update the import in tools/index.ts**

Open `src/lib/agent/tools/index.ts` and change line 21:

```typescript
// Before:
import { allSkills } from '../skills';

// After:
import { allSkills } from '../workflows';
```

- [ ] **Step 3: Verify the build succeeds**

```bash
cd /home/hetu/project/keco-studio
npm run build
```

Expected: Build completes without import errors.

- [ ] **Step 4: Commit the rename**

```bash
cd /home/hetu/project/keco-studio
git add -A
git commit -m "refactor: rename skills/ to workflows/ (folder + import only)

Rename the folder to avoid naming confusion with Anthropic Agent Skills.
Variable names and comments remain unchanged to minimize diff.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create `.claude/skills/add-tool.md`

**Files:**
- Create: `.claude/skills/add-tool.md`

- [ ] **Step 1: Create the add-tool skill file**

Create `.claude/skills/add-tool.md` with the following content:

```markdown
---
name: add-tool
description: How to add a new agent tool to keco-studio's agent system
whenToUse: Use when the developer asks to add a new tool, function, or capability to the agent
---

# Adding a New Agent Tool

Tools are **atomic operations** — each does one thing (query, create, update, delete).
If you need a **multi-step orchestrated workflow** (read → validate → preview → confirm → write), see `add-workflow` instead.

## Step 1: Create the tool file

Location: `src/lib/agent/tools/<tool-name>.ts`

Use kebab-case for the filename. Example: `query-assets.ts`, `create-library.ts`.

## Step 2: Implement the AgentTool interface

Reference: `src/lib/agent/types.ts` — the `AgentTool` interface.

Required fields:
- `name`: snake_case tool name (e.g., `query_assets`)
- `description`: shown to the LLM — be specific about params and use cases
- `parameters`: JSON Schema for the LLM
- `category`: `'read'` or `'write'`
- `confirmationMode`: choose one:
  - `'pre_execute'` — pause BEFORE execution, confirm args (default for write tools)
  - `'post_preview'` — execute non-mutating step first, show preview, then confirm write (for imports, complex operations)
  - `'meta'` — confirm the option change itself (for conversation settings)
- `requiredPermission`: optional, `'editor'` or `'admin'`
- `execute`: async function `(params, ctx) => Promise<ToolResult>`

Optional field (for `post_preview` tools):
- `executeImport`: async function `(toolResult, params, ctx) => Promise<ToolResult>` — the mutating second phase

## Step 3: Register the tool

Open `src/lib/agent/tools/index.ts`:

1. Add import at the top:
   ```typescript
   import { yourNewTool } from './your-new-tool';
   ```

2. Add to the `tools` array:
   ```typescript
   const tools: AgentTool[] = [
     queryAssets,
     // ... existing tools
     yourNewTool,  // ← add here
   ];
   ```

## Step 4: Update system prompt (if needed)

If the tool should be preferred in specific scenarios, add a rule to `src/lib/agent/prompts.ts` in the RULES section.

Example:
```
26. When the user asks to do X, prefer your_new_tool. Do NOT use manual workaround.
```

## Step 5: Test

1. Start the dev server: `npm run dev`
2. Open the agent chat panel
3. Trigger the tool via natural language
4. Verify: tool appears in LLM tool calls, executes correctly, returns expected displayHint

## Key files reference

| File | Purpose |
|------|---------|
| `src/lib/agent/types.ts` | AgentTool interface, ToolResult, ToolContext |
| `src/lib/agent/tools/` | All tool implementations |
| `src/lib/agent/tools/index.ts` | Tool registry — add your tool here |
| `src/lib/agent/prompts.ts` | System prompt rules |
| `src/lib/agent/core.ts` | ReAct loop — no changes needed for new tools |
| `src/lib/agent/data-access.ts` | Shared Supabase query helpers |

## Common patterns

### Read-only query tool
```typescript
export const querySomething: AgentTool = {
  name: 'query_something',
  description: '...',
  parameters: { type: 'object', properties: { ... }, required: [...] },
  category: 'read',
  confirmationMode: 'pre_execute',  // read tools don't confirm, but use this as default
  execute: async (params, ctx) => {
    // ... query logic
    return { success: true, displayHint: 'table', data: results };
  },
};
```

### Write tool with pre_execute confirmation
```typescript
export const createSomething: AgentTool = {
  name: 'create_something',
  category: 'write',
  confirmationMode: 'pre_execute',
  requiredPermission: 'editor',
  execute: async (params, ctx) => {
    // ... create logic
    return { success: true, displayHint: 'text', data: { id: newId } };
  },
};
```

### Write tool with post_preview (two-phase)
See `add-workflow` — this pattern is for complex multi-step operations.
```

- [ ] **Step 2: Commit the add-tool skill**

```bash
cd /home/hetu/project/keco-studio
git add .claude/skills/add-tool.md
git commit -m "docs: add Anthropic skill for adding agent tools

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Create `.claude/skills/add-workflow.md`

**Files:**
- Create: `.claude/skills/add-workflow.md`

- [ ] **Step 1: Create the add-workflow skill file**

Create `.claude/skills/add-workflow.md` with the following content:

```markdown
---
name: add-workflow
description: How to add a new workflow to keco-studio's agent system
whenToUse: Use when the developer needs to add a multi-step orchestrated operation with preview-and-confirm flow
---

# Adding a New Workflow

Workflows are **code-orchestrated composite tools** for deterministic multi-step operations that shouldn't rely on LLM judgment.

**When to use a workflow instead of a tool:**
- The operation involves multiple reads + validation before a write
- The user should see a preview before committing
- The steps are deterministic (always the same sequence)

If you need a **single atomic operation**, see `add-tool` instead.

## Step 1: Create the workflow file

Location: `src/lib/agent/workflows/<workflow-name>.ts`

Use kebab-case. Existing examples: `update-row.ts`, `set-reference.ts`, `setup-library.ts`.

## Step 2: Implement two-phase execution

Workflows use `confirmationMode: 'post_preview'` with two methods:

### Phase 1: `execute()` — NON-MUTATING

```typescript
async function execute(params: unknown, ctx: ToolContext): Promise<ToolResult> {
  // 1. Validate parameters (use Zod schema)
  // 2. Resolve libraries/folders by name
  // 3. Perform all reads and validation
  // 4. Build preview object with all resolved IDs needed for phase 2
  // 5. Return with displayHint: 'skill_preview'
  return { success: true, displayHint: 'skill_preview', data: preview };
}
```

**Key principle:** The preview must contain ALL data needed for phase 2. Don't rely on re-resolving anything in `executeImport`.

### Phase 2: `executeImport()` — MUTATING

```typescript
async function executeImport(
  toolResult: ToolResult,
  _params: unknown,
  ctx: ToolContext
): Promise<ToolResult> {
  const preview = toolResult.data as YourPreviewType;
  // 1. Extract resolved IDs from preview
  // 2. Perform the actual DB writes
  // 3. Return success with invalidateCache paths
  return { success: true, displayHint: 'text', data: result, invalidateCache: [libraryId] };
}
```

## Step 3: Design the preview data structure

Define a TypeScript interface for your preview:

```typescript
interface YourWorkflowPreview {
  type: 'your_workflow';  // unique discriminator for frontend routing
  // Include ALL resolved IDs needed for executeImport:
  libraryId: string;
  assetId: string;
  fieldId: string;
  // Include human-readable data for the preview display:
  libraryName: string;
  changes: Array<{ field: string; value: unknown }>;
}
```

## Step 4: Define the AgentTool export

```typescript
export const yourWorkflow: AgentTool = {
  name: 'your_workflow',
  description: 'Clear description for the LLM — explain WHEN to use this workflow and params.',
  parameters: {
    type: 'object',
    properties: {
      // JSON Schema for parameters
    },
    required: [...],
  },
  category: 'write',
  confirmationMode: 'post_preview',
  requiredPermission: 'editor',
  execute,
  executeImport,
};
```

## Step 5: Register the workflow

Open `src/lib/agent/workflows/index.ts`:

```typescript
import { yourWorkflow } from './your-workflow';

export const allSkills: AgentTool[] = [
  updateRow,
  setReference,
  setupLibrary,
  yourWorkflow,  // ← add here
];
```

## Step 6: Update system prompt

Add a rule to `src/lib/agent/prompts.ts` guiding the LLM to prefer this workflow:

```
27. When the user asks to do X, prefer your_workflow.
    Do NOT manually orchestrate the steps.
```

## Step 7 (optional): Add preview card

If you want a custom preview UI, create a component in `src/components/agent/`:

```typescript
// src/components/agent/YourWorkflowPreviewCard.tsx
export function YourWorkflowPreviewCard({ preview }: { preview: YourWorkflowPreview }) {
  // Render the preview data
}
```

Then add routing in `ChatMessage.tsx`:
```typescript
if (preview?.type === 'your_workflow')
  return <YourWorkflowPreviewCard preview={preview} />;
```

## Key files reference

| File | Purpose |
|------|---------|
| `src/lib/agent/workflows/` | All workflow implementations |
| `src/lib/agent/workflows/index.ts` | Workflow registry — add your workflow here |
| `src/lib/agent/types.ts` | AgentTool interface, ToolResult, ToolContext |
| `src/lib/agent/prompts.ts` | System prompt rules |
| `src/lib/agent/data-access.ts` | Shared Supabase query helpers |
| `src/components/agent/ChatMessage.tsx` | Preview card routing (if adding custom card) |

## Existing workflow examples

Study these for patterns:
- `update-row.ts` — simple row update by index
- `set-reference.ts` — bulk cross-library references
- `setup-library.ts` — create library + fields in one step
```

- [ ] **Step 2: Commit the add-workflow skill**

```bash
cd /home/hetu/project/keco-studio
git add .claude/skills/add-workflow.md
git commit -m "docs: add Anthropic skill for adding agent workflows

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Create `.claude/skills/debug-agent.md`

**Files:**
- Create: `.claude/skills/debug-agent.md`

- [ ] **Step 1: Create the debug-agent skill file**

Create `.claude/skills/debug-agent.md` with the following content:

```markdown
---
name: debug-agent
description: How to debug agent system issues in keco-studio
whenToUse: Use when the agent behaves unexpectedly, tool calls fail, or the confirmation flow gets stuck
---

# Debugging Agent Issues

## Common symptoms and where to look

| Symptom | Check first |
|---------|-------------|
| Wrong tool called | `src/lib/agent/prompts.ts` — rules may be unclear or missing |
| Tool execution fails | Tool's `execute()` logic — check params validation, DB queries |
| Confirmation stuck | `agent_pending_actions` table — suspended state may be corrupted |
| SSE stream broken | API route error handling — check `src/app/api/agent-chat/route.ts` |
| LLM doesn't use workflow | `prompts.ts` — add/clarify rule preferring the workflow |
| Wrong row updated | Check `rowIndex` handling — should be 1-based, not 0-based |

## Debug data sources

### Database tables

| Table | Contents | Query example |
|-------|----------|---------------|
| `agent_conversations` | Conversation metadata, settings | `SELECT * FROM agent_conversations WHERE id = '...'` |
| `agent_messages` | Full message history (user, assistant, tool) | `SELECT * FROM agent_messages WHERE conversation_id = '...' ORDER BY created_at` |
| `agent_pending_actions` | Suspended states awaiting confirmation | `SELECT * FROM agent_pending_actions WHERE conversation_id = '...'` |
| `agent_traces` | Full execution traces with token usage | `SELECT * FROM agent_traces WHERE conversation_id = '...' ORDER BY created_at DESC` |

### Browser DevTools

1. Open Network tab
2. Find the `agent-chat` SSE request
3. Click "EventStream" tab to see real-time events:
   - `text_delta` — LLM text chunks
   - `tool_call_start` / `tool_call_end` — tool invocation
   - `tool_result` — tool output
   - `confirmation_request` — waiting for user approval

### Server logs

```bash
# Run dev server with verbose output
npm run dev
```

Check terminal for:
- Tool resolution errors (`resolveTool` returns undefined)
- DB query failures (Supabase errors)
- SSE connection drops

## Key code paths

### Request flow

```
User message
  → POST /api/agent-chat (src/app/api/agent-chat/route.ts)
    → runAgentTurn (src/lib/agent/core.ts)
      → loadConversationHistory
      → buildSystemMessage (src/lib/agent/prompts.ts)
      → streamLlm (src/lib/agent/llm-client.ts)
      → resolveTool (src/lib/agent/tools/index.ts)
      → tool.execute() or suspend for confirmation
```

### Confirmation resume flow

```
User approves
  → POST /api/agent-chat/confirm (src/app/api/agent-chat/confirm/route.ts)
    → resumeAgentTurn (src/lib/agent/core.ts)
      → loadPendingAction (src/lib/agent/confirmation.ts)
      → tool.executeImport() (for post_preview tools)
      → continue ReAct loop
```

## Quick diagnostic checklist

When debugging, follow this order:

1. **Reproduce the issue** — what exact input triggers it?
2. **Check agent_messages** — what did the LLM actually say/call?
3. **Check agent_traces** — any errors or unexpected tool calls?
4. **Check agent_pending_actions** — is there a stuck confirmation?
5. **Check the tool code** — read the tool's `execute()` logic
6. **Check prompts.ts** — does the LLM have clear guidance?
7. **Check DB state** — are the libraries/assets/fields in expected state?

## Common bugs

### Bug: LLM picks wrong row
**Cause:** LLM uses first non-empty row instead of `rowIndex=1`
**Fix:** Use `update_row` workflow, or ensure `rowIndex` is passed explicitly

### Bug: Reference targets are empty
**Cause:** Source rows have no non-empty cells, or `includeEmpty` not passed
**Fix:** Check `query_assets` response — `summary.nonEmptyCellCount` should be > 0

### Bug: Confirmation never resolves
**Cause:** `agent_pending_actions` has stale entry, or frontend didn't call /confirm
**Fix:** Delete stale entry from `agent_pending_actions`, check frontend SSE handling

### Bug: Tool returns "Unknown field"
**Cause:** LLM used wrong field name (not semantic name)
**Fix:** Check `resolvePropertyValues` — ensure LLM uses display labels, not internal IDs
```

- [ ] **Step 2: Commit the debug-agent skill**

```bash
cd /home/hetu/project/keco-studio
git add .claude/skills/debug-agent.md
git commit -m "docs: add Anthropic skill for debugging agent issues

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Final verification

- [ ] **Step 1: Verify all files exist**

```bash
cd /home/hetu/project/keco-studio
ls -la src/lib/agent/workflows/
ls -la .claude/skills/
```

Expected output:
```
src/lib/agent/workflows/:
- index.ts
- set-reference.ts
- setup-library.ts
- update-row.ts

.claude/skills/:
- add-tool.md
- add-workflow.md
- debug-agent.md
```

- [ ] **Step 2: Verify the build still succeeds**

```bash
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 3: Verify no stale imports**

```bash
grep -r "from.*skills" src/lib/agent --include="*.ts"
```

Expected: No results referencing `../skills` (only `../workflows`).

- [ ] **Step 4: Test Anthropic skill discovery (manual)**

Open Claude Code in the keco-studio directory and ask:
- "How do I add a new tool?"
- "How do I add a new workflow?"
- "The agent is broken, how do I debug?"

Expected: Claude Code references the appropriate skill file.

---

## Summary of commits

1. `refactor: rename skills/ to workflows/ (folder + import only)`
2. `docs: add Anthropic skill for adding agent tools`
3. `docs: add Anthropic skill for adding agent workflows`
4. `docs: add Anthropic skill for debugging agent issues`

Total: 4 commits, ~300 lines of new content (mostly markdown skill files).
