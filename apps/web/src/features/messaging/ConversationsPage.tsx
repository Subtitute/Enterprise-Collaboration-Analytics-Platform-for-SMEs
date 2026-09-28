import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { MessageIcon, PlusIcon } from '@/components/ui/Icons';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useConversationsQuery } from './hooks';
import { NewConversationModal } from './components/NewConversationModal';
import { ConversationThread } from './components/ConversationThread';
import type { Conversation, ConversationWithOwner } from '@/types';

/** Suy ra ten hien thi cua 1 cuoc tro chuyen: GROUP -> ten nhom, DIRECT -> ten nguoi con lai. */
function getConversationDisplayName(conversation: Conversation, currentUserId: string | undefined, userNames: Record<string, string>, unknownLabel: string): string {
  if (conversation.type === 'GROUP') return conversation.name ?? unknownLabel;
  const otherUserId = conversation.participantUserIds.find((id) => id !== currentUserId);
  return (otherUserId && userNames[otherUserId]) || unknownLabel;
}

export function ConversationsPage() {
  const { t } = useTranslation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { map: userNames } = useUserNameMap();
  const conversationsQuery = useConversationsQuery();
  const conversations = conversationsQuery.data ?? [];

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);

  // Tu dong chon cuoc tro chuyen gan nhat khi vao trang (chi 1 lan, khong ghi de lua chon cua nguoi dung).
  useEffect(() => {
    if (activeConversationId || conversations.length === 0) return;
    setActiveConversationId(conversations[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const unknownLabel = t('messaging:page.unknownUser');

  function handleCreated(conversation: ConversationWithOwner) {
    setActiveConversationId(conversation.id);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('messaging:page.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('messaging:page.subtitle')}</p>
        </div>
        <Button onClick={() => setIsNewConversationOpen(true)}>
          <PlusIcon className="h-4 w-4" />
          {t('messaging:page.newConversation')}
        </Button>
      </div>

      <div className="flex h-[calc(100vh-190px)] min-h-[420px] gap-4">
        <Card className="flex w-72 shrink-0 flex-col overflow-hidden sm:w-80">
          <QueryState
            isLoading={conversationsQuery.isLoading}
            isError={conversationsQuery.isError}
            onRetry={() => conversationsQuery.refetch()}
            errorTitle={t('messaging:page.errorTitle')}
            errorDescription={t('messaging:page.errorDescription')}
          >
            {conversations.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={<MessageIcon className="h-7 w-7" />} title={t('messaging:page.emptyListTitle')} description={t('messaging:page.emptyListDescription')} />
              </div>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                {conversations.map((conversation) => {
                  const displayName = getConversationDisplayName(conversation, currentUserId, userNames, unknownLabel);
                  const isActive = conversation.id === activeConversationId;
                  const lastMessage = conversation.lastMessage;
                  const previewBody = lastMessage
                    ? lastMessage.senderId === currentUserId
                      ? t('messaging:page.lastMessagePreviewMine', { body: lastMessage.body })
                      : lastMessage.body
                    : t('messaging:page.noMessagesYet');

                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => setActiveConversationId(conversation.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                          isActive ? 'bg-primary-50/70' : 'hover:bg-slate-50',
                        )}
                      >
                        <Avatar name={displayName} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                            {lastMessage && <span className="shrink-0 text-[10px] text-slate-400">{formatRelativeTime(lastMessage.createdAt)}</span>}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className="truncate text-xs text-slate-500">{previewBody}</p>
                            {conversation.unreadCount > 0 && (
                              <Badge variant="info" className="shrink-0 bg-primary-600 text-white">
                                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryState>
        </Card>

        <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {activeConversation ? (
            <ConversationThread key={activeConversation.id} conversation={activeConversation} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState icon={<MessageIcon className="h-8 w-8" />} title={t('messaging:page.selectConversationTitle')} description={t('messaging:page.selectConversationDescription')} />
            </div>
          )}
        </Card>
      </div>

      <NewConversationModal open={isNewConversationOpen} onClose={() => setIsNewConversationOpen(false)} onCreated={handleCreated} />
    </div>
  );
}
