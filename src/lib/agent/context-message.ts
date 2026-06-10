/**
 * Inject the user's current page context into the LLM turn without polluting
 * the persisted user message in the DB.
 */

import type { ToolContext } from './types';

export function augmentUserMessageForLlm(userMessage: string, ctx: ToolContext): string {
  const hasPageContext =
    ctx.currentLibraryName ||
    ctx.currentLibraryId ||
    ctx.currentSectionName ||
    ctx.currentFolderName;

  if (!hasPageContext) {
    return userMessage;
  }

  const hints: string[] = [];
  if (ctx.currentLibraryName) {
    hints.push(`active library "${ctx.currentLibraryName}"`);
  } else if (ctx.currentLibraryId) {
    hints.push(`active library (id: ${ctx.currentLibraryId})`);
  }
  if (ctx.currentSectionName) {
    hints.push(`active section tab "${ctx.currentSectionName}"`);
  }
  if (ctx.currentFolderName) {
    hints.push(`folder "${ctx.currentFolderName}"`);
  }

  return `[User is viewing: ${hints.join(', ')}. Use this library/section by default in tool calls — do not ask which library unless they name a different one.]\n${userMessage}`;
}
