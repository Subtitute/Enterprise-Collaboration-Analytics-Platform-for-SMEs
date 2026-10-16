import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { UserIcon, PlusIcon, CameraIcon, EditIcon } from '@/components/ui/Icons';
import { formatDate, formatTime, formatDateTime } from '@/lib/utils';
import type { Attendance, LeaveRequest } from '@/types';
import {
  OnSiteBadge,
  formatTotalHours,
  AttendanceStatusBadge,
  LeaveAttendanceBadge,
  type ViewingPhotoTarget,
} from './attendance-shared';
import { parseLeaveReason } from './leave-shared';

interface PersonalAttendanceRowProps {
  record: Attendance;
  today: string;
  isAdjusted: boolean;
  isPendingAdjustment: boolean;
  onViewPhoto: (target: ViewingPhotoTarget) => void;
  onRequestAdjustment: (record: Attendance) => void;
}

const PersonalAttendanceRow = React.memo(function PersonalAttendanceRow({
  record,
  today,
  isAdjusted,
  isPendingAdjustment,
  onViewPhoto,
  onRequestAdjustment,
}: PersonalAttendanceRowProps) {
  const { t } = useTranslation();

  return (
    <tr className="hover:bg-bg-subtle transition-colors">
      <td className="py-2.5 px-3 text-text-primary font-mono text-[13px] whitespace-nowrap">
        {formatDate(record.workDate)}
      </td>
      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
            {formatTime(record.checkInAt)}
          </span>
          <OnSiteBadge isOnSite={record.checkInIsOnSite} />
          <button
            type="button"
            onClick={() =>
              onViewPhoto({
                id: record.id,
                kind: 'checkin',
                time: formatDateTime(record.checkInAt),
                isOnSite: record.checkInIsOnSite,
              })
            }
            className="inline-flex items-center justify-center h-6 w-6 rounded-radius-sm bg-bg-subtle text-text-tertiary hover:bg-canvas hover:text-text-primary transition-colors cursor-pointer"
            title={t('hrm:attendancePage.history.viewProofIn')}
            aria-label={t('hrm:attendancePage.history.viewProofIn')}
          >
            <CameraIcon className="h-3 w-3" />
          </button>
        </div>
      </td>
      <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
        {record.checkOutAt ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
              {formatTime(record.checkOutAt)}
            </span>
            <OnSiteBadge isOnSite={record.checkOutIsOnSite} />
            <button
              type="button"
              onClick={() =>
                onViewPhoto({
                  id: record.id,
                  kind: 'checkout',
                  time: formatDateTime(record.checkOutAt),
                  isOnSite: record.checkOutIsOnSite,
                })
              }
              className="inline-flex items-center justify-center h-6 w-6 rounded-radius-sm bg-bg-subtle text-text-tertiary hover:bg-canvas hover:text-text-primary transition-colors cursor-pointer"
              title={t('hrm:attendancePage.history.viewProofOut')}
              aria-label={t('hrm:attendancePage.history.viewProofOut')}
            >
              <CameraIcon className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <span className="text-text-tertiary italic font-normal">
            {t('hrm:attendancePage.today.notRecorded')}
          </span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-[13px] font-medium whitespace-nowrap tabular-nums">
        <span className={record.checkOutAt ? 'text-text-primary' : 'text-text-tertiary font-normal'}>
          {formatTotalHours(t, record.checkInAt, record.checkOutAt)}
        </span>
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap">
        <AttendanceStatusBadge
          record={record}
          today={today}
          isAdjusted={isAdjusted}
          isPendingAdjustment={isPendingAdjustment}
        />
      </td>
      <td className="py-2.5 px-3 whitespace-nowrap text-right">
        {isPendingAdjustment ? (
          <span
            className="inline-flex items-center gap-1 text-[13px] font-medium text-text-tertiary cursor-not-allowed select-none"
            title={t('hrm:extensions.adjustment.pendingDuplicateTooltip', 'Đã có đơn đang chờ duyệt')}
          >
            <EditIcon className="h-3 w-3 opacity-60" />
            <span>{t('hrm:extensions.adjustment.requestButton')}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onRequestAdjustment(record)}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline cursor-pointer"
            title={t('hrm:extensions.adjustment.requestButton')}
          >
            <EditIcon className="h-3 w-3" />
            <span>{t('hrm:extensions.adjustment.requestButton')}</span>
          </button>
        )}
      </td>
    </tr>
  );
});

export interface PersonalAttendanceTableProps {
  records: Attendance[];
  approvedLeaveRequests?: LeaveRequest[];
  selectedMonth: string;
  monthOptions: { value: string; label: string }[];
  onMonthChange: (val: string) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  today: string;
  approvedAdjustmentAttendanceIds: Set<string>;
  pendingAdjustmentAttendanceIds?: Set<string>;
  onOpenOtModal: () => void;
  onViewPhoto: (target: ViewingPhotoTarget) => void;
  onRequestAdjustment: (record: Attendance) => void;
}

type AttendanceRowItem =
  | { type: 'attendance'; date: string; record: Attendance }
  | { type: 'leave'; date: string; leaveRequest: LeaveRequest; rawType: string | null; leaveType: string | null };

