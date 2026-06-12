# Workflow Rename & Agent Skills Design Spec

**Date:** 2026-06-12
**Status:** Draft

## Overview

Two changes to eliminate naming confusion between keco-studio's internal "skill" system and the Anthropic Agent Skill standard:

1. **Rename** `src/lib/agent/skills/` → `src/lib/agent/workflows/` (folder + imports only)
2. **Create** 3 Anthropic-standard skill files in `.claude/skills/` for keco-studio developers

---

## Part 1: Rename `skills/` → `workflows/`

### Motivation

The internal "skill" naming conflicts with the Anthropic Agent Skill standard (markdown-based prompt templates). Renaming to "workflow" clarifies that these are code-orchestrated multi-step tools, not prompt instruction files.

### Scope

| Change | What |
|--------|------|
| `git mv` | `src/lib/agent/skills/` → `src/lib/agent/workflows/` |
| Update import | `src/lib/agent/tools/index.ts`: `'../skills'` → `'../workflows'` |
| Update import | `src/lib/agent/workflows/index.ts`: internal relative imports if needed |

### NOT changed (minimize diff)

- Variable names: `allSkills` stays as-is
- Code comments mentioning "skill" stay as-is
- `docs/superpowers/specs/2026-06-11-skill-layer-design.md` preserved as historical record
- `prompts.ts` wording stays as-is
- No type changes, no interface renames

### Rationale for minimal scope

- Smaller diff = easier review
- Variable names don't affect external understanding
- Historical spec documents retain their original context
- Comments can be updated incrementally over time

---

## Part 2: Anthropic Skill Files

### Motivation

Anthropic Agent Skills are markdown files with YAML frontmatter that guide Claude Code behavior. They help developers follow project conventions when working on keco-studio's agent system.

### File Structure

```
.claude/skills/
├── add-tool.md        # How to add a new agent tool
├── add-workflow.md    # How to add a new workflow
└── debug-agent.md     # How to debug agent issues
```

### Skill 1: `add-tool.md`

**Purpose:** Guide for adding a new atomic agent tool (single-operation capability).

**Frontmatter:**
```yaml
---
name: add-tool
description: How to add a new agent tool to keco-studio's agent system
whenToUse: Use when the developer asks to add a new tool, function, or capability to the agent
---
```

**Content outline (~60 lines):**
1. **When to use a tool vs workflow** — tools are atomic, workflows are multi-step
2. **Step 1: Create the tool file** — location: `src/lib/agent/tools/<name>.ts`
3. **Step 2: Implement AgentTool interface** — reference `src/lib/agent/types.ts`
4. **Step 3: Choose confirmation mode** — `pre_execute` | `post_preview` | `meta`
5. **Step 4: Register the tool** — add to `allTools` array in `src/lib/agent/tools/index.ts`
6. **Step 5: Update system prompt (if needed)** — add guidance rule in `src/lib/agent/prompts.ts`
7. **Key files reference** — table of relevant file paths
8. **Common patterns** — read-only query, write with confirmation, import with preview

### Skill 2: `add-workflow.md`

**Purpose:** Guide for adding a new code-orchestrated workflow (multi-step composite operation).

**Frontmatter:**
```yaml
---
name: add-workflow
description: How to add a new workflow to keco-studio's agent system
whenToUse: Use when the developer needs to add a multi-step orchestrated operation with preview-and-confirm flow
---
```

**Content outline (~70 lines):**
1. **When to use a workflow** — deterministic multi-step operations that shouldn't rely on LLM judgment
2. **Step 1: Create the workflow file** — location: `src/lib/agent/workflows/<name>.ts`
3. **Step 2: Implement two-phase execution:**
   - `execute()`: read-only, builds preview, returns `displayHint: 'skill_preview'`
   - `executeImport()`: mutating, uses saved preview data to perform writes
4. **Step 3: Design preview data structure** — include all resolved IDs needed for phase 2
5. **Step 4: Register the workflow** — add to `allSkills` array in `src/lib/agent/workflows/index.ts`
6. **Step 5: Update system prompt** — add rule in `prompts.ts` guiding LLM to prefer this workflow
7. **Step 6 (optional): Add preview card** — frontend component in `src/components/agent/`
8. **Key files reference** — table of relevant file paths
9. **Existing workflow examples** — reference `update-row.ts`, `set-reference.ts`, `setup-library.ts`

### Skill 3: `debug-agent.md`

**Purpose:** Guide for debugging agent system issues.

**Frontmatter:**
```yaml
---
name: debug-agent
description: How to debug agent system issues in keco-studio
whenToUse: Use when the agent behaves unexpectedly, tool calls fail, or the confirmation flow gets stuck
---
```

**Content outline (~60 lines):**
1. **Common symptoms and where to look:**
   - Wrong tool called → check `prompts.ts` rules
   - Tool execution fails → check tool's `execute()` logic
   - Confirmation stuck → check `agent_pending_actions` table
   - SSE stream broken → check API route error handling
2. **Debug data sources:**
   - `agent_traces` table — full execution traces
   - `agent_conversations` / `agent_messages` — conversation history
   - `agent_pending_actions` — suspended states awaiting confirmation
   - Browser DevTools → Network tab → SSE event stream
3. **Key code paths:**
   - SSE entry: `src/app/api/agent-chat/route.ts`
   - ReAct loop: `src/lib/agent/core.ts`
   - Confirmation resume: `src/app/api/agent-chat/confirm/route.ts`
   - Tool resolution: `src/lib/agent/tools/index.ts` → `resolveTool()`
4. **Quick diagnostic steps** — ordered checklist for common issues

---

## Design Decisions

1. **Minimal rename scope** — Only folder + imports change. This keeps the diff small and avoids cascading changes to variable names and comments that don't affect functionality.

2. **3 separate skills instead of 1 combined** — Each skill addresses a distinct developer intent (add tool / add workflow / debug). Separate files mean Claude Code loads only the relevant instructions.

3. **Concise skill format (~60 lines each)** — Enough to guide Claude Code to the right files and patterns, without becoming a maintenance burden when code evolves.

4. **Skills in `.claude/skills/` not in project docs** — This is the standard location that Claude Code auto-discovers. Keeping them here ensures they're picked up automatically.

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/lib/agent/skills/` | `git mv` → `src/lib/agent/workflows/` |
| `src/lib/agent/tools/index.ts` | Update import path `'../skills'` → `'../workflows'` |
| `.claude/skills/add-tool.md` | **NEW** — Anthropic skill for adding tools |
| `.claude/skills/add-workflow.md` | **NEW** — Anthropic skill for adding workflows |
| `.claude/skills/debug-agent.md` | **NEW** — Anthropic skill for debugging |

---

## Testing Strategy

- **Rename verification:** `npm run build` should succeed with no import errors
- **Skill verification:** Open Claude Code in keco-studio, ask "how do I add a new tool" — should auto-discover and follow `add-tool.md`
