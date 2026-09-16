import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@/components/ui/Dropdown';
import { BellIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useUnreadNotificationsPreview } from '../hooks';
import { cleanNotificationMessage, getNotificationVisualConfig } from '../utils';
import type { AppNotification } from '@/types';

export function NotificationBell() {
  const { t } = useTranslation();
  const { data, isLoading } = useUnreadNotificationsPreview();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = data?.meta.total ?? 0;

  return (
    <Dropdown
      align="right"
      panelClassName="w-80"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={t('notifications:bell.ariaLabel')}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex max-h-[26rem] flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{t('notifications:bell.title')}</p>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                disabled={markAllRead.isPending}
              >
                {t('notifications:bell.markAllRead')}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : !data || data.data.length === 0 ? (
              <div className="px-4 py-6">
                <EmptyState title={t('notifications:bell.empty')} />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.data.map((n: AppNotification) => {
                  const visual = getNotificationVisualConfig(n);
                  const cleanedMessage = cleanNotificationMessage(n.message);

                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => {
                          markRead.mutate(n.id);
                          close();
                          if (visual.linkUrl) {
                            window.location.href = visual.linkUrl;
                          }
                        }}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer',
                          !n.isRead && 'bg-primary-50/40',
                        )}
                      >
                        <div className="relative shrink-0 pt-0.5">
                          <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs shadow-2xs', visual.bgColor)}>
                            {visual.icon}
                          </div>
                          {!n.isRead && (
                            <span
                              className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary-600 ring-2 ring-white"
                              title={t('notifications:bell.unreadTitle')}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">{n.title}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">{formatRelativeTime(n.createdAt)}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 leading-normal">{cleanedMessage}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link
            to="/notifications"
            onClick={close}
            className="border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-primary-600 transition-colors hover:bg-slate-50 rounded-b-xl"
          >
            {t('notifications:bell.viewAll')}
          </Link>
        </div>
      )}
    </Dropdown>
  );
}
