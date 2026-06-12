---
name: add-tool
description: How to add a new agent tool to keco-studio's agent system
whenToUse: Use when the developer asks to add a new tool, function, or capability to the agent
---

# Add a New Agent Tool

## Tool vs Workflow

| | Tool | Workflow |
|---|------|----------|
| Scope | Single atomic operation | Multi-step orchestrated operation |
| Location | `src/lib/agent/tools/` | `src/lib/agent/workflows/` |
| LLM role | Decides when to call | Prefer workflow over manual tool chains |

Use a **tool** when one function call completes the job (query, create, delete, etc.).

## Step 1: Create the Tool File

Create `src/lib/agent/tools/<name>.ts`. Use snake_case for the exported constant name matching the LLM function name (e.g. `add_field` → `addField`).

Follow existing patterns: Zod schema for params, `execute()` function, export an `AgentTool` object.

## Step 2: Implement AgentTool Interface

Reference `src/lib/agent/types.ts`:

```typescript
export interface AgentTool {
  name: string;              // LLM function name (snake_case)
  description: string;       // Shown to the LLM in tool list
  parameters: JSONSchema;    // OpenAI-compatible JSON Schema
  category: 'read' | 'write';
  confirmationMode: ConfirmationMode;
  requiredPermission?: 'editor' | 'admin';
  execute: (params, ctx) => Promise<ToolResult>;
  executeImport?: ...;       // Only for post_preview tools
}
```

Use `ToolContext` for supabase client, projectId, conversationId, and page context (currentLibraryName, etc.).

## Step 3: Choose Confirmation Mode

| Mode | When | Examples |
|------|------|----------|
| `pre_execute` | Pause before write; confirm args | `create_asset`, `update_asset`, `delete_asset`, `add_field` |
| `post_preview` | Run read-only preview first, confirm, then mutate | `import_script`, all workflows |
| `meta` | Confirm the meta-change itself | `set_conversation_option` |

Read tools use `category: 'read'` and typically no confirmation.

## Step 4: Register the Tool

In `src/lib/agent/tools/index.ts`:

1. Import the new tool
2. Add it to the `tools` array (before `allSkills` merge)

Workflows are registered separately in `src/lib/agent/workflows/index.ts` and merged via `allSkills`.

## Step 5: Update System Prompt (if needed)

Add a rule in `src/lib/agent/prompts.ts` → `buildSystemPrompt()` when the LLM needs guidance on when/how to call the tool (context defaults, naming conventions, etc.).

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/agent/types.ts` | AgentTool, ToolContext, ToolResult, ConfirmationMode |
| `src/lib/agent/tools/index.ts` | Tool registry, `resolveTool()`, `getToolsForLlm()` |
| `src/lib/agent/tools/_shared.ts` | Shared helpers (library resolution, field maps) |
| `src/lib/agent/prompts.ts` | System prompt rules for the LLM |
| `src/lib/agent/core.ts` | ReAct loop (no changes needed for new tools) |

## Common Patterns

**Read-only query:** `category: 'read'`, validate with Zod, return `{ success: true, data, displayHint: 'table' }`. See `query-assets.ts`.

**Write with pre_execute confirmation:** Resolve library via `resolveLibraryForTool`, call service layer, return `{ success: true, invalidateCache: [libraryId] }`. See `create-asset.ts`, `add-field.ts`.

**Import with post_preview:** `execute()` builds preview (non-mutating), `executeImport()` persists after user confirms. See `import-script.ts`.
