import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { MessageItem } from './MessageItem';
import type { ChatMessage } from '@/types';

export interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  isPendingOlder: boolean;
  onLoadOlder: (beforeId: string, onSuccess: () => void) => void;
  onNewMessageArrived?: () => void;
  currentUserId?: string;
  userNames: Record<string, string>;
  isGroup: boolean;
  onRequestDelete: (messageId: string) => void;
}

export const MessageList = React.memo(function MessageList({
  messages,
  isLoading,
  hasMore,
  isPendingOlder,
  onLoadOlder,
  onNewMessageArrived,
  currentUserId,
  userNames,
  isGroup,
  onRequestDelete,
}: MessageListProps) {
  const { t } = useTranslation();
  const [isAtTop, setIsAtTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Theo doi scroll position de chi hien nut "Tai tin cu" khi da cuon len sat dinh (scrollTop === 0)
  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    setIsAtTop(el.scrollTop <= 10);
  }

  // Cuon xuong cuoi khi CHUYEN cuoc tro chuyen hoac khi co tin nhan MOI THUC SU (khong phai khi
  // tai them tin nhan CU o dau danh sach - so sanh id tin nhan CUOI CUNG, khong phai do dai mang).
  useEffect(() => {
    if (messages.length === 0) return;
    const newLastId = messages[messages.length - 1].id;
    if (newLastId === lastMessageIdRef.current) return;
    lastMessageIdRef.current = newLastId;
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
    // Nguoi dung dang mo dung cuoc tro chuyen nay khi co tin nhan moi - danh dau da doc luon.
    onNewMessageArrived?.();
  }, [messages, onNewMessageArrived]);

  function handleLoadOlder() {
    if (messages.length === 0) return;
    const container = containerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    // Giu nguyen vi tri xem (khong nhay len dau) sau khi tin nhan CU HON duoc chen vao dau danh
    // sach - bu lai dung phan chieu cao vua tang them.
    onLoadOlder(messages[0].id, () => {
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
      });
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <FullPageSpinner label={t('messaging:page.loading')} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"
    >
      {/* Chi hien nut tai tin cu khi scroll len sat dinh VA con tin cu */}
      {hasMore && messages.length > 0 && isAtTop && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={handleLoadOlder}
            disabled={isPendingOlder}
            className="h-8 px-3 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPendingOlder ? t('common:loading') : t('messaging:page.loadOlder')}
          </button>
        </div>
      )}
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isMine={message.senderId === currentUserId}
          senderName={userNames[message.senderId]}
          showSenderName={isGroup}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
});

