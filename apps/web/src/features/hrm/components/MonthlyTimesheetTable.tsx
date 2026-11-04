import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { FormField, Textarea } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { DownloadIcon, SearchIcon } from '@/components/ui/Icons';
import { PERMISSIONS } from '@/constants/permissions';
import { formatDate } from '@/lib/utils';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import type { Department, TimesheetPending, TimesheetRow, User } from '@/types';
import { extractPendingConflict } from '../api';
import { useLockTimesheetPeriod, useTimesheetQuery, useUnlockTimesheetPeriod } from '../hooks';
import { TimesheetDetailModal } from './TimesheetDetailModal';
import { WorkScheduleModal } from './WorkScheduleModal';
import { SymbolLegend, displayUserName } from './timesheet-shared';

// 04/11/2026: bang cong khong con tu tinh o trinh duyet (truoc day dem thu 2-6, gio 08:30, 8 gio/ngay cung).
// Du lieu lay tu may chu qua useTimesheetQuery(month) (hrm-service, computeMonth) - component chi ghep
// ten/phong ban tu `users`, `departments`, loc, xuat CSV va dieu khien khoa/mo khoa ky.
interface MonthlyTimesheetTableProps {
  users: User[];
  departments: Department[];
  selectedMonth: string; // 'YYYY-MM' or 'all' ('all' dung thang hien tai, bang cong luon theo thang)
  today: string; // 'YYYY-MM-DD' GMT+7
}

interface UserSummary extends TimesheetRow {
  name: string;
  departmentName: string;
}

