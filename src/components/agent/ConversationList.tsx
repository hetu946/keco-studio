'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import styles from './ChatPanel.module.css';

interface ConversationItem {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface Props {
  projectId: string;
  activeId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function ConversationList({ projectId, activeId, onSelect, onClose }: Props) {
  const supabase = useSupabase();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  const load = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    const res = await fetch(`/api/agent-chat/conversations?projectId=${projectId}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return;
    const json = (await res.json()) as { conversations: ConversationItem[] };
    setConversations(json.conversations ?? []);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    await fetch(`/api/agent-chat/conversations/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className={styles.convList} onMouseLeave={onClose}>
      {conversations.length === 0 ? (
        <div className={styles.convItem} style={{ color: '#9ca3af' }}>
          No conversations yet.
        </div>
      ) : (
        conversations.map((c) => (
          <div
            key={c.id}
            className={styles.convItem}
            style={c.id === activeId ? { background: '#eff6ff' } : undefined}
            onClick={() => onSelect(c.id)}
          >
            <div>
              <div>{c.title || 'Conversation'}</div>
              <div className={styles.convMeta}>{new Date(c.updatedAt).toLocaleString()}</div>
            </div>
            <button className={styles.convDelete} onClick={(e) => handleDelete(e, c.id)}>
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export default ConversationList;