export function PersonalAttendanceTable({
  records,
  approvedLeaveRequests = [],
  selectedMonth,
  monthOptions,
  onMonthChange,
  isLoading,
  isError,
  onRetry,
  today,
  approvedAdjustmentAttendanceIds,
  pendingAdjustmentAttendanceIds,
  onOpenOtModal,
  onViewPhoto,
  onRequestAdjustment,
}: PersonalAttendanceTableProps) {
  const { t } = useTranslation();

  // 16/10/2026: Tong hop danh sach cac dong tren bang cham cong ca nhan bao gom ca ban ghi cham cong that
  // va cac ngay nghi phep da duyet (APPROVED) chua co check-in, nham khong bi hien thi thieu sot hoac loi
  const combinedRows = React.useMemo(() => {
    const rows: AttendanceRowItem[] = [];
    const attendanceDates = new Set<string>();

    for (const r of records) {
      attendanceDates.add(r.workDate);
      rows.push({ type: 'attendance', date: r.workDate, record: r });
    }

    // Duyet cac don nghi phep da duyet
    for (const lr of approvedLeaveRequests) {
      if (lr.status !== 'APPROVED') continue;
      const s = new Date(lr.startDate);
      const e = new Date(lr.endDate);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;

      const { rawType, leaveType } = parseLeaveReason(lr.reason, t);

      const cur = new Date(s);
      while (cur <= e) {
        // Chi tinh Thu 2 - Thu 6 (1..5)
        const day = cur.getDay();
        if (day >= 1 && day <= 5) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;

          // Loc theo selectedMonth neu co
          if (selectedMonth === 'all' || dateStr.startsWith(selectedMonth)) {
            // Neu ngay nay chua co ban ghi cham cong
            if (!attendanceDates.has(dateStr)) {
              rows.push({
                type: 'leave',
                date: dateStr,
                leaveRequest: lr,
                rawType,
                leaveType,
              });
              attendanceDates.add(dateStr); // tranh trung lap neu 2 don chong lan
            }
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Sap xep ngay giam dan (moi nhat len dau)
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  }, [records, approvedLeaveRequests, selectedMonth, t]);

  return (
    <Card className="border border-border-subtle bg-surface shadow-none flex flex-col h-full overflow-hidden rounded-radius-md">
      <CardHeader className="pb-3 border-b border-border-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Tiêu đề Lịch sử cá nhân */}
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-text-tertiary" />
            <CardTitle className="text-[15px] font-semibold text-text-primary">
              {t('hrm:attendancePage.history.cardTitle')}
            </CardTitle>
          </div>

          {/* Toolbar bên phải: Nút Đăng ký OT Secondary + Lọc tháng */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenOtModal}
              className="border-border-strong text-text-secondary hover:bg-canvas hover:text-text-primary rounded-radius-sm h-9 px-3 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <PlusIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{t('hrm:extensions.overtime.registerButton')}</span>
            </Button>

            <CustomFilterSelect
              value={selectedMonth}
              options={monthOptions}
              onChange={onMonthChange}
              ariaLabel={t('hrm:attendancePage.monthFilter.ariaLabel')}
              className="w-[160px]"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-1 flex flex-col min-h-0">
        <QueryState
          isLoading={isLoading}
          isError={isError}
          onRetry={onRetry}
          loadingFallback={<FullPageSpinner label={t('hrm:attendancePage.history.loading')} />}
          errorTitle={t('hrm:attendancePage.history.errorTitle')}
          errorDescription={t('hrm:attendancePage.history.errorDescription')}
        >
          {combinedRows.length === 0 ? (
            <EmptyState
              title={t('hrm:attendancePage.history.emptyTitle')}
              description={
                selectedMonth !== 'all'
                  ? t('hrm:attendancePage.history.emptyFilteredDescription', {
                      month: monthOptions.find((m) => m.value === selectedMonth)?.label,
                    })
                  : t('hrm:attendancePage.history.emptyDescription')
              }
            />
          ) : (
            <div className="overflow-x-auto flex-1 overflow-y-auto max-h-[300px]">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-bg-subtle z-10 border-b border-border-subtle">
                  <tr className="text-left text-[12px] font-medium text-text-tertiary">
                    <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.history.columns.date')}</th>
                    <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.history.columns.checkIn')}</th>
                    <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.history.columns.checkOut')}</th>
                    <th className="py-2.5 px-3 bg-bg-subtle text-right">{t('hrm:attendancePage.history.columns.totalHours')}</th>
                    <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.history.columns.status')}</th>
                    <th className="py-2.5 px-3 bg-bg-subtle text-right">{t('hrm:attendancePage.history.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {combinedRows.map((item) => {
                    if (item.type === 'attendance') {
                      const record = item.record;
                      return (
                        <PersonalAttendanceRow
                          key={record.id}
                          record={record}
                          today={today}
                          isAdjusted={approvedAdjustmentAttendanceIds.has(record.id)}
                          isPendingAdjustment={Boolean(pendingAdjustmentAttendanceIds?.has(record.id))}
                          onViewPhoto={onViewPhoto}
                          onRequestAdjustment={onRequestAdjustment}
                        />
                      );
                    }

                    // Hàng nghỉ phép đã duyệt nhưng không check-in
                    return (
                      <tr key={`leave-${item.leaveRequest.id}-${item.date}`} className="hover:bg-bg-subtle transition-colors">
                        <td className="py-2.5 px-3 text-text-primary font-mono text-[13px] whitespace-nowrap">
                          {formatDate(item.date)}
                        </td>
                        <td className="py-2.5 px-3 text-text-tertiary font-mono text-[13px] whitespace-nowrap">
                          —
                        </td>
                        <td className="py-2.5 px-3 text-text-tertiary font-mono text-[13px] whitespace-nowrap">
                          —
                        </td>
                        <td className="py-2.5 px-3 text-text-tertiary font-mono text-[13px] whitespace-nowrap text-right">
                          —
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <LeaveAttendanceBadge rawType={item.rawType} label={item.leaveType} />
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-right text-text-tertiary font-mono text-[13px]">
                          —
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
