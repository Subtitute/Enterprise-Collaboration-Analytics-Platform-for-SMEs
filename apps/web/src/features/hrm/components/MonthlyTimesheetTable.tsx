import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { DownloadIcon, SearchIcon, ClockIcon, FileTextIcon } from '@/components/ui/Icons';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import type { Attendance, CalendarEvent, Department, LeaveRequest, OvertimeRequest, User } from '@/types';

interface MonthlyTimesheetTableProps {
  records: Attendance[];
  users: User[];
  departments: Department[];
  selectedMonth: string; // 'YYYY-MM' or 'all'
  today: string; // 'YYYY-MM-DD' GMT+7
  /** 22/09/2026: OT DA DUYET (status=APPROVED) toan to chuc, khong loc thang - component tu loc
   *  theo khoang ngay cua thang dang xet (xem summaries useMemo ben duoi). Thay the heuristic doan
   *  "checkout sau 17:30" truoc day bang du lieu that (OvertimeRequestsService). */
  approvedOvertime: OvertimeRequest[];
  /** 16/10/2026: Lien thong nghi phep da duyet (status=APPROVED) de tinh cong huong luong (paidLeaveDays) */
  approvedLeaveRequests?: LeaveRequest[];
  /** 16/10/2026: Lien thong lich cong ty ngay le (type=HOLIDAY) de tinh ngay le huong luong (paidHolidayDays) */
  calendarEvents?: CalendarEvent[];
}

interface UserSummary {
  userId: string;
  name: string;
  departmentName: string;
  departmentId: string | null;
  actualDays: number;
  paidLeaveDays: number;
  paidHolidayDays: number;
  paidDays: number;
  expectedDays: number;
  totalActualHours: number;
  totalExpectedHours: number;
  lateCount: number;
  missingCheckOutCount: number;
  otHours: number;
  status: 'sufficient' | 'insufficient' | 'newMember' | 'notJoined';
  isNewMember: boolean;
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

// Đọc giờ và phút theo GMT+7 chuẩn xác
function getGmt7TimeParts(isoString: string): { hour: number; minute: number } {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { hour, minute };
}

// Tính số ngày làm việc (Thứ 2 - Thứ 6) trong một khoảng ngày YYYY-MM-DD
function countWorkingDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 0;
  }
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

const TimesheetDesktopRow = React.memo(function TimesheetDesktopRow({
  summary: s,
}: {
  summary: UserSummary;
}) {
  const { t } = useTranslation();

  return (
    <tr key={s.userId} className="hover:bg-bg-subtle transition-colors h-14">
      <td className="py-2 px-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Avatar name={s.name} size="sm" className="h-6 w-6 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] font-semibold" />
          <span className="font-medium text-text-primary truncate max-w-[150px]">{s.name}</span>
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
        {s.status === 'notJoined' && (
          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-bg-muted text-text-tertiary">
            {t('hrm:attendancePage.allAttendance.timesheet.status.notJoined')}
          </span>
        )}
        {s.status === 'newMember' && (
          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-info-soft text-info">
            {t('hrm:attendancePage.allAttendance.timesheet.status.newMember')}
          </span>
        )}
        {s.status === 'sufficient' && (
          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-success-soft text-success">
            {t('hrm:attendancePage.allAttendance.timesheet.status.sufficient')}
          </span>
        )}
        {s.status === 'insufficient' && (
          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-warning-soft text-warning">
            {t('hrm:attendancePage.allAttendance.timesheet.status.insufficient')}
          </span>
        )}
      </td>
    </tr>
  );
});

