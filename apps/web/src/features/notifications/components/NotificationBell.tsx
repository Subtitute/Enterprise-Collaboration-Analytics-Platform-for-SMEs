import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { PopoverPanel } from '@/components/ui/PopoverPanel';
import { NotificationItem } from './NotificationItem';
import { BellIcon, BellOffIcon, AlertCircleIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsQuery,
  useUnreadNotificationsCount,
} from '../hooks';
import {
  cleanNotificationMessage,
  getNotificationVisualConfig,
  formatNotificationTitle,
} from '../utils';
import type { AppNotification } from '@/types';

const PAGE_SIZE = 10;
const EMPTY_NOTIFICATIONS: AppNotification[] = [];

/**
 * Định dạng thời gian tương đối chuẩn spec §5.5:
 * < 1 phút: "Vừa xong"
 * 1–59 phút: "{n} phút trước"
 * 1–23 giờ: "{n} giờ trước"
 * 1–6 ngày: "{n} ngày trước"
 * 7–29 ngày: "{n} tuần trước"
 * >= 30 ngày: "DD/MM/YYYY" (GMT+7)
 */
function formatNotificationRelativeTime(value: string | null | undefined, t: TFunction, lang: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 60) return t('notifications:relativeTime.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('notifications:relativeTime.minutesAgo', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('notifications:relativeTime.hoursAgo', { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return t('notifications:relativeTime.daysAgo', { count: diffDay });
  if (diffDay < 30) {
    const diffWeek = Math.floor(diffDay / 7);
    return t('notifications:relativeTime.weeksAgo', { count: diffWeek });
  }

  const locale = lang === 'en' ? 'en-US' : lang === 'ja' ? 'ja-JP' : 'vi-VN';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<AppNotification[]>([]);
  // Optimistic cleared badge flag: khi bấm "Đánh dấu tất cả đã đọc" thì badge ẩn ngay
  const [hasClearedAllUnread, setHasClearedAllUnread] = useState(false);

  const query = useNotificationsQuery({ page, limit: PAGE_SIZE });
  const { data: unreadData } = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const serverUnreadCount = unreadData?.meta.total ?? 0;
  // Nếu đã bấm đánh dấu tất cả đã đọc trong session hiển thị này -> hiển thị 0 ngay lập tức
  const unreadCount = hasClearedAllUnread ? 0 : serverUnreadCount;

  // Khi serverUnreadCount trả về 0 thật sự thì reset flag cleared
  useEffect(() => {
    if (serverUnreadCount === 0) {
      setHasClearedAllUnread(false);
    }
  }, [serverUnreadCount]);

  const currentData = query.data?.data ?? EMPTY_NOTIFICATIONS;
  const meta = query.data?.meta ?? { page: 1, limit: PAGE_SIZE, total: 0 };

  useEffect(() => {
    if (page === 1) {
      setAccumulated(currentData);
    } else if (currentData.length > 0) {
      setAccumulated((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const freshById = new Map(currentData.map((item) => [item.id, item]));
        const refreshedPrev = prev.map((item) => freshById.get(item.id) ?? item);
        const newOnes = currentData.filter((item) => !existingIds.has(item.id));
        return [...refreshedPrev, ...newOnes];
      });
    }
  }, [currentData, page]);

  const hasMore = accumulated.length < meta.total;

  const handleMarkAllRead = () => {
    // 1. Cập nhật lạc quan: ẩn badge số ngay lập tức
    setHasClearedAllUnread(true);
    // 2. Cập nhật lạc quan danh sách đang hiển thị: chuyển tất cả isRead = true
    setAccumulated((prev) => prev.map((item) => ({ ...item, isRead: true })));
    // 3. Gửi mutation API
    markAllRead.mutate();
  };

  const handleItemClick = (
    n: AppNotification,
    visual: ReturnType<typeof getNotificationVisualConfig>,
  ) => {
    if (!n.isRead) {
      // Đánh dấu đã đọc trong danh sách hiển thị
      setAccumulated((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)),
      );
      markRead.mutate(n.id);
    }
    if (visual.linkUrl) {
      setIsOpen(false);
      navigate(visual.linkUrl);
    }
  };

  return (
    <div className="relative">
      {/* Trigger: 32x32px, ghost button kèm badge đỏ */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t('notifications:bell.ariaLabel', { count: unreadCount })}
        aria-expanded={isOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-radius-md text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#B3261E] px-1 text-[10px] font-semibold text-white border-2 border-bg-surface">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* PopoverPanel: khung popover cố định 400px theo DS v0.4 */}
      <PopoverPanel
        open={isOpen}
        onClose={() => setIsOpen(false)}
        width={400}
        aria-label={t('notifications:bell.title')}
      >
        {/* Header (cố định, không scroll): 48px, padding 12x16, border-bottom 1px */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-4">
          <h3 className="text-[15px] leading-none font-medium text-text-primary">
            {t('notifications:bell.title')}
          </h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="rounded-radius-sm px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft transition-colors cursor-pointer"
            >
              {t('notifications:bell.markAllRead')}
            </button>
          )}
        </div>

        {/* Nội dung danh sách cuộn: popover-scrollbar */}
        <div className="flex-1 overflow-y-auto popover-scrollbar">
          {page === 1 && query.isLoading ? (
            /* 6.3. Loading State — Skeleton Shimmer 4 cards */
            <div className="divide-y divide-border-subtle" aria-busy="true">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
                  <div className="h-7 w-7 shrink-0 rounded-radius-sm bg-bg-subtle mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-bg-subtle" />
                    <div className="h-3 w-full rounded bg-bg-subtle" />
                    <div className="flex items-center justify-between pt-1">
                      <div className="h-2.5 w-16 rounded bg-bg-subtle" />
                      <div className="h-2.5 w-12 rounded bg-bg-subtle" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : query.isError ? (
            /* 6.2. Error State */
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-radius-sm bg-bg-subtle text-[#B3261E]">
                <AlertCircleIcon className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-text-primary">
                {t('notifications:bell.errorTitle')}
              </p>
              <button
                type="button"
                onClick={() => query.refetch()}
                className="mt-3 rounded-radius-sm border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-subtle transition-colors cursor-pointer"
              >
                {t('common:queryState.retry')}
              </button>
            </div>
          ) : accumulated.length === 0 ? (
            /* 6.1. Empty State */
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-radius-sm bg-bg-subtle text-text-tertiary">
                <BellOffIcon className="h-10 w-10" />
              </div>
              <p className="mt-3 text-sm font-medium text-text-primary">
                {t('notifications:bell.emptyTitle')}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {t('notifications:bell.emptyDescription')}
              </p>
            </div>
          ) : (
            /* Danh sách item */
            <div className="divide-y divide-border-subtle">
              {accumulated.map((n: AppNotification) => {
                const visual = getNotificationVisualConfig(n, t);
                const cleanedMessage = cleanNotificationMessage(n.message);
                const notificationTitle = formatNotificationTitle(n, t);
                const timeStr = formatNotificationRelativeTime(n.createdAt, t, i18n.language);

                return (
                  <NotificationItem
                    key={n.id}
                    id={n.id}
                    type={n.type}
                    title={notificationTitle}
                    body={cleanedMessage}
                    time={timeStr}
                    isUnread={!n.isRead}
                    onClick={() => handleItemClick(n, visual)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* 8. Footer (cố định dưới cùng khi có thêm dữ liệu): 44px, padding 10x16, border-top 1px */}
        {hasMore && (
          <div className="shrink-0 border-t border-border-subtle bg-bg-surface px-4 py-2">
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={query.isLoading}
              className="flex h-7 w-full items-center justify-center gap-2 rounded-radius-sm text-xs font-medium text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
            >
              {query.isLoading ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="sm" /> {t('common:loading')}
                </span>
              ) : (
                t('notifications:bell.loadMore', {
                  loaded: accumulated.length,
                  total: meta.total,
                })
              )}
            </button>
          </div>
        )}
      </PopoverPanel>
    </div>
  );
}
