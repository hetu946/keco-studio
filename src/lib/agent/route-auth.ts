/**
 * Dual-mode auth helper for agent API routes, mirroring import-script/route.ts
 * (Authorization: Bearer token OR cookie session via createSupabaseServerClient).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/createSupabaseServerClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface AuthedRequest {
  supabase: SupabaseClient;
  user: User;
}

export async function authenticate(
  request: NextRequest
): Promise<AuthedRequest | NextResponse> {
  const authHeader = request.headers.get('authorization');
  const supabase = authHeader
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : createSupabaseServerClient(request);

  const {
    data: { user },
    error: authError,
  } = authHeader
    ? await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    : await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 });
  }

  return { supabase, user };
}
