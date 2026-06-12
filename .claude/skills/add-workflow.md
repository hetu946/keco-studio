---
name: add-workflow
description: How to add a new workflow to keco-studio's agent system
whenToUse: Use when the developer needs to add a multi-step orchestrated operation with preview-and-confirm flow
---

# Add a New Workflow

## When to Use a Workflow

Workflows are **code-orchestrated composite tools** that run deterministic multi-step logic without relying on LLM judgment between steps.

Use a workflow when:
- The operation spans multiple DB reads/writes that must happen in a fixed order
- Row/field resolution must be deterministic (e.g. `rowIndex` instead of guessed UUIDs)
- Manual tool chains would be error-prone (reference copying, library setup)

## Step 1: Create the Workflow File

Create `src/lib/agent/workflows/<name>.ts`. Export a const matching the LLM function name (e.g. `updateRow` with `name: 'update_row'`).

## Step 2: Implement Two-Phase Execution

**Phase 1 — `execute()` (read-only preview):**
- Validate params with Zod
- Resolve libraries, rows, fields, references
- Build a typed preview object with all IDs needed for phase 2
- Return `{ success: true, displayHint: 'skill_preview', data: preview }`
- Do NOT write to the database

**Phase 2 — `executeImport()` (mutating):**
- Receive saved `toolResult` from the confirmation handler
- Extract preview data, perform writes via service layer
- Return `{ success: true, invalidateCache: [...] }`

Set `confirmationMode: 'post_preview'` and attach both `execute` and `executeImport`.

## Step 3: Design Preview Data Structure

The preview `data` object must be self-contained for phase 2:

```typescript
interface MyWorkflowPreview {
  type: 'my_workflow';       // Discriminator for frontend cards
  libraryId: string;         // Resolved UUIDs, not names
  resolvedValues: Record<string, unknown>;
  // ... everything executeImport needs without re-querying
}
```

Include resolved IDs so `executeImport` never re-parses user input or re-resolves names.

## Step 4: Register the Workflow

In `src/lib/agent/workflows/index.ts`:

1. Import the workflow
2. Add it to the `allSkills` array

Workflows are merged into `allTools` in `src/lib/agent/tools/index.ts` via `import { allSkills } from '../workflows'`.

## Step 5: Update System Prompt

Add a rule in `src/lib/agent/prompts.ts` telling the LLM to **prefer this workflow** over manual tool chains for the matching user intent.

## Step 6 (Optional): Add Preview Card

If the default preview rendering is insufficient, add a React component in `src/components/agent/` (e.g. `SetupLibraryPreviewCard.tsx`) and wire it in the chat message renderer for `displayHint: 'skill_preview'`.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/agent/workflows/index.ts` | Workflow registry (`allSkills`) |
| `src/lib/agent/workflows/update-row.ts` | Row update by rowIndex |
| `src/lib/agent/workflows/set-reference.ts` | Cross-library reference copy |
| `src/lib/agent/workflows/setup-library.ts` | Create library + fields |
| `src/lib/agent/tools/index.ts` | Merges workflows into `allTools` |
| `src/app/api/agent-chat/confirm/route.ts` | Calls `executeImport` after approval |

## Existing Workflow Examples

| Workflow | Purpose | Key pattern |
|----------|---------|-------------|
| `update_row` | Update row by 1-based rowIndex | Resolves assetId from rowIndex deterministically |
| `set_reference` | Copy all non-empty refs between libraries | Queries source, writes targets in one step |
| `setup_library` | Create library with field schema | Preview shows grouped fields, import creates all |
