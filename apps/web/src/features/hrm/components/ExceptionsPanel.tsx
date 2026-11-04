import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { QueryState } from '@/components/ui/QueryState';
import { formatTime } from '@/lib/utils';
import { TIMESHEET_EXCEPTION_TYPES } from '@/types';
import type { TimesheetExceptionRow, TimesheetExceptionType, User } from '@/types';
import { useTimesheetExceptionsQuery } from '../hooks';
import { displayUserName } from './timesheet-shared';

const PAGE_SIZE = 20;

interface ExceptionsPanelProps {
  selectedMonth: string; // 'YYYY-MM' or 'all'
  today: string; // 'YYYY-MM-DD' GMT+7
  users: User[];
}

/**
 * 04/11/2026: tab "Ngoai le" cua bang cong - danh sach ngay bat thuong (muon, ve som, vang, quen cham ra,
 * chua cham vao, lam them khong co cham cong) do may chu tinh tu cung computeMonth() voi bang cong. O dem theo
 * loai bam duoc de loc; hien them so don dang cho de quan ly biet con gi chua duyet truoc khi khoa ky.
 */
export function ExceptionsPanel({ selectedMonth, today, users }: ExceptionsPanelProps) {
  const { t } = useTranslation();
  const month = selectedMonth && selectedMonth !== 'all' ? selectedMonth : today.slice(0, 7);
  const [type, setType] = useState<TimesheetExceptionType | undefined>(undefined);
  const [page, setPage] = useState(1);

  // Doi thang/loai thi ve trang 1.
  useEffect(() => {
    setPage(1);
  }, [month, type]);

  const query = useTimesheetExceptionsQuery({ month, type, page, limit: PAGE_SIZE });
  const data = query.data;
  const userMap = new Map(users.map((u) => [u.id, u]));
  const rows = data?.data ?? [];

  function detailOf(row: TimesheetExceptionRow): string {
    const parts: string[] = [];
    if (row.minutes && row.minutes > 0) parts.push(t('hrm:exceptions.minutes', { count: row.minutes }));
    if (row.checkInAt) parts.push(`${t('hrm:exceptions.in')} ${formatTime(row.checkInAt)}`);
    if (row.checkOutAt) parts.push(`${t('hrm:exceptions.out')} ${formatTime(row.checkOutAt)}`);
    if (row.otHours && row.otHours > 0) parts.push(`${row.otHours}h OT`);
    return parts.length > 0 ? parts.join(' · ') : '—';
  }

  function dateOf(workDate: string): string {
    return `${workDate.slice(8, 10)}/${workDate.slice(5, 7)}/${workDate.slice(0, 4)}`;
  }

  return (
    <div className="space-y-4">
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorTitle={t('hrm:exceptions.loadError')}
      >
        {/* O dem theo loai: bam de loc, bam lai de bo loc */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {TIMESHEET_EXCEPTION_TYPES.map((tp) => {
            const active = type === tp;
            const count = data?.counts?.[tp] ?? 0;
            return (
              <button
                key={tp}
                type="button"
                aria-pressed={active}
                onClick={() => setType(active ? undefined : tp)}
                className={`rounded-radius-sm border p-2.5 text-left transition-colors cursor-pointer ${
                  active ? 'border-text-primary bg-bg-subtle' : 'border-border-subtle bg-white hover:border-border-strong'
                }`}
              >
                <p className={`font-mono text-[20px] leading-[26px] font-medium tabular-nums ${count > 0 ? 'text-text-primary' : 'text-text-tertiary'}`}>
                  {count}
                </p>
                <p className="text-[11px] text-text-secondary">{t(`hrm:exceptions.types.${tp}`)}</p>
              </button>
            );
          })}
        </div>

        {/* Số đơn đang chờ duyệt trong tháng */}
        <p className="text-[12px] text-text-secondary">
          {t('hrm:exceptions.pendingSummary', {
            leave: data?.pending?.leave ?? 0,
            overtime: data?.pending?.overtime ?? 0,
            adjustment: data?.pending?.adjustment ?? 0,
          })}
        </p>

        {rows.length === 0 ? (
          <EmptyState title={t('hrm:exceptions.emptyTitle')} description={t('hrm:exceptions.emptyDescription')} />
        ) : (
          <>
            {/* Desktop: bang */}
            <div className="hidden sm:block overflow-x-auto rounded-radius-sm border border-border-subtle">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-subtle border-b border-border-subtle">
                  <tr className="text-left text-[12px] font-medium text-text-tertiary">
                    <th className="py-2.5 px-3">{t('hrm:exceptions.columns.employee')}</th>
                    <th className="py-2.5 px-3">{t('hrm:exceptions.columns.date')}</th>
                    <th className="py-2.5 px-3">{t('hrm:exceptions.columns.type')}</th>
                    <th className="py-2.5 px-3">{t('hrm:exceptions.columns.detail')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle bg-white">
                  {rows.map((row) => {
                    const name = displayUserName(userMap.get(row.userId), t('hrm:timesheet.unknownEmployee'));
                    return (
                      <tr key={`${row.type}-${row.userId}-${row.workDate}`} className="h-12">
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Avatar name={name} size="sm" className="h-6 w-6 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] font-semibold" />
                            <span className="font-medium text-text-primary truncate max-w-[180px]">{name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono text-[12px] tabular-nums whitespace-nowrap">{dateOf(row.workDate)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-warning-soft text-warning">
                            {t(`hrm:exceptions.types.${row.type}`)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-text-secondary">{detailOf(row)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: the (cung kieu the voi MonthlyTimesheetTable) */}
            <div className="block sm:hidden space-y-2.5">
              {rows.map((row) => {
                const name = displayUserName(userMap.get(row.userId), t('hrm:timesheet.unknownEmployee'));
                return (
                  <div key={`${row.type}-${row.userId}-${row.workDate}`} className="p-3 rounded-radius-sm border border-border-subtle bg-white space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={name} size="sm" className="h-7 w-7 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] font-semibold" />
                        <p className="font-semibold text-[13px] text-text-primary truncate">{name}</p>
                      </div>
                      <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold shrink-0 bg-warning-soft text-warning">
                        {t(`hrm:exceptions.types.${row.type}`)}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary">
                      <span className="font-mono tabular-nums">{dateOf(row.workDate)}</span> · {detailOf(row)}
                    </p>
                  </div>
                );
              })}
            </div>

            <Pagination page={page} limit={data?.meta?.limit ?? PAGE_SIZE} total={data?.meta?.total ?? rows.length} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </div>
  );
}
