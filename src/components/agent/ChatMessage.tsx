'use client';

import styles from './ChatPanel.module.css';
import type { ChatItem } from './types';
import { ToolCallCard } from './ToolCallCard';
import { ConfirmationCard } from './ConfirmationCard';
import { ScriptPreviewCard } from './ScriptPreviewCard';
import { SetupLibraryPreviewCard } from './SetupLibraryPreviewCard';

interface Props {
  item: ChatItem;
  streaming: boolean;
  onDecision: (actionId: string, decision: 'approve' | 'reject') => void;
}

export function ChatMessage({ item, streaming, onDecision }: Props) {
  switch (item.role) {
    case 'user':
      return <div className={`${styles.bubble} ${styles.user}`}>{item.text}</div>;
    case 'assistant':
      return <div className={`${styles.bubble} ${styles.assistant}`}>{item.text || '…'}</div>;
    case 'error':
      return <div className={styles.errorBubble}>{item.error}</div>;
    case 'tool':
      return item.toolCall ? <ToolCallCard toolCall={item.toolCall} /> : null;
    case 'confirmation': {
      if (!item.confirmation) return null;
      if (item.confirmation.confirmationMode === 'post_preview') {
        const preview = item.confirmation.preview as { type?: string } | undefined;
        if (preview?.type === 'setup_library') {
          return (
            <SetupLibraryPreviewCard
              confirmation={item.confirmation}
              disabled={streaming}
              onDecision={onDecision}
            />
          );
        }
        return <ScriptPreviewCard confirmation={item.confirmation} disabled={streaming} onDecision={onDecision} />;
      }
      return <ConfirmationCard confirmation={item.confirmation} disabled={streaming} onDecision={onDecision} />;
    }
    default:
      return null;
  }
}

export default ChatMessage;
