import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { CalendarIcon } from '@/components/ui/Icons';
import { formatShortDate, calculateWorkingDays } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useUpcomingLeavesQuery } from '../hooks';
import type { LeaveRequest } from '@/types';

/** Tách loại nghỉ phép từ chuỗi reason đã lưu */
function parseLeaveType(rawReason: string | undefined | null, t: (key: string, defaultValue?: string) => string): string {
  if (!rawReason) {
    return t('dashboard:upcomingLeaves.types.ANNUAL');
  }

  const match = rawReason.match(/^\[(.*?)\]\s*(.*)$/);
  const rawType = match ? match[1] : '';

  if (rawType === 'SICK' || rawType.includes('ốm') || rawType.includes('Sick') || rawType.includes('病気')) { // i18n-lint-ignore matches raw backend leaveType data values, not displayed UI copy
    return t('dashboard:upcomingLeaves.types.SICK');
  }

  if (rawType === 'UNPAID' || rawType.includes('việc riêng') || rawType.includes('Personal') || rawType.includes('私用')) { // i18n-lint-ignore matches raw backend leaveType data values, not displayed UI copy
    return t('dashboard:upcomingLeaves.types.UNPAID');
  }

  return t('dashboard:upcomingLeaves.types.ANNUAL');
}

export function UpcomingLeavesWidget() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useUpcomingLeavesQuery();
  const { map: userNameMap } = useUserNameMap();

  // Ngày hiện tại GMT+7 định dạng YYYY-MM-DD
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  }, []);

  // Ngày mai GMT+7 định dạng YYYY-MM-DD
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
  }, []);

  // Lọc chỉ các đơn có ngày kết thúc >= hôm nay, sắp xếp theo ngày bắt đầu tăng dần, lấy tối đa 5 bản ghi
  const upcomingList = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    const activeList = data.filter((item: LeaveRequest) => {
      const endStr = item.endDate ? item.endDate.slice(0, 10) : '';
      return endStr >= todayStr && item.status === 'APPROVED';
    });

    activeList.sort((a, b) => {
      const startA = a.startDate ? a.startDate.slice(0, 10) : '';
      const startB = b.startDate ? b.startDate.slice(0, 10) : '';
      return startA.localeCompare(startB);
    });

    return activeList.slice(0, 5);
  }, [data, todayStr]);

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 h-full flex flex-col justify-between">
      {/* Header: title 15/600 + link Xem tất cả → căn phải font 13/500 accent */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-1">
        <h2 className="text-[15px] leading-[22px] font-semibold text-text-primary">
          {t('dashboard:upcomingLeaves.title')}
        </h2>
        <Link
          to="/leave-requests"
          className="text-[13px] font-medium text-accent hover:underline no-print"
        >
          {t('dashboard:upcomingLeaves.viewAll')}
        </Link>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Spinner className="h-5 w-5 text-accent" />
            <p className="text-xs text-text-tertiary">{t('dashboard:upcomingLeaves.loading')}</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-text-error font-medium">{t('dashboard:upcomingLeaves.errorTitle')}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 text-xs font-semibold text-accent hover:underline cursor-pointer"
            >
              {t('dashboard:upcomingLeaves.retry')}
            </button>
          </div>
        ) : upcomingList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CalendarIcon className="h-10 w-10 text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-[13px] leading-[20px] text-text-secondary">
              {t('dashboard:upcomingLeaves.emptyTitle')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {upcomingList.map((item) => {
              const startStr = item.startDate ? item.startDate.slice(0, 10) : '';
              const endStr = item.endDate ? item.endDate.slice(0, 10) : '';
              const isToday = startStr <= todayStr && endStr >= todayStr;
              const isTomorrow = startStr === tomorrowStr;
              const daysCount = calculateWorkingDays(item.startDate, item.endDate);
              const employeeName = userNameMap[item.userId] || t('dashboard:upcomingLeaves.employee');
              const typeLabel = parseLeaveType(item.reason, t as any);

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={employeeName}
                      size="sm"
                      className="h-8 w-8 shrink-0 text-xs rounded-full bg-accent-soft text-accent font-medium"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-[20px] font-medium text-text-primary truncate" title={employeeName}>
                        {employeeName}
                      </p>
                      <p className="text-[12px] leading-[16px] text-text-tertiary mt-0.5">
                        {typeLabel} · {t('dashboard:upcomingLeaves.daysCount', { count: daysCount })}
                      </p>
                    </div>
                  </div>

                  {/* Badge ngày nghỉ: vuông 2px radius (radius-xs), KHÔNG pill (§9) */}
                  <div className="shrink-0 text-right">
                    {isToday ? (
                      <span className="inline-flex items-center justify-center h-5 px-2 rounded-[2px] text-[11px] font-semibold bg-[#FBEEE0] text-[#B45309]">
                        {t('dashboard:upcomingLeaves.today')}
                      </span>
                    ) : isTomorrow ? (
                      <span className="inline-flex items-center justify-center h-5 px-2 rounded-[2px] text-[11px] font-medium bg-bg-subtle text-text-secondary">
                        {t('dashboard:upcomingLeaves.tomorrow')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center h-5 px-2 rounded-[2px] text-[11px] font-medium bg-bg-subtle text-text-tertiary">
                        {formatShortDate(item.startDate)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


