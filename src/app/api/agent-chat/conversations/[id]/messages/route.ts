import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/agent/route-auth';
import { getConversation, getMessages } from '@/lib/agent/conversation-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await authenticate(request);
  if (authed instanceof NextResponse) return authed;
  const { supabase, user } = authed;

  const { id } = await params;

  const conversation = await getConversation(supabase, id);
  if (!conversation || conversation.user_id !== user.id) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined;
  const limitRaw = request.nextUrl.searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const page = await getMessages(supabase, id, { cursor, limit });
    return NextResponse.json(page);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Failed to load messages' }, { status: 400 });
  }
}
