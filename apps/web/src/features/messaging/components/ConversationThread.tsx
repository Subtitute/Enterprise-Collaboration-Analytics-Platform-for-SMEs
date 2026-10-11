import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/Modal';
import { SendIcon, TrashIcon, UsersIcon } from '@/components/ui/Icons';
import { cn, formatTime, formatRelativeTime } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { getMessagingSocket } from '@/lib/socket';
import {
  useDeleteMessage,
  useIsKnownConversationCreator,
  useLoadOlderMessages,
  useMarkConversationRead,
  useMessagesQuery,
  useSendMessage,
} from '../hooks';
import { detectLeaveIntent } from '../utils/leaveDetection';
import { ManageGroupMembersModal } from './ManageGroupMembersModal';
import { LeaveRequestSuggestion } from './LeaveRequestSuggestion';
import type { ChatMessage, Conversation } from '@/types';

interface ConversationThreadProps {
  conversation: Conversation;
  onBack?: () => void;
}

/** Doan chat cua 1 cuoc tro chuyen dang mo: header (ten + quan ly thanh vien neu la GROUP), lich su
 *  tin nhan (cu -> moi, cuon len de tai them), o nhap o duoi. Join/leave room WS cua DUNG cuoc tro
 *  chuyen nay khi mo/dong (xem messaging.gateway.ts:handleJoinConversation). */