const TimesheetMobileCard = React.memo(function TimesheetMobileCard({
  summary: s,
}: {
  summary: UserSummary;
}) {
  const { t } = useTranslation();

  return (
    <div
      key={s.userId}
      className="p-3 rounded-radius-sm border border-border-subtle bg-white shadow-none space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={s.name} size="sm" className="h-7 w-7 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] font-semibold" />
          <div className="min-w-0">
            <p className="font-semibold text-[13px] text-text-primary truncate">{s.name}</p>
            <p className="text-[11px] text-text-tertiary truncate">{s.departmentName}</p>
          </div>
        </div>
        {s.status === 'notJoined' && (
          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-bg-muted text-text-tertiary">
            {t('hrm:attendancePage.allAttendance.timesheet.status.notJoined')}
          </span>
        )}
        {s.status === 'newMember' && (
          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-info-soft text-info">
            {t('hrm:attendancePage.allAttendance.timesheet.status.newMember')}
          </span>
        )}
        {s.status === 'sufficient' && (
          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-success-soft text-success">
            {t('hrm:attendancePage.allAttendance.timesheet.status.sufficient')}
          </span>
        )}
        {s.status === 'insufficient' && (
          <span className="inline-flex items-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-warning-soft text-warning">
            {t('hrm:attendancePage.allAttendance.timesheet.status.insufficient')}
          </span>
        )}
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

export function MonthlyTimesheetTable({
  records,
  users,
  departments,
  selectedMonth,
  today,
  approvedOvertime,
  approvedLeaveRequests = [],
  calendarEvents = [],
}: MonthlyTimesheetTableProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('all');

  const deptMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) {
      map.set(d.id, d.name);
    }
    return map;
  }, [departments]);

  // Bộ tính toán tổng hợp chỉ số bảng công từng nhân viên
  const summaries = useMemo<UserSummary[]>(() => {
    // Xác định khoảng thời gian của tháng đang xét
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1; // 1-12
    if (selectedMonth && selectedMonth !== 'all') {
      const [y, m] = selectedMonth.split('-').map(Number);
      if (y && m) {
        year = y;
        month = m;
      }
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const standardWorkingDays = countWorkingDays(firstDayOfMonth, lastDayOfMonth) || 22;

    // 16/10/2026: Xac dinh cac ngay HOLIDAY roi vao Thu 2 - Thu 6 trong thang (paidHolidayDays)
    const holidayDatesInMonth = new Set<string>();
    for (const ev of calendarEvents) {
      if (ev.type !== 'HOLIDAY') continue;
      const start = ev.startDate < firstDayOfMonth ? firstDayOfMonth : ev.startDate;
      const end = ev.endDate > lastDayOfMonth ? lastDayOfMonth : ev.endDate;
      if (start > end) continue;
      const cur = new Date(start);
      const stop = new Date(end);
      while (cur <= stop) {
        const dayOfWeek = cur.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          holidayDatesInMonth.add(`${y}-${m}-${d}`);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    const paidHolidayDays = holidayDatesInMonth.size;

    // Gom nhóm bản ghi theo userId (lọc theo khoảng ngày của tháng được chọn nếu khác 'all')
    const recordsByUser = new Map<string, Attendance[]>();
    for (const r of records) {
      if (selectedMonth && selectedMonth !== 'all') {
        if (r.workDate < firstDayOfMonth || r.workDate > lastDayOfMonth) continue;
      }
      const list = recordsByUser.get(r.userId) || [];
      list.push(r);
      recordsByUser.set(r.userId, list);
    }

    // 16/10/2026: Gom so ngay nghi phep HUONG LUONG (ANNUAL/SICK) da duyet (APPROVED) theo tung userId
    // Triệt tiêu lỗi cộng trùng công (Double-counting): Nếu nhân viên đã đi làm và có log check-in thực tế trong ngày,
    // ưu tiên tính ngày làm việc thực tế, loại trừ không cộng dồn thêm ngày phép.
    const paidLeaveDaysByUser = new Map<string, number>();
    const countedLeaveDatesByUser = new Map<string, Set<string>>();

    for (const lr of approvedLeaveRequests) {
      if (lr.status !== 'APPROVED') continue;
      // Kiem tra loai nghi phep co luong khong (ANNUAL hoac SICK; UNPAID khong tinh)
      const isUnpaid = lr.reason.includes('[UNPAID]') || lr.reason.includes('Nghỉ việc riêng') || lr.reason.includes('Personal leave') || lr.reason.includes('私用休暇'); // i18n-lint-ignore - gia tri SO KHOP du lieu, khong phai text hien thi
      if (isUnpaid) continue;

      const start = lr.startDate < firstDayOfMonth ? firstDayOfMonth : lr.startDate;
      const end = lr.endDate > lastDayOfMonth ? lastDayOfMonth : lr.endDate;
      if (start > end) continue;

      const userRecords = recordsByUser.get(lr.userId) || [];
      const userWorkedDates = new Set(userRecords.map((r) => r.workDate));
      const userCounted = countedLeaveDatesByUser.get(lr.userId) || new Set<string>();

      let leaveWorkingDays = 0;
      const cur = new Date(start);
      const stop = new Date(end);
      while (cur <= stop) {
        const dayOfWeek = cur.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          // Khong dem trung neu ngay nghi phep trung vao ngay nghi le cong ty hoac ngay da di lam thuc te
          if (!holidayDatesInMonth.has(dateStr) && !userWorkedDates.has(dateStr) && !userCounted.has(dateStr)) {
            leaveWorkingDays++;
            userCounted.add(dateStr);
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
      countedLeaveDatesByUser.set(lr.userId, userCounted);
      paidLeaveDaysByUser.set(lr.userId, (paidLeaveDaysByUser.get(lr.userId) ?? 0) + leaveWorkingDays);
    }

    // 22/09/2026: gio OT THAT (da duyet) trong khoang ngay cua thang dang xet, cong don theo
    // userId - thay heuristic doan "checkout sau 17:30" truoc day (xem OvertimeRequestsService).
    const otHoursByUser = new Map<string, number>();
    for (const ot of approvedOvertime) {
      if (ot.workDate < firstDayOfMonth || ot.workDate > lastDayOfMonth) continue;
      otHoursByUser.set(ot.userId, (otHoursByUser.get(ot.userId) ?? 0) + ot.estimatedHours);
    }

    // Duyệt qua tất cả người dùng (hoặc những người có log)
    return users.map((user) => {
      const userRecords = recordsByUser.get(user.id) || [];
      const deptName = user.departmentId ? deptMap.get(user.departmentId) || t('hrm:attendancePage.allAttendance.timesheet.noDepartment') : t('hrm:attendancePage.allAttendance.timesheet.noDepartment');

      // Kiểm tra xem nhân viên có mới gia nhập trong tháng này hoặc chưa gia nhập không
      let isNewMember = false;
      let isNotJoinedYet = false;
      let expectedDays = standardWorkingDays;
      let joinDateGmt7: string | null = null;
      if (user.createdAt) {
        joinDateGmt7 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(user.createdAt));
        if (joinDateGmt7 > lastDayOfMonth) {
          // Chưa gia nhập tại thời điểm của tháng đang xem
          isNotJoinedYet = true;
          expectedDays = 0;
        } else if (joinDateGmt7 >= firstDayOfMonth && joinDateGmt7 <= lastDayOfMonth) {
          isNewMember = true;
          // Tính định mức từ ngày join đến hết tháng
          expectedDays = countWorkingDays(joinDateGmt7, lastDayOfMonth) || 1;
        }
      }
      const totalExpectedHours = expectedDays * 8;

      let actualDays = 0;
      let totalActualHours = 0;
      let lateCount = 0;
      let missingCheckOutCount = 0;
      const otHours = Math.round((otHoursByUser.get(user.id) ?? 0) * 10) / 10;
      const paidLeaveDays = paidLeaveDaysByUser.get(user.id) ?? 0;
      let userPaidHolidayDays = 0;
      if (!isNotJoinedYet) {
        if (isNewMember && joinDateGmt7) {
          // Chi cong ngay le roi vao hoac sau ngay nhan vien gia nhap
          userPaidHolidayDays = Array.from(holidayDatesInMonth).filter((d) => d >= joinDateGmt7).length;
        } else {
          userPaidHolidayDays = paidHolidayDays;
        }
      }

      // Tính toán trên từng log chấm công
      for (const rec of userRecords) {
        actualDays++;

        // 1. Kiểm tra đi muộn (sau 08:30 GMT+7)
        if (rec.checkInAt) {
          const { hour: inHour, minute: inMin } = getGmt7TimeParts(rec.checkInAt);
          if (inHour > 8 || (inHour === 8 && inMin > 30)) {
            lateCount++;
          }
        }

        // 2. Kiểm tra quên checkout
        const isPastDay = rec.workDate < today;
        if (!rec.checkOutAt && isPastDay) {
          missingCheckOutCount++;
        }

        // 3. Tính giờ làm thực tế & khấu trừ giờ nghỉ trưa
        if (rec.checkInAt && rec.checkOutAt) {
          const inMs = new Date(rec.checkInAt).getTime();
          const outMs = new Date(rec.checkOutAt).getTime();
          if (outMs > inMs) {
            let rawHours = (outMs - inMs) / (1000 * 60 * 60);
            // Quy tắc khấu trừ giờ nghỉ trưa cố định: nếu ca làm việc kéo dài > 5 tiếng, trừ 1 tiếng nghỉ trưa
            if (rawHours >= 5) {
              rawHours = Math.max(0, rawHours - 1);
            }
            totalActualHours += rawHours;
          }
        }
      }

      const totalPaidDays = actualDays + paidLeaveDays + userPaidHolidayDays;

      // 16/10/2026: Đánh giá trạng thái công chuẩn hóa:
      // paidDays >= expectedDays -> sufficient (Đủ công)
      let status: 'sufficient' | 'insufficient' | 'newMember' | 'notJoined' = 'sufficient';
      if (isNotJoinedYet) {
        status = 'notJoined';
      } else if (isNewMember) {
        status = totalPaidDays >= expectedDays ? 'sufficient' : 'insufficient';
      } else if (totalPaidDays < expectedDays) {
        status = 'insufficient';
      }

      return {
        userId: user.id,
        name: user.fullName || user.email,
        departmentName: deptName,
        departmentId: user.departmentId ?? null,
        actualDays,
        paidLeaveDays,
        paidHolidayDays: userPaidHolidayDays,
        paidDays: totalPaidDays,
        expectedDays,
        totalActualHours: Math.round(totalActualHours * 10) / 10,
        totalExpectedHours,
        lateCount,
        missingCheckOutCount,
        otHours: Math.round(otHours * 10) / 10,
        status,
        isNewMember,
      };
    });
  }, [records, users, deptMap, selectedMonth, today, t, approvedOvertime, approvedLeaveRequests, calendarEvents]);

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

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `timesheet-${selectedMonth || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const currentUser = useAuthStore((s) => s.user);

  // 22/09/2026: cac cot actualDays/totalActualHours/lateCount/missingCheckOutCount/otHours deu la
  // so lieu THAT (Attendance + OvertimeRequest da duyet tu server, xem summaries o tren) - header
  // van mo phong dung khuon mau import MISA/Fast (chua doi chieu voi tai lieu import chinh thuc cua
  // 2 phan mem nay, ghi nhan la gioi han da biet).
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
      '\uFEFF' +
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
    link.setAttribute('download', `payroll-misa-fast-${selectedMonth || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t('hrm:extensions.payroll.successExport'));
  };

  return (
    <div className="space-y-4">
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
            className="flex items-center gap-1.5 rounded-radius-sm border-border-strong bg-white text-text-primary hover:bg-canvas text-xs font-semibold h-9"
          >
            <DownloadIcon className="h-3.5 w-3.5 text-text-tertiary" />
            <span>{t('hrm:extensions.payroll.exportButton')}</span>
          </Button>
        </div>
      </div>

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
              filteredSummaries.map((s) => (
                <TimesheetDesktopRow key={s.userId} summary={s} />
              ))
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
          filteredSummaries.map((s) => (
            <TimesheetMobileCard key={s.userId} summary={s} />
          ))
        )}
      </div>
    </div>
  );
}

