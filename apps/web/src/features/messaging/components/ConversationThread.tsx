import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/Modal';
import { UsersIcon } from '@/components/ui/Icons';
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
import { ManageGroupMembersModal } from './ManageGroupMembersModal';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import type { Conversation } from '@/types';

interface ConversationThreadProps {
  conversation: Conversation;
  onBack?: () => void;
}

/** Doan chat cua 1 cuoc tro chuyen dang mo: header (ten + quan ly thanh vien neu la GROUP), lich su
 *  tin nhan (cu -> moi, cuon len de tai them), o nhap o duoi. Join/leave room WS cua DUNG cuoc tro
 *  chuyen nay khi mo/dong (xem messaging.gateway.ts:handleJoinConversation). */
export const ConversationThread = React.memo(function ConversationThread({ conversation, onBack }: ConversationThreadProps) {
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

  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);

  const messages = messagesQuery.data ?? [];

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

  const handleLoadOlder = useCallback((firstId: string, onSuccess: () => void) => {
    loadOlder.mutate(firstId, { onSuccess });
  }, [loadOlder]);

  const handleNewMessageArrived = useCallback(() => {
    markRead.mutate(conversation.id);
  }, [markRead, conversation.id]);

  const handleRequestDelete = useCallback((messageId: string) => {
    setMessageToDelete(messageId);
  }, []);

  const handleSend = useCallback((body: string) => {
    sendMessageMutation.mutate(body);
  }, [sendMessageMutation]);

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
              aria-label="Quay lại danh sách"
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

      <MessageList
        messages={messages}
        isLoading={messagesQuery.isLoading}
        hasMore={loadOlder.hasMore}
        isPendingOlder={loadOlder.isPending}
        onLoadOlder={handleLoadOlder}
        onNewMessageArrived={handleNewMessageArrived}
        currentUserId={currentUserId}
        userNames={userNames}
        isGroup={conversation.type === 'GROUP'}
        onRequestDelete={handleRequestDelete}
      />

      <ChatInput
        onSend={handleSend}
        isSending={sendMessageMutation.isPending}
      />

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
});
