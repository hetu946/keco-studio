'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import styles from './ChatPanel.module.css';

interface ConversationItem {
  id: string;
  projectId: string;
  projectName: string;
  title: string | null;
  updatedAt: string;
}

interface Props {
  activeId?: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function ConversationList({ activeId, onSelect, onDelete, onClose }: Props) {
  const supabase = useSupabase();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    const res = await fetch('/api/agent-chat/conversations?scope=all', {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json = (await res.json()) as { conversations: ConversationItem[] };
    setConversations(json.conversations ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

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
    onDelete?.(id);
  };

  return (
    <div className={styles.convList} onMouseLeave={onClose}>
      {loading ? (
        <div className={styles.convItem} style={{ color: '#9ca3af' }}>
          Loading…
        </div>
      ) : conversations.length === 0 ? (
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
              <div className={styles.convMeta}>
                {c.projectName} · {new Date(c.updatedAt).toLocaleString()}
              </div>
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
