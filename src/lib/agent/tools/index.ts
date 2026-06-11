/**
 * Tool registry. Adding a new tool: write one file -> import it -> add it to the
 * allTools array. No changes to the ReAct loop are required.
 */

import type { AgentTool, OpenAITool } from '../types';
import { queryAssets } from './query-assets';
import { queryScriptLines } from './query-script-lines';
import { addField } from './add-field';
import { createAsset } from './create-asset';
import { updateAsset } from './update-asset';
import { updateRow } from './update-row';
import { setReference } from './set-reference';
import { deleteAsset } from './delete-asset';
import { importScript } from './import-script';
import { setConversationOption } from './set-conversation-option';
import { createLibrary } from './create-library';
import { createFolder } from './create-folder';
import { deleteLibrary } from './delete-library';
import { renameLibrary } from './rename-library';
import { setupLibrary } from './setup-library';

export const allTools: AgentTool[] = [
  queryAssets,
  queryScriptLines,
  addField,
  createAsset,
  updateAsset,
  updateRow,
  setReference,
  deleteAsset,
  importScript,
  setConversationOption,
  createLibrary,
  createFolder,
  deleteLibrary,
  renameLibrary,
  setupLibrary,
];

export function getToolsForLlm(): OpenAITool[] {
  return allTools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function resolveTool(name: string): AgentTool | undefined {
  return allTools.find((t) => t.name === name);
}