export function ConversationThread({ conversation, onBack }: ConversationThreadProps) {
  const { t } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const permissions = usePermissions();
  const { map: userNames } = useUserNameMap();

  const messagesQuery = useMessagesQuery(conversation.id);
  const loadOlder = useLoadOlderMessages(conversation.id);
  const sendMessageMutation = useSendMessage(conversation.id);
  const markRead = useMarkConversationRead();
  const deleteMessageMutation = useDeleteMessage(conversation.id);
  const isKnownCreator = useIsKnownConversationCreator(conversation.id);

  const [input, setInput] = useState('');
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false);

  const messages = messagesQuery.data ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const canManageGroup =
    conversation.type === 'GROUP' && (permissions.includes(PERMISSIONS.MESSAGE_MANAGE_GROUP) || isKnownCreator);

  // Theo doi scroll position de chi hien nut "Tai tin cu" khi da cuon len sat dinh (scrollTop === 0)
  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    setIsAtTop(el.scrollTop <= 10);
  }

  // Join/leave room WS CUA CUOC TRO CHUYEN NAY khi component mo/dong - socket toan cuc da duoc ket
  // noi san o AppShell (useMessagingSocket), xem ghi chu tai lib/socket.ts:getMessagingSocket().
  useEffect(() => {
    const socket = getMessagingSocket();
    if (!socket) return;
    socket.emit('joinConversation', { conversationId: conversation.id });
    return () => {
      socket.emit('leaveConversation', { conversationId: conversation.id });
    };
  }, [conversation.id]);

  // Danh dau da doc khi mo cuoc tro chuyen nay - PATCH .../read khong body (xem api.ts).
  useEffect(() => {
    markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  // Cuon xuong cuoi khi CHUYEN cuoc tro chuyen hoac khi co tin nhan MOI THUC SU (khong phai khi
  // tai them tin nhan CU o dau danh sach - so sanh id tin nhan CUOI CUNG, khong phai do dai mang).
  useEffect(() => {
    if (messages.length === 0) return;
    const newLastId = messages[messages.length - 1].id;
    if (newLastId === lastMessageIdRef.current) return;
    lastMessageIdRef.current = newLastId;
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
    // Nguoi dung dang mo dung cuoc tro chuyen nay khi co tin nhan moi - danh dau da doc luon.
    markRead.mutate(conversation.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, conversation.id]);

  function handleLoadOlder() {
    if (messages.length === 0) return;
    const container = containerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    // Giu nguyen vi tri xem (khong nhay len dau) sau khi tin nhan CU HON duoc chen vao dau danh
    // sach - bu lai dung phan chieu cao vua tang them.
    loadOlder.mutate(messages[0].id, {
      onSuccess: () => {
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      },
    });
  }

  function handleSend() {
    const body = input.trim();
    if (!body || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(body, { onSuccess: () => setInput('') });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const otherUserId = conversation.participantUserIds.find((id) => id !== currentUserId);
  const headerName =
    conversation.type === 'GROUP'
      ? conversation.name ?? t('messaging:page.groupLabel')
      : (otherUserId && userNames[otherUserId]) || t('messaging:page.unknownUser');
  const membersCount = conversation.participantUserIds.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t('messaging:page.backToList')}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-radius-sm border border-border-strong text-text-primary hover:bg-bg-subtle cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <Avatar
            name={headerName}
            size="md"
            className="h-9 w-9 text-xs font-semibold bg-accent-soft text-accent shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-text-primary leading-tight">{headerName}</p>
            {conversation.type === 'GROUP' && (
              <p className="truncate font-mono text-[12px] font-normal tabular-nums text-text-tertiary mt-0.5">
                {t('messaging:page.membersCount', { count: membersCount })}
              </p>
            )}
          </div>
        </div>
        {canManageGroup && (
          <button
            type="button"
            onClick={() => setIsManageMembersOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer"
          >
            <UsersIcon className="h-4 w-4 text-text-secondary" />
            {t('messaging:page.manageMembers')}
          </button>
        )}
      </div>

      {/* Body messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"
      >
        {messagesQuery.isLoading ? (
          <FullPageSpinner label={t('messaging:page.loading')} />
        ) : (
          <>
            {/* Chi hien nut tai tin cu khi scroll len sat dinh VA con tin cu */}
            {loadOlder.hasMore && messages.length > 0 && isAtTop && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={handleLoadOlder}
                  disabled={loadOlder.isPending}
                  className="h-8 px-3 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loadOlder.isPending ? t('common:status.loading') : t('messaging:page.loadOlder')}
                </button>
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isMine={message.senderId === currentUserId}
                senderName={userNames[message.senderId]}
                showSenderName={conversation.type === 'GROUP'}
                onRequestDelete={() => setMessageToDelete(message.id)}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer input */}
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
            disabled={!input.trim() || sendMessageMutation.isPending}
            aria-label={t('messaging:page.send')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-text-primary hover:bg-black text-white transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {conversation.type === 'GROUP' && (
        <ManageGroupMembersModal open={isManageMembersOpen} onClose={() => setIsManageMembersOpen(false)} conversation={conversation} />
      )}

      <ConfirmDialog
        open={Boolean(messageToDelete)}
        onClose={() => setMessageToDelete(null)}
        onConfirm={() => {
          if (messageToDelete) deleteMessageMutation.mutate(messageToDelete);
          setMessageToDelete(null);
        }}
        title={t('messaging:page.confirmDeleteTitle')}
        description={t('messaging:page.confirmDeleteDescription')}
        danger
        isLoading={deleteMessageMutation.isPending}
      />
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
  senderName,
  showSenderName,
  onRequestDelete,
}: {
  message: ChatMessage;
  isMine: boolean;
  senderName?: string;
  showSenderName: boolean;
  onRequestDelete: () => void;
}) {
  const { t } = useTranslation();
  // 03/10/2026: chi do tim "y dinh xin nghi phep" cho tin nhan CUA CHINH MINH (isMine)
  const leaveDetection = isMine ? detectLeaveIntent(message.body) : null;
  return (
    <div className={cn('group flex', isMine ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[70%] space-y-1', isMine && 'flex flex-col items-end')}>
        {showSenderName && !isMine && (
          <p className="px-1 text-[11px] font-semibold text-text-tertiary">
            {senderName ?? t('messaging:page.unknownUser')}
          </p>
        )}
        <div className="flex items-center gap-1.5">
          {isMine && (
            <button
              type="button"
              onClick={onRequestDelete}
              title={t('messaging:page.deleteMessageTooltip')}
              aria-label={t('messaging:page.deleteMessageTooltip')}
              className="shrink-0 rounded p-1 text-text-tertiary opacity-0 transition-opacity hover:bg-error-soft hover:text-error group-hover:opacity-100 cursor-pointer"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <div
            className={cn(
              'whitespace-pre-wrap break-words px-3 py-2.5 text-[13px] leading-[20px] shadow-none',
              isMine
                ? 'bg-text-primary text-white rounded-[12px] rounded-br-[4px]'
                : 'bg-bg-subtle text-text-primary rounded-[12px] rounded-bl-[4px]',
            )}
          >
            {message.body}
          </div>
        </div>
        {leaveDetection && <LeaveRequestSuggestion message={message} resolvedDate={leaveDetection.resolvedDate} />}
        <p
          className={cn('px-1 font-mono text-[11px] font-normal tabular-nums text-text-tertiary', isMine && 'text-right')}
          title={formatTime(message.createdAt)}
        >
          {formatRelativeTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
