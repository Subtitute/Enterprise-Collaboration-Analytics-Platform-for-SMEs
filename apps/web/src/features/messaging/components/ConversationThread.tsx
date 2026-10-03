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
}

/** Doan chat cua 1 cuoc tro chuyen dang mo: header (ten + quan ly thanh vien neu la GROUP), lich su
 *  tin nhan (cu -> moi, cuon len de tai them), o nhap o duoi. Join/leave room WS cua DUNG cuoc tro
 *  chuyen nay khi mo/dong (xem messaging.gateway.ts:handleJoinConversation). */
export function ConversationThread({ conversation }: ConversationThreadProps) {
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

  const messages = messagesQuery.data ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const canManageGroup =
    conversation.type === 'GROUP' && (permissions.includes(PERMISSIONS.MESSAGE_MANAGE_GROUP) || isKnownCreator);

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
  const headerSubtitle =
    conversation.type === 'GROUP' ? t('messaging:page.membersCount', { count: conversation.participantUserIds.length }) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={headerName} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{headerName}</p>
            {headerSubtitle && <p className="truncate text-xs text-slate-400">{headerSubtitle}</p>}
          </div>
        </div>
        {canManageGroup && (
          <Button variant="outline" size="sm" onClick={() => setIsManageMembersOpen(true)}>
            <UsersIcon className="h-4 w-4" />
            {t('messaging:page.manageMembers')}
          </Button>
        )}
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messagesQuery.isLoading ? (
          <FullPageSpinner label={t('messaging:page.loading')} />
        ) : (
          <>
            {loadOlder.hasMore && messages.length > 0 && (
              <div className="flex justify-center pb-2">
                <Button variant="outline" size="sm" onClick={handleLoadOlder} isLoading={loadOlder.isPending}>
                  {t('messaging:page.loadOlder')}
                </Button>
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

      <div className="shrink-0 border-t border-slate-100 p-3.5">
        <div className="flex items-end gap-2.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('messaging:page.messagePlaceholder')}
            rows={1}
            className="min-h-[40px] flex-1 resize-none"
          />
          <Button onClick={handleSend} disabled={!input.trim()} isLoading={sendMessageMutation.isPending} size="icon" aria-label={t('messaging:page.send')}>
            <SendIcon className="h-4 w-4" />
          </Button>
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
  // 03/10/2026: chi do tim "y dinh xin nghi phep" cho tin nhan CUA CHINH MINH (isMine) - tuyet doi
  // khong duoc goi y/cho phep tao ho yeu cau nghi phep tu tin nhan cua NGUOI KHAC trong group chat,
  // vi se tao nham yeu cau duoi danh nghia sai nguoi (loi nghiem trong ve danh tinh). detectLeaveIntent
  // la ham thuan (khong phai hook) nen goi co dieu kien o day la an toan.
  const leaveDetection = isMine ? detectLeaveIntent(message.body) : null;
  return (
    <div className={cn('group flex', isMine ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[75%] space-y-1', isMine && 'flex flex-col items-end')}>
        {showSenderName && !isMine && <p className="px-1 text-[11px] font-semibold text-slate-500">{senderName ?? t('messaging:page.unknownUser')}</p>}
        <div className="flex items-center gap-1.5">
          {isMine && (
            <button
              type="button"
              onClick={onRequestDelete}
              title={t('messaging:page.deleteMessageTooltip')}
              aria-label={t('messaging:page.deleteMessageTooltip')}
              className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <div
            className={cn(
              'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-2xs',
              isMine ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-800',
            )}
          >
            {message.body}
          </div>
        </div>
        {leaveDetection && <LeaveRequestSuggestion message={message} resolvedDate={leaveDetection.resolvedDate} />}
        <p className={cn('px-1 text-[10px] text-slate-400', isMine && 'text-right')} title={formatTime(message.createdAt)}>
          {formatRelativeTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
