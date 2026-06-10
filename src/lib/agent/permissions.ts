/**
 * Permission helpers for the agent, wrapping the existing collaboration model.
 *
 * Access in keco-studio is determined by the project_collaborators record
 * (owners must also be collaborators). We resolve a single effective role and
 * deny access entirely when the user has neither.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserProjectRole } from '@/lib/services/collaborationService';
import type { UserRole } from './types';

export class AgentAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentAccessError';
  }
}

/**
 * Resolve the user's effective role for a project. Throws AgentAccessError when
 * the user has no access at all.
 */
export async function resolveUserRole(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<UserRole> {
  const { role, isOwner } = await getUserProjectRole(supabase, projectId, userId);

  if (role) {
    return role as UserRole;
  }
  if (isOwner) {
    // Owner without an explicit collaborator role still administers the project.
    return 'admin';
  }
  throw new AgentAccessError('You do not have access to this project.');
}

export function isWriteAllowed(role: UserRole): boolean {
  return role === 'admin' || role === 'editor';
}
