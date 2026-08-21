import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@/components/ui/Dropdown';
import { BellIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useUnreadNotificationsPreview } from '../hooks';
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
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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
                {data.data.map((n: AppNotification) => (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        markRead.mutate(n.id);
                        close();
                      }}
                      className={cn(
                        'flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-slate-50',
                        !n.isRead && 'bg-primary-50/40',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          n.isRead ? 'border border-slate-300 bg-white' : 'bg-primary-500',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            to="/notifications"
            onClick={close}
            className="border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-primary-600 hover:bg-slate-50"
          >
            {t('notifications:bell.viewAll')}
          </Link>
        </div>
      )}
    </Dropdown>
  );
}
