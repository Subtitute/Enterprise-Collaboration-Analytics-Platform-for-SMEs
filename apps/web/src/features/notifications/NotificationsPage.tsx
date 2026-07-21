import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { BellIcon } from '@/components/ui/Icons';
import { cn, formatDateTime } from '@/lib/utils';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationsQuery } from './hooks';
import type { AppNotification } from '@/types';

const LIMIT = 15;

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả loại' },
  { value: 'TASK', label: 'Task' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'SYSTEM', label: 'Hệ thống' },
];

export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const query = useNotificationsQuery({
    isRead: filter === 'unread' ? false : undefined,
    type: typeFilter || undefined,
    page,
    limit: LIMIT,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = query.data?.data ?? [];
  const meta = query.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };

  function handleFilterChange(value: string) {
    setFilter(value as 'all' | 'unread');
    setPage(1);
  }

  function handleTypeChange(value: string) {
    setTypeFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Thông báo</h1>
          <p className="text-sm text-slate-500">Toàn bộ thông báo liên quan đến hoạt động của bạn.</p>
        </div>
        <Button variant="outline" onClick={() => markAllRead.mutate()} isLoading={markAllRead.isPending}>
          Đánh dấu tất cả đã đọc
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3">
          <Tabs
            value={filter}
            onChange={handleFilterChange}
            tabs={[
              { value: 'all', label: 'Tất cả' },
              { value: 'unread', label: 'Chưa đọc' },
            ]}
          />
          <Select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="mb-1 text-sm"
            style={{ width: 'auto' }}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
          errorTitle="Không thể tải thông báo"
          loadingFallback={<FullPageSpinner label="Đang tải thông báo…" />}
        >
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<BellIcon className="h-8 w-8" />} title="Không có thông báo" />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((n: AppNotification) => (
                <li key={n.id} className={cn('flex items-start gap-3 px-5 py-4', !n.isRead && 'bg-primary-50/30')}>
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      n.isRead ? 'border border-slate-300 bg-white' : 'bg-primary-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => markRead.mutate(n.id)}
                      className="shrink-0 text-xs font-medium text-primary-600 hover:text-primary-700"
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryState>

        <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
      </Card>
    </div>
  );
}
