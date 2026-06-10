/**
 * Pending action store — DB as single source of truth for suspended ReAct loops.
 *
 * An in-memory Map acts purely as a cache; on miss we fall back to the DB so the
 * confirmation flow survives server restarts and multi-instance deployments.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConfirmationMode, SuspendedState } from './types';

export interface PendingAction {
  id: string;
  conversationId: string;
  toolName: string;
  args: unknown;
  confirmationMode: ConfirmationMode;
  status: 'pending' | 'approved' | 'rejected';
  suspendedState: SuspendedState;
}

const memoryCache = new Map<string, PendingAction>();

export async function savePendingAction(
  supabase: SupabaseClient,
  action: Omit<PendingAction, 'status'>
): Promise<void> {
  const { error } = await supabase.from('agent_pending_actions').insert({
    id: action.id,
    conversation_id: action.conversationId,
    tool_name: action.toolName,
    args: action.args,
    confirmation_mode: action.confirmationMode,
    status: 'pending',
    suspended_state: action.suspendedState,
  });
  if (error) {
    throw new Error(`Failed to save pending action: ${error.message}`);
  }
  memoryCache.set(action.id, { ...action, status: 'pending' });
}

export async function loadPendingAction(
  supabase: SupabaseClient,
  actionId: string
): Promise<PendingAction | null> {
  const cached = memoryCache.get(actionId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('agent_pending_actions')
    .select('*')
    .eq('id', actionId)
    .single();
  if (error || !data) return null;

  // Expired pending actions are treated as gone.
  if (data.status === 'pending' && data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }

  const action: PendingAction = {
    id: data.id,
    conversationId: data.conversation_id,
    toolName: data.tool_name,
    args: data.args,
    confirmationMode: data.confirmation_mode,
    status: data.status,
    suspendedState: data.suspended_state as SuspendedState,
  };
  memoryCache.set(actionId, action);
  return action;
}

export async function markPendingAction(
  supabase: SupabaseClient,
  actionId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  await supabase.from('agent_pending_actions').update({ status }).eq('id', actionId);
  const cached = memoryCache.get(actionId);
  if (cached) cached.status = status;
}

export async function deletePendingAction(
  supabase: SupabaseClient,
  actionId: string
): Promise<void> {
  await supabase.from('agent_pending_actions').delete().eq('id', actionId);
  memoryCache.delete(actionId);
}
