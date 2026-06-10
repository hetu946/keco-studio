'use client';

import { useRef, useState } from 'react';
import styles from './ChatPanel.module.css';

interface Props {
  disabled: boolean;
  onSend: (message: string) => void;
}

export function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.inputBar}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        rows={1}
        placeholder="Ask Keco Assistant…  (Enter to send, Shift+Enter for newline)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
        }}
        onKeyDown={handleKeyDown}
      />
      <button className={styles.sendBtn} disabled={disabled || !value.trim()} onClick={submit}>
        Send
      </button>
    </div>
  );
}

export default ChatInput;
