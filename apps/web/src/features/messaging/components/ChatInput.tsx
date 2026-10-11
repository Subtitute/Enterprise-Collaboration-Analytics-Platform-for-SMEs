import React, { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/Input';
import { SendIcon } from '@/components/ui/Icons';

export interface ChatInputProps {
  onSend: (body: string) => void;
  isSending: boolean;
}

export const ChatInput = React.memo(function ChatInput({ onSend, isSending }: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  function handleSend() {
    const body = input.trim();
    if (!body || isSending) return;
    onSend(body);
    setInput('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="shrink-0 border-t border-border-subtle p-3.5 bg-white">
      <div className="flex items-end gap-2.5">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('messaging:page.messagePlaceholder')}
          rows={1}
          className="min-h-[60px] flex-1 resize-none rounded-[8px] border border-border-strong px-3 py-2 text-[13px] text-text-primary focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isSending}
          aria-label={t('messaging:page.send')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-text-primary hover:bg-black text-white transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

