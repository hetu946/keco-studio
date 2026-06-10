/**
 * set_conversation_option — toggle per-conversation options (meta confirmation).
 *
 * Currently only "skipConfirmation" is supported, which suppresses confirmation
 * for pre_execute tools. The change itself always requires confirmation.
 */

import { z } from 'zod';
import type { AgentTool, ConversationMeta, ToolContext, ToolResult } from '../types';
import { getConversation, updateConversationMeta } from '../conversation-store';

const ParamsSchema = z.object({
  option: z.enum(['skipConfirmation']),
  value: z.boolean(),
});

async function execute(params: unknown, ctx: ToolContext): Promise<ToolResult> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
  }
  const { option, value } = parsed.data;

  const conversation = await getConversation(ctx.supabase, ctx.conversationId);
  if (!conversation) {
    return { success: false, error: 'Conversation not found.' };
  }

  const nextMeta: ConversationMeta = { ...conversation.meta, [option]: value };
  await updateConversationMeta(ctx.supabase, ctx.conversationId, nextMeta);

  return {
    success: true,
    displayHint: 'text',
    data: { option, value, meta: nextMeta },
  };
}

export const setConversationOption: AgentTool = {
  name: 'set_conversation_option',
  description:
    'Toggle a conversation option. Use option="skipConfirmation" with value=true when the user asks to skip confirmations for create/update/delete operations.',
  category: 'write',
  confirmationMode: 'meta',
  parameters: {
    type: 'object',
    properties: {
      option: { type: 'string', enum: ['skipConfirmation'], description: 'The option to set' },
      value: { type: 'boolean', description: 'New value for the option' },
    },
    required: ['option', 'value'],
  },
  execute,
};
