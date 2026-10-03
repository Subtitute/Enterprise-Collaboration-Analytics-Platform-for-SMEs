import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dropdown } from '@/components/ui/Dropdown';
import { BellIcon } from '@/components/ui/Icons';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsQuery, useUnreadNotificationsCount } from '../hooks';
import { cleanNotificationMessage, getNotificationVisualConfig, formatNotificationTitle } from '../utils';
import type { AppNotification } from '@/types';

const PAGE_SIZE = 10;
// Tham chieu on dinh cho truong hop chua co du lieu - tranh tao mang rong MOI (`?? []`) o moi lan
// render, vi mot mang moi se khien effect tich luy ben duoi tuong bi "thay doi" lien tuc va chay lai.
const EMPTY_NOTIFICATIONS: AppNotification[] = [];

// 03/10/2026: trang /notifications rieng da bi xoa (yeu cau chu du an - bell phai la noi DUY NHAT
// quan ly thong bao). Danh sach gio tai TOAN BO thong bao (bo dieu kien isRead:false + limit:6 cu)
// va tu phan trang bang nut "Tai them" ben trong panel, mirror dung logic accumulatedItems da duoc
// kiem chung cua NotificationsPage.tsx truoc khi xoa file do.
export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<AppNotification[]>([]);

  const query = useNotificationsQuery({ page, limit: PAGE_SIZE });
  // So luong chua doc cho dau cham tren chuong phai tach khoi query danh sach o tren: danh sach gio
  // la TOAN BO thong bao (da doc + chua doc) nen meta.total cua no khong con la so chua doc nua.
  const { data: unreadData } = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = unreadData?.meta.total ?? 0;

  const currentData = query.data?.data ?? EMPTY_NOTIFICATIONS;
  const meta = query.data?.meta ?? { page: 1, limit: PAGE_SIZE, total: 0 };

  useEffect(() => {
    if (page === 1) {
      setAccumulated(currentData);
    } else if (currentData.length > 0) {
      // 03/10/2026: sua loi thuc te phat hien qua rieng soat - ban cu CHI them id chua tung thay,
      // bo qua hoan toan id da co trong `prev`, nen 1 thong bao o trang 2+ KHONG BAO GIO duoc cap
      // nhat lai du backend da tra du lieu moi hon (vd vua danh dau da doc, invalidate query qua
      // mutation hoac socket `notification:new`/poll 30s) - dau cham "chua doc" trong dropdown cu
      // dung mai cho den khi component unmount. Sua bang cach "upsert": ghi de du lieu moi nhat
      // cho moi id da co trong prev (giu nguyen vi tri), chi noi them id THUC SU chua tung thay vao
      // cuoi danh sach.
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

  function handleItemClick(n: AppNotification, visual: ReturnType<typeof getNotificationVisualConfig>, close: () => void) {
    if (!n.isRead) markRead.mutate(n.id);
    if (visual.linkUrl) {
      // Co lien ket -> dieu huong ngay (giu hanh vi cu) nhung bang navigate() cua react-router thay
      // vi window.location.href: tranh reload toan trang, giu nguyen SPA state (query cache, scroll...).
      close();
      navigate(visual.linkUrl);
    } else {
      // Khong co lien ket nao de toi -> khong con gi de dieu huong, mo rong tai cho de hien full noi
      // dung (truoc day bi line-clamp-2 cat bot) la hanh dong huu ich duy nhat.
      setExpandedId((prev) => (prev === n.id ? null : n.id));
    }
  }

  return (
    <Dropdown
      align="right"
      panelClassName="w-80 p-0"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={t('notifications:bell.ariaLabel')}
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex max-h-[420px] flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">{t('notifications:bell.title')}</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-primary-600 hover:underline cursor-pointer"
              >
                {t('notifications:bell.markAllRead')}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {page === 1 && query.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : accumulated.length === 0 ? (
              <div className="px-4 py-6">
                <EmptyState title={t('notifications:bell.empty')} />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {accumulated.map((n: AppNotification) => {
                  const visual = getNotificationVisualConfig(n, t);
                  const cleanedMessage = cleanNotificationMessage(n.message);
                  const notificationTitle = formatNotificationTitle(n, t);
                  const isExpanded = expandedId === n.id;

                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleItemClick(n, visual, close)}
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
                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">{notificationTitle}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">{formatRelativeTime(n.createdAt)}</span>
                          </div>
                          <p
                            className={cn(
                              'mt-0.5 text-xs text-slate-600 leading-normal',
                              !isExpanded && 'line-clamp-2',
                            )}
                          >
                            {cleanedMessage}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={query.isLoading}
              className="flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-primary-600 transition-colors hover:bg-slate-50 rounded-b-xl disabled:opacity-60 cursor-pointer"
            >
              {query.isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" /> {t('common:loading')}
                </span>
              ) : (
                t('notifications:bell.loadMore', { loaded: accumulated.length, total: meta.total })
              )}
            </button>
          )}
        </div>
      )}
    </Dropdown>
  );
}
