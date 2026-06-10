'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@/lib/contexts/NavigationContext';
import { getActiveSectionName } from '@/lib/agent/page-context';
import { useAgentChat } from './useAgentChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ConversationList } from './ConversationList';
import styles from './ChatPanel.module.css';

export function ChatPanel() {
  const {
    currentProjectId,
    currentLibraryId,
    currentLibraryName,
    currentFolderId,
    currentFolderName,
  } = useNavigation();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSectionName, setCurrentSectionName] = useState<string | undefined>(undefined);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Active section tab lives in LibraryAssetsTable state, not the URL.
  useEffect(() => {
    if (!currentLibraryId) {
      setCurrentSectionName(undefined);
      return;
    }
    setCurrentSectionName(getActiveSectionName(currentLibraryId));
  }, [currentLibraryId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ libraryId?: string; sectionName?: string }>).detail;
      if (!detail?.libraryId || detail.libraryId !== currentLibraryId) return;
      setCurrentSectionName(detail.sectionName || undefined);
    };
    window.addEventListener('library:active-section', handler);
    return () => window.removeEventListener('library:active-section', handler);
  }, [currentLibraryId]);

  // Re-read persisted section when the panel opens (covers missed CustomEvents).
  useEffect(() => {
    if (!open || !currentLibraryId) return;
    setCurrentSectionName(getActiveSectionName(currentLibraryId));
  }, [open, currentLibraryId]);

  const ctx = useMemo(
    () => ({
      projectId: currentProjectId ?? '',
      currentFolderId: currentFolderId ?? undefined,
      currentFolderName: currentFolderName ?? undefined,
      currentLibraryId: currentLibraryId ?? undefined,
      currentLibraryName: currentLibraryName ?? undefined,
      currentSectionName,
    }),
    [
      currentProjectId,
      currentFolderId,
      currentFolderName,
      currentLibraryId,
      currentLibraryName,
      currentSectionName,
    ]
  );

  const { items, isStreaming, conversationId, send, confirm, startNewConversation, loadConversation } =
    useAgentChat(ctx);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  // Append a note when an import completes via the handoff to ImportScriptModal.
  useEffect(() => {
    const handler = () => {
      // The conversation will be reloaded on next interaction; we just refresh
      // the conversation list state implicitly. No-op placeholder for now.
    };
    window.addEventListener('agent:import-complete', handler as EventListener);
    return () => window.removeEventListener('agent:import-complete', handler as EventListener);
  }, []);

  if (!currentProjectId) return null;

  if (!open) {
    return (
      <button className={styles.launcher} title="Keco Assistant" onClick={() => setOpen(true)}>
        AI
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Keco Assistant</span>
        <div className={styles.headerActions}>
          <button className={styles.iconButton} onClick={() => startNewConversation()}>
            New
          </button>
          <button className={styles.iconButton} onClick={() => setShowHistory((v) => !v)}>
            History
          </button>
          <button className={styles.iconButton} onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        {showHistory && (
          <ConversationList
            projectId={currentProjectId}
            activeId={conversationId}
            onSelect={(id) => {
              setShowHistory(false);
              void loadConversation(id);
            }}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      <div className={styles.messages} ref={messagesRef}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            Ask about your project data, create or update assets, or import a script.
          </div>
        ) : (
          items.map((item) => (
            <ChatMessage key={item.id} item={item} streaming={isStreaming} onDecision={confirm} />
          ))
        )}
      </div>

      <ChatInput disabled={isStreaming} onSend={send} />
    </div>
  );
}

export default ChatPanel;
