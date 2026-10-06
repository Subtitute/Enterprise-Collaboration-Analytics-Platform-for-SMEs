import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  CalendarCheckIcon,
  CalendarXIcon,
  CheckSquareIcon,
  AtSignIcon,
  MessageSquareIcon,
  FolderSyncIcon,
  InfoIcon,
} from '@/components/ui/Icons';

export interface NotificationItemProps {
  id: string;
  type?: string;
  title: string;
  body: string;
  time: string;
  isUnread?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Trả về cấu hình icon đơn sắc 16px và màu ngữ cảnh theo bảng spec §5.3
 */
function getSemanticIconConfig(type?: string, title?: string): {
  icon: ReactNode;
  iconColor: string;
} {
  const t = (type || '').toLowerCase();
  const rawTitle = (title || '').toLowerCase();

  // 1. Nghỉ phép duyệt: success #2F6F44
  if (t.includes('leave_request.approved') || rawTitle.includes('nghỉ phép đã được duyệt') || rawTitle.includes('approved')) {
    return {
      icon: <CalendarCheckIcon className="h-4 w-4" />,
      iconColor: 'text-[#2F6F44]',
    };
  }

  // 2. Nghỉ phép từ chối: error #B3261E
  if (t.includes('leave_request.rejected') || rawTitle.includes('từ chối') || rawTitle.includes('rejected')) {
    return {
      icon: <CalendarXIcon className="h-4 w-4" />,
      iconColor: 'text-[#B3261E]',
    };
  }

  // 3. Mention: accent #0E5E5E
  if (t.includes('mention') || rawTitle.includes('nhắc đến')) {
    return {
      icon: <AtSignIcon className="h-4 w-4" />,
      iconColor: 'text-[#0E5E5E]',
    };
  }

  // 4. Bình luận mới: accent #0E5E5E
  if (t.includes('comment') || rawTitle.includes('bình luận')) {
    return {
      icon: <MessageSquareIcon className="h-4 w-4" />,
      iconColor: 'text-[#0E5E5E]',
    };
  }

  // 5. Giao công việc: accent #0E5E5E
  if (t.includes('task') || rawTitle.includes('công việc')) {
    return {
      icon: <CheckSquareIcon className="h-4 w-4" />,
      iconColor: 'text-[#0E5E5E]',
    };
  }

  // 6. Cập nhật dự án / tài liệu: info #1E5A8A
  if (t.includes('project') || t.includes('document') || rawTitle.includes('dự án') || rawTitle.includes('tài liệu')) {
    return {
      icon: <FolderSyncIcon className="h-4 w-4" />,
      iconColor: 'text-[#1E5A8A]',
    };
  }

  // 7. Hệ thống / Mặc định: text-secondary
  return {
    icon: <InfoIcon className="h-4 w-4" />,
    iconColor: 'text-text-secondary',
  };
}

/**
 * Định dạng mã hiển thị dạng #A263DCEF từ id
 */
function formatEntityId(id: string): string {
  if (!id) return '';
  const clean = id.replace(/[^0-9a-zA-Z]/g, '');
  if (clean.length >= 8) {
    return `#${clean.slice(0, 8).toUpperCase()}`;
  }
  return `#${clean.toUpperCase()}`;
}

/**
 * NotificationItem (DS v0.4): Hàng thông báo tái sử dụng cho Notification Dropdown và Notification Page (Module 08)
 * - Padding 12x16, hover nền bg-subtle
 * - Unread dot 6px màu accent #0E5E5E, absolute left 8px
 * - Icon frame 28x28 nền bg-subtle, icon đơn sắc 16px
 * - Title 13/500 text-primary, line-clamp-2
 * - Body 13/400 text-secondary, line-clamp-2
 * - Meta: ID IBM Plex Mono 11/500 text-tertiary + time 12/400 text-tertiary
 */
export function NotificationItem({
  id,
  type,
  title,
  body,
  time,
  isUnread,
  onClick,
  className,
}: NotificationItemProps) {
  const { icon, iconColor } = getSemanticIconConfig(type, title);
  const formattedId = formatEntityId(id);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${isUnread ? 'Chưa đọc: ' : ''}${title}. ${body}`}
      className={cn(
        'group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-bg-subtle focus-visible:outline-none focus-visible:bg-bg-subtle focus-visible:ring-1 focus-visible:ring-accent',
        className,
      )}
    >
      {/* 5.2. Unread indicator: Dot 6px, màu accent #0E5E5E, absolute left 8px, top 18px */}
      {isUnread && (
        <>
          <span
            className="absolute left-2 top-[18px] h-1.5 w-1.5 rounded-full bg-[#0E5E5E]"
            aria-hidden="true"
          />
          <span className="sr-only">Chưa đọc</span>
        </>
      )}

      {/* 5.3. Icon Frame: 28x28, radius 4px, nền bg-subtle, icon đơn sắc 16px */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-radius-sm bg-bg-subtle mt-0.5',
          iconColor,
        )}
      >
        {icon}
      </div>

      {/* 5.4. Typography phân cấp */}
      <div className="min-w-0 flex-1">
        {/* Dòng 1 — Title: 13/20 weight 500, line-clamp 2 */}
        <p className="line-clamp-2 text-[13px] leading-5 font-medium text-text-primary">
          {title}
        </p>

        {/* Dòng 2 — Body: 13/20 weight 400, line-clamp 2, cách title 2px */}
        {body && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 font-normal text-text-secondary">
            {body}
          </p>
        )}

        {/* Dòng 3 — Meta row: ID font mono 11/500 text-tertiary + time 12/400 text-tertiary */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-medium text-text-tertiary tracking-tight">
            {formattedId}
          </span>
          <span className="shrink-0 text-xs font-normal text-text-tertiary">
            {time}
          </span>
        </div>
      </div>
    </button>
  );
}
