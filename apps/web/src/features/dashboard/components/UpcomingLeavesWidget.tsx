import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { CalendarIcon, ChevronRightIcon } from '@/components/ui/Icons';
import { formatShortDate, calculateWorkingDays } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useUpcomingLeavesQuery } from '../hooks';
import type { LeaveRequest } from '@/types';

/** Tách loại nghỉ phép và lý do thực tế từ chuỗi reason đã lưu */
function parseLeaveType(rawReason: string | undefined | null, t: (key: string) => string): { label: string; badgeStyle: string } {
  if (!rawReason) {
    return {
      label: t('dashboard:upcomingLeaves.types.ANNUAL'),
      badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    };
  }

  const match = rawReason.match(/^\[(.*?)\]\s*(.*)$/);
  const rawType = match ? match[1] : '';

  if (rawType === 'SICK' || rawType.includes('ốm') || rawType.includes('Sick') || rawType.includes('病気')) {
    return {
      label: t('dashboard:upcomingLeaves.types.SICK'),
      badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200/60',
    };
  }

  if (rawType === 'UNPAID' || rawType.includes('việc riêng') || rawType.includes('Personal') || rawType.includes('私用')) {
    return {
      label: t('dashboard:upcomingLeaves.types.UNPAID'),
      badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200/60',
    };
  }

  return {
    label: t('dashboard:upcomingLeaves.types.ANNUAL'),
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  };
}

export function UpcomingLeavesWidget() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useUpcomingLeavesQuery();
  const { map: userNameMap } = useUserNameMap();

  // Ngày hiện tại GMT+7 định dạng YYYY-MM-DD
  const todayStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
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
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <CardTitle>{t('dashboard:upcomingLeaves.title')}</CardTitle>
        </div>
        <Link
          to="/leave-requests"
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 hover:underline no-print"
        >
          <span>{t('dashboard:upcomingLeaves.viewAll')}</span>
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>

      <CardContent className="flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
            <Spinner className="h-5 w-5 text-indigo-600" />
            <p className="text-xs text-slate-500">{t('dashboard:upcomingLeaves.loading')}</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-rose-500 font-medium">{t('dashboard:upcomingLeaves.errorTitle')}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
            >
              {t('dashboard:upcomingLeaves.retry')}
            </button>
          </div>
        ) : upcomingList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <p className="text-xs font-semibold text-slate-700">{t('dashboard:upcomingLeaves.emptyTitle')}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px]">
              {t('dashboard:upcomingLeaves.emptyDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingList.map((item) => {
              const startStr = item.startDate ? item.startDate.slice(0, 10) : '';
              const endStr = item.endDate ? item.endDate.slice(0, 10) : '';
              const isToday = startStr <= todayStr && endStr >= todayStr;
              const isSameDay = startStr === endStr;
              const daysCount = calculateWorkingDays(item.startDate, item.endDate);
              const employeeName = userNameMap[item.userId] || t('dashboard:upcomingLeaves.employee');
              const { label: typeLabel, badgeStyle } = parseLeaveType(item.reason, t);

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={employeeName} size="sm" className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate" title={employeeName}>
                        {employeeName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${badgeStyle}`}>
                          {typeLabel}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          • {t('dashboard:upcomingLeaves.daysCount', { count: daysCount })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isToday ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                        {t('dashboard:upcomingLeaves.today')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-white text-slate-700 border border-slate-200 shadow-2xs">
                        {isSameDay
                          ? formatShortDate(item.startDate)
                          : `${formatShortDate(item.startDate)} - ${formatShortDate(item.endDate)}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

