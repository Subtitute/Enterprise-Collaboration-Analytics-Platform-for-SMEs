import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { MessageIcon, TrashIcon } from '@/components/ui/Icons';
import { cn, formatDateTime, formatRelativeTime } from '@/lib/utils';
import { useChatbotConversations, useDeleteChatbotConversation } from '../hooks';

interface ChatbotHistoryProps {
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onDeleted: (conversationId: string) => void;
}

/** 24/10/2026: lich su hoi thoai CUA CHINH nguoi dung (moi nhat truoc) - mo lai hoac xoa tung hoi thoai. */
export function ChatbotHistory({ activeConversationId, onSelect, onDeleted }: ChatbotHistoryProps) {
  const { t } = useTranslation();
  const conversationsQuery = useChatbotConversations(true);
  const deleteConversation = useDeleteChatbotConversation();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const conversations = conversationsQuery.data ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {conversationsQuery.isLoading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}
      {conversationsQuery.isError && <p className="px-2 py-6 text-center text-[12px] text-rose-700">{t('chatbot:history.loadError')}</p>}
      {conversationsQuery.isSuccess && conversations.length === 0 && (
        <p className="px-2 py-8 text-center text-[12px] text-text-tertiary">{t('chatbot:history.empty')}</p>
      )}

      <ul className="space-y-0.5">
        {conversations.map((conversation) => (
          <li key={conversation.id} className="group flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              aria-current={conversation.id === activeConversationId ? 'true' : undefined}
              className={cn(
                'flex min-w-0 flex-1 items-start gap-2 rounded-radius-md px-2.5 py-2 text-left transition-colors cursor-pointer',
                conversation.id === activeConversationId ? 'bg-accent-soft' : 'hover:bg-bg-subtle',
              )}
            >
              <MessageIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-text-primary">
                  {conversation.title ?? t('chatbot:history.untitled')}
                </span>
                <span className="block font-mono text-[11px] tabular-nums text-text-tertiary" title={formatDateTime(conversation.updatedAt)}>
                  {formatRelativeTime(conversation.updatedAt)}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPendingDeleteId(conversation.id)}
              aria-label={t('chatbot:history.delete')}
              title={t('chatbot:history.delete')}
              className="shrink-0 rounded p-1.5 text-text-tertiary opacity-60 transition-opacity hover:bg-error-soft hover:text-error group-hover:opacity-100 focus:opacity-100 cursor-pointer"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const conversationId = pendingDeleteId;
          if (!conversationId) return;
          deleteConversation.mutate(conversationId, { onSuccess: () => onDeleted(conversationId) });
          setPendingDeleteId(null);
        }}
        title={t('chatbot:history.confirmDeleteTitle')}
        description={t('chatbot:history.confirmDeleteDescription')}
        danger
        isLoading={deleteConversation.isPending}
      />
    </div>
  );
}
