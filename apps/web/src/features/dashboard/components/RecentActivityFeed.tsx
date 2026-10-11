import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { InboxIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useRecentActivityFeed } from '../hooks';
import type { RecentActivityItem } from '@/types';

/**
 * Định dạng thời gian tương đối chuẩn spec GMT+7 (dùng chung Module 04):
 * < 1 phút: "Vừa xong"
 * 1–59 phút: "{n} phút trước"
 * 1–23 giờ: "{n} giờ trước"
 * 1–6 ngày: "{n} ngày trước"
 * 7–29 ngày: "{n} tuần trước"
 * >= 30 ngày: "DD/MM/YYYY" (GMT+7)
 */
function formatGmt7RelativeTime(value: string | null | undefined, t: TFunction, lang: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);

  if (diffSec < 60) return t('dashboard:relativeTime.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('dashboard:relativeTime.minutesAgo', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('dashboard:relativeTime.hoursAgo', { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return t('dashboard:relativeTime.daysAgo', { count: diffDay });
  if (diffDay < 30) {
    const diffWeek = Math.floor(diffDay / 7);
    return t('dashboard:relativeTime.weeksAgo', { count: diffWeek });
  }

  const locale = lang === 'en' ? 'en-US' : lang === 'ja' ? 'ja-JP' : 'vi-VN';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

function parseActivityDetails(item: RecentActivityItem, t: TFunction) {
  const normalized = item.action.replace(/[._]/g, '_').toLowerCase();
  const key = `dashboard:recentActivityFeed.actions.${normalized}`;
  const translated = t(key);
  const actionText = translated && translated !== key && !translated.endsWith(`.${normalized}`)
    ? translated
    : t('dashboard:recentActivityFeed.performedAction');

  // Trích xuất entity name hoặc target route
  let entityName = t('dashboard:entities.task');
  let entityHref = '/projects';

  if (normalized.includes('project')) {
    entityName = t('dashboard:entities.project');
    entityHref = '/projects';
  } else if (normalized.includes('document')) {
    entityName = t('dashboard:entities.document');
    entityHref = '/documents';
  } else if (normalized.includes('leave')) {
    entityName = t('dashboard:entities.leave');
    entityHref = '/leave-requests';
  } else if (normalized.includes('customer') || normalized.includes('deal')) {
    entityName = t('dashboard:entities.customer');
    entityHref = '/customers';
  } else if (normalized.includes('user') || normalized.includes('org') || normalized.includes('department')) {
    entityName = t('dashboard:entities.member');
    entityHref = '/admin/members';
  }

  return { actionText, entityName, entityHref };
}

export function RecentActivityFeed() {
  const { t, i18n } = useTranslation();
  const { items, isLoading, isError } = useRecentActivityFeed();
  const { map: userNames } = useUserNameMap();
  const [isExpanded, setIsExpanded] = useState(false);

  const displayItems = isExpanded ? items : items.slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (isError || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <InboxIcon className="h-10 w-10 text-text-tertiary mb-2" aria-hidden="true" />
        <p className="text-[13px] leading-[20px] text-text-secondary">
          {t('dashboard:recentActivityFeed.emptyTitle')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border-subtle">
        {displayItems.map((item) => {
          const actorName = (item.actorId ? userNames[item.actorId] : undefined) ?? t('dashboard:recentActivityFeed.unknownActor');
          const { actionText, entityName, entityHref } = parseActivityDetails(item, t);

          return (
            <div key={item.id} className="flex items-start gap-3 py-3">
              {/* Avatar 32x32 initials */}
              <Avatar
                name={actorName}
                size="sm"
                className="h-8 w-8 shrink-0 text-xs rounded-full bg-accent-soft text-accent font-medium"
              />

              {/* Thông tin 4 dòng theo §8 */}
              <div className="min-w-0 flex-1">
                {/* Line 1: {Name} font 13/500 text-primary */}
                <p className="text-[13px] leading-[20px] font-medium text-text-primary">
                  {actorName}
                </p>

                {/* Line 2: hành động font 13/400 text-secondary */}
                <p className="text-[13px] leading-[20px] font-normal text-text-secondary">
                  {actionText}
                </p>

                {/* Line 3: Tên entity - font 13/500 text-accent trong ngoặc kép "..." */}
                <p className="text-[13px] leading-[20px]">
                  <Link
                    to={entityHref}
                    className="font-medium text-accent hover:underline inline-block truncate max-w-full"
                  >
                    &ldquo;{entityName}&rdquo;
                  </Link>
                </p>

                {/* Line 4: Relative time font 12/400 text-tertiary (GMT+7) */}
                <p className="mt-0.5 text-[12px] leading-[16px] font-normal text-text-tertiary">
                  {formatGmt7RelativeTime(item.createdAt, t, i18n.language)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA: Xem tất cả hoạt động */}
      {items.length > 5 && (
        <div className="mt-3 text-center border-t border-border-subtle pt-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[13px] font-medium text-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>
              {isExpanded
                ? t('dashboard:recentActivityFeed.collapse')
                : t('dashboard:recentActivityFeed.viewAll')}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

