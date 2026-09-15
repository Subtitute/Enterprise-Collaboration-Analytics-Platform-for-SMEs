import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { BellIcon, ChevronDownIcon, CheckIcon } from '@/components/ui/Icons';
import { cn, formatDateTime } from '@/lib/utils';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsQuery } from './hooks';
import { cleanNotificationMessage, extractEntityHash, getNotificationVisualConfig, formatNotificationTitle } from './utils';
import type { AppNotification } from '@/types';

const LIMIT = 15;

export function NotificationsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [accumulatedItems, setAccumulatedItems] = useState<AppNotification[]>([]);

  const typeOptions: { value: string; label: string }[] = [
    { value: '', label: t('notifications:page.typeFilter.all') },
    { value: 'task.assigned', label: t('notifications:page.typeFilter.task') },
    { value: 'deal.stage_changed', label: t('notifications:page.typeFilter.deal') },
    { value: 'leave_request', label: t('notifications:page.typeFilter.leave_request') },
    { value: 'document.shared', label: t('notifications:page.typeFilter.document') },
    { value: 'SYSTEM', label: t('notifications:page.typeFilter.system') },
  ];

  const query = useNotificationsQuery({
    isRead: filter === 'unread' ? false : undefined,
    // Lưu ý: Backend notification-service lưu type là 'leave_request.approved' / 'leave_request.rejected'
    // và query exact match { type: query.type }. Nếu gửi 'leave_request', backend trả về [] rỗng.
    // Vì vậy ta fetch danh sách tổng hợp (type: undefined) và để client-side filter hiển thị toàn bộ chính xác.
    type: typeFilter === 'leave_request' ? undefined : (typeFilter || undefined),
    page,
    limit: LIMIT,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const currentData = query.data?.data ?? [];
  const meta = query.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    }
    if (isTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTypeDropdownOpen]);

  // Tích lũy danh sách thông báo khi bấm "Tải thêm" (Load more), reset khi thay đổi bộ lọc
  useEffect(() => {
    if (page === 1) {
      setAccumulatedItems(currentData);
    } else if (currentData.length > 0) {
      setAccumulatedItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const newItems = currentData.filter((item) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
    }
  }, [currentData, page, filter, typeFilter]);

  function handleFilterChange(value: string) {
    setFilter(value as 'all' | 'unread');
    setPage(1);
    setAccumulatedItems([]);
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value);
    setIsTypeDropdownOpen(false);
    setPage(1);
    setAccumulatedItems([]);
  }

  function handleLoadMore() {
    setPage((prev) => prev + 1);
  }

  const hasMore = accumulatedItems.length < meta.total;
  const currentTypeOption = typeOptions.find((opt) => opt.value === typeFilter) ?? typeOptions[0];

  // Lọc hiển thị đảm bảo độ chính xác tuyệt đối (client-side fallback nếu backend trả về tập hợp rộng)
  const displayedItems = accumulatedItems.filter((n) => {
    if (!typeFilter) return true;
    const itemType = (n.type || '').toLowerCase();

    if (typeFilter === 'leave_request') {
      return itemType.includes('leave') || n.title?.toLowerCase().includes('nghỉ phép');
    }
    if (typeFilter === 'deal.stage_changed') {
      return itemType.includes('deal') || n.title?.toLowerCase().includes('deal');
    }
    if (typeFilter === 'task.assigned') {
      return itemType.includes('task') || n.title?.toLowerCase().includes('công việc');
    }
    if (typeFilter === 'document.shared') {
      return itemType.includes('document') || n.title?.toLowerCase().includes('tài liệu');
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('notifications:page.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('notifications:page.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => markAllRead.mutate()} isLoading={markAllRead.isPending}>
          {t('notifications:page.markAllRead')}
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3">
          <Tabs
            value={filter}
            onChange={handleFilterChange}
            tabs={[
              { value: 'all', label: t('notifications:page.tabs.all') },
              { value: 'unread', label: t('notifications:page.tabs.unread') },
            ]}
          />

          {/* Custom Dropdown chọn loại thông báo với phong cách đồng bộ website */}
          <div className="relative mb-1" ref={typeDropdownRef}>
            <button
              type="button"
              onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
              className={cn(
                'flex h-9 items-center justify-between gap-2.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer min-w-[150px]',
                isTypeDropdownOpen
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-900'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70',
              )}
            >
              <span className="truncate">{currentTypeOption.label}</span>
              <ChevronDownIcon
                className={cn(
                  'h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform duration-200',
                  isTypeDropdownOpen && 'rotate-180 text-indigo-600',
                )}
              />
            </button>

            {/* Menu options xuất hiện ở dưới khi bấm */}
            {isTypeDropdownOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-400/20 animate-slide-up space-y-0.5">
                {typeOptions.map((opt) => {
                  const isSelected = typeFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleTypeChange(opt.value)}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer text-left',
                        isSelected
                          ? 'bg-indigo-50/80 text-indigo-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <CheckIcon className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <QueryState
          isLoading={page === 1 && query.isLoading}
          isError={page === 1 && query.isError}
          onRetry={() => query.refetch()}
          errorTitle={t('notifications:page.loadError')}
          loadingFallback={<FullPageSpinner label={t('notifications:page.loading')} />}
        >
          {displayedItems.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<BellIcon className="h-8 w-8" />} title={t('notifications:page.empty')} />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {displayedItems.map((n: AppNotification) => {
                const visual = getNotificationVisualConfig(n, t);
                const entityHash = extractEntityHash(n);
                const notificationTitle = formatNotificationTitle(n, t);

                return (
                  <li
                    key={n.id}
                    className={cn(
                      'group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors',
                      n.isRead
                        ? 'bg-white hover:bg-slate-50/50'
                        : 'bg-slate-50/70 border-l-4 border-indigo-500 hover:bg-slate-100/60',
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Biểu tượng ngữ cảnh Contextual Icon trong nền tròn màu nhạt theo từng nghiệp vụ */}
                      <div className="relative shrink-0">
                        <div
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-full shadow-2xs transition-transform duration-200 group-hover:scale-105',
                            visual.bgColor,
                          )}
                          title={visual.targetName}
                        >
                          {visual.icon}
                        </div>
                        {/* Dấu chấm trạng thái chưa đọc siêu nhỏ đính kèm góc avatar */}
                        {!n.isRead && (
                          <span
                            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-indigo-600 ring-2 ring-white"
                            title={t('notifications:page.unreadBadge')}
                          />
                        )}
                      </div>

                      {/* Cấu trúc 2 tầng dữ liệu tinh gọn */}
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Tầng 1: Tiêu đề thông báo + Nhãn phân loại nghiệp vụ (Tag) */}
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate max-w-xl">{notificationTitle}</p>
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-slate-100/90 text-slate-600 border border-slate-200/60 shrink-0">
                            {visual.targetName}
                          </span>
                        </div>

                        {/* Tầng 2: Thời gian • Mã định danh rút gọn (#hash) • Liên kết "Xem chi tiết →" */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
                          <span>{formatDateTime(n.createdAt)}</span>
                          {entityHash && (
                            <>
                              <span>•</span>
                              <span className="font-mono font-semibold text-indigo-600/90 bg-indigo-50/60 px-1.5 py-0.5 rounded text-[11px]">
                                {entityHash}
                              </span>
                            </>
                          )}
                          {visual.linkUrl && (
                            <>
                              <span>•</span>
                              <Link
                                to={visual.linkUrl}
                                onClick={() => {
                                  if (!n.isRead) markRead.mutate(n.id);
                                }}
                                className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                              >
                                {t('notifications:page.viewDetails')}
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Cân bằng nhận diện thao tác: Nút mờ nhẹ (opacity-60 hover:opacity-100) tránh nhiễu thị giác */}
                    {!n.isRead && (
                      <button
                        onClick={() => markRead.mutate(n.id)}
                        className="shrink-0 rounded px-2.5 py-1 text-xs font-medium text-indigo-600 bg-white border border-slate-200 shadow-2xs opacity-60 hover:opacity-100 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer"
                        title={t('notifications:page.markRead')}
                      >
                        {t('notifications:page.markRead')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </QueryState>

        {/* Nút "Tải thêm" (Load more) ở cuối danh sách để kiểm soát tải trang khi số lượng tăng cao */}
        {hasMore && accumulatedItems.length > 0 && (
          <div className="flex items-center justify-center p-4 border-t border-slate-100 bg-slate-50/30">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={query.isLoading}
              className="px-6 py-2 text-xs font-semibold shadow-2xs hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
            >
              {query.isLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" /> {t('common:loading')}
                </span>
              ) : (
                t('notifications:page.loadMore', { current: accumulatedItems.length, total: meta.total })
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