// Làm sạch giá trị để chống tấn công CSV Injection (Formula Injection)
function sanitizeCsvValue(val: string | number): string {
  const str = String(val ?? '');
  // Nếu bắt đầu bằng ký tự công thức nguy hiểm (=, +, -, @, tab, CR), thêm dấu nháy đơn bảo vệ
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function StatusBadge({ status }: { status: UserSummary['status'] }) {
  const { t } = useTranslation();
  const style =
    status === 'notJoined'
      ? 'bg-bg-muted text-text-tertiary'
      : status === 'sufficient'
        ? 'bg-success-soft text-success'
        : 'bg-warning-soft text-warning';
  return (
    <span className={`inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold ${style}`}>
      {t(`hrm:attendancePage.allAttendance.timesheet.status.${status}`)}
    </span>
  );
}

const TimesheetDesktopRow = React.memo(function TimesheetDesktopRow({
  summary: s,
  onSelect,
}: {
  summary: UserSummary;
  onSelect: (s: UserSummary) => void;
}) {
  const { t } = useTranslation();

  return (
    <tr
      className="hover:bg-bg-subtle transition-colors h-14 cursor-pointer"
      tabIndex={0}
      onClick={() => onSelect(s)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(s);
      }}
    >
      <td className="py-2 px-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Avatar name={s.name} size="sm" className="h-6 w-6 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] font-semibold" />
          <span className="font-medium text-text-primary truncate max-w-[150px]">{s.name}</span>
          {s.hasManual && (
            <span className="text-[10px] text-text-tertiary" title={t('hrm:timesheet.manualRowHint')}>
              ✎
            </span>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-text-secondary whitespace-nowrap">{s.departmentName}</td>
      <td className="py-2 px-3 text-right font-mono text-[13px] font-medium whitespace-nowrap tabular-nums">
        <span className="text-text-primary">{s.paidDays}</span>
        <span className="text-text-tertiary font-normal"> / {s.expectedDays}</span>
        {s.paidLeaveDays > 0 && (
          <span className="block text-[10px] text-accent font-sans font-normal">
            ({t('hrm:attendancePage.allAttendance.timesheet.columns.actualDays')}: {s.actualDays} + {s.paidLeaveDays} {t('hrm:attendancePage.allAttendance.timesheet.daysUnit')})
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-right font-mono text-[13px] font-medium whitespace-nowrap tabular-nums">
        <span className="text-text-primary">{s.totalActualHours}h</span>
        <span className="text-text-tertiary font-normal"> / {s.totalExpectedHours}h</span>
      </td>
      <td className="py-2 px-3 text-center whitespace-nowrap">
        {s.lateCount > 0 ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[2px] bg-warning-soft text-warning font-mono font-medium text-[12px]">
            {s.lateCount}
          </span>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>
      <td className="py-2 px-3 text-center whitespace-nowrap">
        {s.missingCheckOutCount > 0 ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[2px] bg-warning-soft text-warning font-mono font-medium text-[12px]">
            {s.missingCheckOutCount}
          </span>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>
      <td className="py-2 px-3 text-right font-mono text-[13px] font-medium text-text-primary whitespace-nowrap tabular-nums">
        {s.otHours > 0 ? `${s.otHours}h` : '—'}
      </td>
      <td className="py-2 px-3 text-center whitespace-nowrap">
        <StatusBadge status={s.status} />
      </td>
    </tr>
  );
});

const TimesheetMobileCard = React.memo(function TimesheetMobileCard({
  summary: s,
  onSelect,
}: {
  summary: UserSummary;
  onSelect: (s: UserSummary) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(s)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(s);
      }}
      className="p-3 rounded-radius-sm border border-border-subtle bg-white shadow-none space-y-2 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={s.name} size="sm" className="h-7 w-7 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] font-semibold" />
          <div className="min-w-0">
            <p className="font-semibold text-[13px] text-text-primary truncate">{s.name}</p>
            <p className="text-[11px] text-text-tertiary truncate">{s.departmentName}</p>
          </div>
        </div>
        <StatusBadge status={s.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-subtle text-[11px]">
        <div>
          <span className="text-text-tertiary block text-[10px]">
            {t('hrm:attendancePage.allAttendance.timesheet.columns.actualDays')}:
          </span>
          <span className="font-mono font-medium text-text-primary tabular-nums">
            {s.paidDays} / {s.expectedDays} {t('hrm:attendancePage.allAttendance.timesheet.daysUnit')}
          </span>
          {s.paidLeaveDays > 0 && (
            <span className="block text-[10px] text-accent font-sans">
              {t('hrm:attendancePage.allAttendance.workedPlusLeave', { actual: s.actualDays, paid: s.paidLeaveDays })}
            </span>
          )}
        </div>
        <div>
          <span className="text-text-tertiary block text-[10px]">
            {t('hrm:attendancePage.allAttendance.timesheet.columns.workHours')}:
          </span>
          <span className="font-mono font-medium text-text-primary tabular-nums">
            {s.totalActualHours}h / {s.totalExpectedHours}h
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">
            {t('hrm:attendancePage.allAttendance.timesheet.columns.lateCount')}:
          </span>
          <span className={`font-semibold ${s.lateCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
            {s.lateCount} {t('hrm:attendancePage.allAttendance.timesheet.timesUnit')}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">
            {t('hrm:attendancePage.allAttendance.timesheet.columns.otHours')}:
          </span>
          <span className="font-mono font-semibold text-slate-700">
            {s.otHours > 0 ? `${s.otHours}h` : '0h'}
          </span>
        </div>
      </div>
    </div>
  );
});

export function MonthlyTimesheetTable({ users, departments, selectedMonth, today }: MonthlyTimesheetTableProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [detailTarget, setDetailTarget] = useState<UserSummary | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // Khoa ky: 'confirm' = hoi xac nhan khoa thuong; forcePending != null = con don dang cho, hoi xac nhan force.
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [forcePending, setForcePending] = useState<TimesheetPending | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const permissions = usePermissions();
  const canManagePeriod = permissions.includes(PERMISSIONS.ORG_MANAGE);
  const canAdjust = permissions.includes(PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE);

  // 04/11/2026: bang cong luon theo 1 thang cu the; 'all' (tat ca thoi gian) dung thang hien tai.
  const month = selectedMonth && selectedMonth !== 'all' ? selectedMonth : today.slice(0, 7);
  const timesheetQuery = useTimesheetQuery(month);
  const lockPeriod = useLockTimesheetPeriod();
  const unlockPeriod = useUnlockTimesheetPeriod();
  const period = timesheetQuery.data?.period;
  const isLocked = period?.status === 'LOCKED';

  const deptMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) {
      map.set(d.id, d.name);
    }
    return map;
  }, [departments]);

  // Ghép tên + phòng ban từ users/departments vào dòng do máy chủ tính; thiếu tên không làm vỡ bảng.
  const summaries = useMemo<UserSummary[]>(() => {
    const userMap = new Map(users.map((u) => [u.id, u]));
    const noDept = t('hrm:attendancePage.allAttendance.timesheet.noDepartment');
    // 04/11/2026: may chu khong dam bao thu tu dong (dim_user doi thu tu sau moi dot phat lai cua IAM), sap theo
    // ten de bang va tep xuat khong doi cho giua cac lan xem.
    return (timesheetQuery.data?.rows ?? [])
      .map((row) => {
        const user = userMap.get(row.userId);
        const deptId = row.departmentId ?? user?.departmentId ?? null;
        return {
          ...row,
          departmentId: deptId,
          name: displayUserName(user, t('hrm:timesheet.unknownEmployee')),
          departmentName: (deptId && deptMap.get(deptId)) || noDept,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.userId.localeCompare(b.userId));
  }, [timesheetQuery.data, users, deptMap, t]);

  // Bộ lọc theo phòng ban & tìm kiếm theo tên
  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) => {
      const matchSearch = !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchDept = selectedDeptId === 'all' || s.departmentId === selectedDeptId;
      return matchSearch && matchDept;
    });
  }, [summaries, search, selectedDeptId]);

  // Tùy chọn cho filter phòng ban
  const deptFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: t('hrm:attendancePage.allAttendance.timesheet.allDepartments') },
      ...departments.map((d) => ({ value: d.id, label: d.name })),
    ];
  }, [departments, t]);

  // Hàm xuất CSV an toàn
  const handleExportCsv = () => {
    const headers = [
      t('hrm:attendancePage.allAttendance.timesheet.columns.employee'),
      t('hrm:attendancePage.allAttendance.timesheet.columns.department'),
      t('hrm:attendancePage.allAttendance.timesheet.columns.actualDays'),
      t('hrm:attendancePage.allAttendance.timesheet.columns.paidLeaveDays'),
      `${t('hrm:attendancePage.allAttendance.timesheet.columns.workHours')} (${t('hrm:attendancePage.allAttendance.timesheet.hoursUnit')})`,
      t('hrm:attendancePage.allAttendance.timesheet.columns.lateCount'),
      t('hrm:attendancePage.allAttendance.timesheet.columns.missingCheckOut'),
      `${t('hrm:attendancePage.allAttendance.timesheet.columns.otHours')} (${t('hrm:attendancePage.allAttendance.timesheet.hoursUnit')})`,
      t('hrm:attendancePage.allAttendance.timesheet.columns.status'),
    ];

    const rows = filteredSummaries.map((s) => [
      sanitizeCsvValue(s.name),
      sanitizeCsvValue(s.departmentName),
      sanitizeCsvValue(`${s.paidDays}/${s.expectedDays}`),
      sanitizeCsvValue(s.paidLeaveDays),
      sanitizeCsvValue(`${s.totalActualHours}/${s.totalExpectedHours}`),
      sanitizeCsvValue(s.lateCount),
      sanitizeCsvValue(s.missingCheckOutCount),
      sanitizeCsvValue(s.otHours),
      sanitizeCsvValue(t(`hrm:attendancePage.allAttendance.timesheet.status.${s.status}`)),
    ]);

    const csvContent = '﻿' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `timesheet-${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentUser = useAuthStore((s) => s.user);

  // 04/11/2026: so lieu lay tu may chu (hrm-service computeMonth); header van mo phong khuon mau import
  // MISA/Fast (chua doi chieu voi tai lieu import chinh thuc cua 2 phan mem nay, ghi nhan la gioi han da biet).
  // Moi o van di qua sanitizeCsvValue() de chong CSV injection.
  const handleExportPayroll = () => {
    // Header chuẩn MISA / Fast HRM import template
    const headers = [
      'Mã nhân viên', // i18n-lint-ignore: MISA/Fast payroll header
      'Họ và tên', // i18n-lint-ignore: MISA/Fast payroll header
      'Phòng ban', // i18n-lint-ignore: MISA/Fast payroll header
      'Công chuẩn', // i18n-lint-ignore: MISA/Fast payroll header
      'Công hưởng lương', // i18n-lint-ignore: MISA/Fast payroll header
      'Ngày làm thực tế', // i18n-lint-ignore: MISA/Fast payroll header
      'Nghỉ phép hưởng lương', // i18n-lint-ignore: MISA/Fast payroll header
      'Giờ làm việc thực tế', // i18n-lint-ignore: MISA/Fast payroll header
      'Giờ làm thêm (OT)', // i18n-lint-ignore: MISA/Fast payroll header
      'Số lần đi muộn', // i18n-lint-ignore: MISA/Fast payroll header
      'Quên check-out', // i18n-lint-ignore: MISA/Fast payroll header
      'Trạng thái', // i18n-lint-ignore: MISA/Fast payroll header
    ];

    const rows = filteredSummaries.map((s) => [
      sanitizeCsvValue(s.userId.slice(0, 8).toUpperCase()),
      sanitizeCsvValue(s.name),
      sanitizeCsvValue(s.departmentName),
      sanitizeCsvValue(s.expectedDays),
      sanitizeCsvValue(s.paidDays),
      sanitizeCsvValue(s.actualDays),
      sanitizeCsvValue(s.paidLeaveDays),
      sanitizeCsvValue(s.totalActualHours),
      sanitizeCsvValue(s.otHours),
      sanitizeCsvValue(s.lateCount),
      sanitizeCsvValue(s.missingCheckOutCount),
      sanitizeCsvValue(t(`hrm:attendancePage.allAttendance.timesheet.status.${s.status}`)),
    ]);

    // Metadata xuất file ở cuối
    const nowTimeStr = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date());
    const exporterName = currentUser?.fullName || currentUser?.email || 'Admin';
    const metadataRow = [
      sanitizeCsvValue(t('hrm:extensions.payroll.exportedBy', { user: exporterName, time: nowTimeStr })),
    ];

    const csvContent =
      '﻿' +
      [
        headers.join(','),
        ...rows.map((e) => e.join(',')),
        '',
        metadataRow.join(','),
      ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `payroll-misa-fast-${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t('hrm:extensions.payroll.successExport'));
  };

  // 04/11/2026: khoa ky. Con don dang cho -> may chu tra 409 TIMESHEET_PERIOD_HAS_PENDING kem so don; hoi xac
  // nhan roi gui lai voi force: true. Loi khac da duoc toast boi useLockTimesheetPeriod().
  function submitLock(force: boolean) {
    lockPeriod.mutate(
      { month, force },
      {
        onSuccess: () => {
          setLockConfirmOpen(false);
          setForcePending(null);
        },
        onError: (error) => {
          const pending = extractPendingConflict(error);
          setLockConfirmOpen(false);
          if (pending) setForcePending(pending);
          else setForcePending(null);
        },
      },
    );
  }

  function submitUnlock() {
    if (!unlockReason.trim()) {
      setUnlockError(t('hrm:timesheet.period.reasonRequired'));
      return;
    }
    unlockPeriod.mutate(
      { month, reason: unlockReason.trim() },
      {
        onSuccess: () => {
          setUnlockOpen(false);
          setUnlockReason('');
          setUnlockError('');
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* Trạng thái kỳ công + nút Khoá/Mở khoá/Lịch làm việc (chỉ ORG_MANAGE) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-secondary">
          <span className="font-medium text-text-primary">{t('hrm:attendancePage.allAttendance.timesheet.title', { month })}</span>
          {period && (
            <span
              className={`inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold ${
                isLocked ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'
              }`}
            >
              {t(`hrm:timesheet.period.status.${period.status}`)}
            </span>
          )}
          {isLocked && period?.lockedAt && (
            <span className="text-text-tertiary">{t('hrm:timesheet.period.lockedAt', { date: formatDate(period.lockedAt) })}</span>
          )}
        </div>
        {canManagePeriod && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setScheduleOpen(true)} className="h-9 text-xs">
              {t('hrm:workSchedule.openButton')}
            </Button>
            {period && !isLocked && (
              <Button type="button" variant="outline" size="sm" onClick={() => setLockConfirmOpen(true)} className="h-9 text-xs">
                {t('hrm:timesheet.period.lockButton')}
              </Button>
            )}
            {period && isLocked && (
              <Button type="button" variant="outline" size="sm" onClick={() => setUnlockOpen(true)} className="h-9 text-xs">
                {t('hrm:timesheet.period.unlockButton')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Thanh công cụ: Tìm kiếm, lọc phòng ban và nút Xuất CSV / Payroll */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('hrm:attendancePage.allAttendance.timesheet.searchPlaceholder')}
              className="w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-3 text-[13px] leading-5 text-text-primary placeholder:text-text-tertiary focus:border-accent focus:bg-white focus:outline-none focus:ring-1 focus:ring-accent transition-all h-9"
            />
          </div>

          <CustomFilterSelect
            value={selectedDeptId}
            options={deptFilterOptions}
            onChange={setSelectedDeptId}
            ariaLabel={t('hrm:attendancePage.allAttendance.timesheet.allDepartments')}
            className="flex-1 sm:w-[180px]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!timesheetQuery.data}
            className="flex items-center gap-1.5 rounded-radius-sm border-border-strong bg-white text-text-primary hover:bg-canvas text-xs font-semibold h-9"
          >
            <DownloadIcon className="h-3.5 w-3.5 text-text-tertiary" />
            <span>{t('hrm:attendancePage.allAttendance.exportCsv')}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPayroll}
            disabled={!timesheetQuery.data}
            className="flex items-center gap-1.5 rounded-radius-sm border-border-strong bg-white text-text-primary hover:bg-canvas text-xs font-semibold h-9"
          >
            <DownloadIcon className="h-3.5 w-3.5 text-text-tertiary" />
            <span>{t('hrm:extensions.payroll.exportButton')}</span>
          </Button>
        </div>
      </div>

      <QueryState
        isLoading={timesheetQuery.isLoading}
        isError={timesheetQuery.isError}
        onRetry={() => timesheetQuery.refetch()}
        errorTitle={t('hrm:timesheet.loadError')}
      >
        {/* Hiển thị bảng số liệu trên màn hình Desktop */}
        <div className="hidden sm:block overflow-x-auto max-h-[460px] overflow-y-auto rounded-radius-sm border border-border-subtle">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-bg-subtle z-10 border-b border-border-subtle">
              <tr className="text-left text-[12px] font-medium text-text-tertiary">
                <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.timesheet.columns.employee')}</th>
                <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.timesheet.columns.department')}</th>
                <th className="py-2.5 px-3 bg-bg-subtle text-right">{t('hrm:attendancePage.allAttendance.timesheet.columns.actualDays')}</th>
                <th className="py-2.5 px-3 bg-bg-subtle text-right">{t('hrm:attendancePage.allAttendance.timesheet.columns.workHours')}</th>
                <th className="py-2.5 px-3 bg-bg-subtle text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.lateCount')}</th>
                <th className="py-2.5 px-3 bg-bg-subtle text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.missingCheckOut')}</th>
                <th className="py-2.5 px-3 bg-bg-subtle text-right">{t('hrm:attendancePage.allAttendance.timesheet.columns.otHours')}</th>
                <th className="py-2.5 px-3 bg-bg-subtle text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-white">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-tertiary">
                    {t('hrm:attendancePage.allAttendance.timesheet.empty')}
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((s) => <TimesheetDesktopRow key={s.userId} summary={s} onSelect={setDetailTarget} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Hiển thị dạng Card danh sách trên giao diện Di động (Mobile) */}
        <div className="block sm:hidden space-y-2.5 max-h-[460px] overflow-y-auto pr-0.5">
          {filteredSummaries.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-tertiary">
              {t('hrm:attendancePage.allAttendance.timesheet.empty')}
            </div>
          ) : (
            filteredSummaries.map((s) => <TimesheetMobileCard key={s.userId} summary={s} onSelect={setDetailTarget} />)
          )}
        </div>

        <SymbolLegend />
      </QueryState>

      {/* Chi tiết ngày của 1 nhân viên (mở khi bấm dòng) */}
      {detailTarget && (
        <TimesheetDetailModal
          open
          onClose={() => setDetailTarget(null)}
          userId={detailTarget.userId}
          userName={detailTarget.name}
          month={month}
          today={today}
          canAdjust={canAdjust}
        />
      )}

      {canManagePeriod && <WorkScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} />}

      {/* Xác nhận khoá kỳ */}
      <ConfirmDialog
        open={lockConfirmOpen}
        onClose={() => setLockConfirmOpen(false)}
        onConfirm={() => submitLock(false)}
        isLoading={lockPeriod.isPending}
        title={t('hrm:timesheet.period.lockConfirmTitle', { month })}
        description={t('hrm:timesheet.period.lockConfirmDescription')}
        confirmLabel={t('hrm:timesheet.period.lockButton')}
      />

      {/* Còn đơn đang chờ: hiện số đơn và cho xác nhận khoá với force: true */}
      <ConfirmDialog
        open={forcePending !== null}
        onClose={() => setForcePending(null)}
        onConfirm={() => submitLock(true)}
        isLoading={lockPeriod.isPending}
        title={t('hrm:timesheet.period.pendingTitle')}
        description={t('hrm:timesheet.period.pendingDescription', {
          leave: forcePending?.leave ?? 0,
          overtime: forcePending?.overtime ?? 0,
          adjustment: forcePending?.adjustment ?? 0,
        })}
        confirmLabel={t('hrm:timesheet.period.forceLockButton')}
        danger
      />

      {/* Mở khoá bắt buộc nhập lý do */}
      <Modal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        preventCloseWhilePending={unlockPeriod.isPending}
        title={t('hrm:timesheet.period.unlockTitle', { month })}
        size="sm"
      >
        <div className="space-y-3">
          <FormField label={t('hrm:timesheet.period.reasonLabel')} htmlFor="unlock-reason" error={unlockError} required>
            <Textarea
              id="unlock-reason"
              value={unlockReason}
              onChange={(e) => {
                setUnlockReason(e.target.value);
                if (unlockError) setUnlockError('');
              }}
              className="min-h-[80px]"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setUnlockOpen(false)} disabled={unlockPeriod.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="button" size="sm" onClick={submitUnlock} disabled={unlockPeriod.isPending}>
              {t('hrm:timesheet.period.unlockButton')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
