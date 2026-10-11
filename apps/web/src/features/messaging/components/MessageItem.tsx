import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon } from '@/components/ui/Icons';
import { cn, formatTime, formatRelativeTime } from '@/lib/utils';
import { detectLeaveIntent } from '../utils/leaveDetection';
import { LeaveRequestSuggestion } from './LeaveRequestSuggestion';
import type { ChatMessage } from '@/types';

export interface MessageItemProps {
  message: ChatMessage;
  isMine: boolean;
  senderName?: string;
  showSenderName: boolean;
  onRequestDelete: (messageId: string) => void;
}

export const MessageItem = React.memo(function MessageItem({
  message,
  isMine,
  senderName,
  showSenderName,
  onRequestDelete,
}: MessageItemProps) {
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
              onClick={() => onRequestDelete(message.id)}
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
});

