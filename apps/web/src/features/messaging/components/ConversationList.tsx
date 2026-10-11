import React from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Conversation } from '@/types';

/** Suy ra ten hien thi cua 1 cuoc tro chuyen: GROUP -> ten nhom, DIRECT -> ten nguoi con lai. */
export function getConversationDisplayName(
  conversation: Conversation,
  currentUserId: string | undefined,
  userNames: Record<string, string>,
  unknownLabel: string,
): string {
  if (conversation.type === 'GROUP') return conversation.name ?? unknownLabel;
  const otherUserId = conversation.participantUserIds.find((id) => id !== currentUserId);
  return (otherUserId && userNames[otherUserId]) || unknownLabel;
}

interface ConversationListItemProps {
  conversation: Conversation;
  isActive: boolean;
  displayName: string;
  currentUserId?: string;
  onSelect: (id: string) => void;
}

const ConversationListItem = React.memo(function ConversationListItem({
  conversation,
  isActive,
  displayName,
  currentUserId,
  onSelect,
}: ConversationListItemProps) {
  const { t } = useTranslation();
  const lastMessage = conversation.lastMessage;
  const previewBody = lastMessage
    ? lastMessage.senderId === currentUserId
      ? t('messaging:page.lastMessagePreviewMine', { body: lastMessage.body })
      : lastMessage.body
    : t('messaging:page.noMessagesYet');

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className={cn(
          'flex w-full h-[72px] items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer',
          isActive ? 'bg-accent-soft' : 'hover:bg-bg-subtle',
        )}
      >
        <Avatar
          name={displayName}
          size="md"
          className="h-10 w-10 text-xs font-semibold bg-accent-soft text-accent shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
            {lastMessage && (
              <span className="shrink-0 font-mono text-[11px] font-normal tabular-nums text-text-tertiary">
                {formatRelativeTime(lastMessage.createdAt)}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-text-tertiary">{previewBody}</p>
            {conversation.unreadCount > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-accent text-white font-mono text-[10px] font-semibold tabular-nums leading-none">
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
});

export interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  currentUserId?: string;
  userNames: Record<string, string>;
  unknownLabel: string;
}

export const ConversationList = React.memo(function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  currentUserId,
  userNames,
  unknownLabel,
}: ConversationListProps) {
  return (
    <ul className="min-h-0 flex-1 divide-y divide-border-subtle overflow-y-auto">
      {conversations.map((conversation) => {
        const displayName = getConversationDisplayName(conversation, currentUserId, userNames, unknownLabel);
        const isActive = conversation.id === activeConversationId;

        return (
          <ConversationListItem
            key={conversation.id}
            conversation={conversation}
            isActive={isActive}
            displayName={displayName}
            currentUserId={currentUserId}
            onSelect={onSelectConversation}
          />
        );
      })}
    </ul>
  );
});

