import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { DownloadIcon, SearchIcon, ClockIcon, FileTextIcon } from '@/components/ui/Icons';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import type { Attendance, User, Department } from '@/types';

interface MonthlyTimesheetTableProps {
  records: Attendance[];
  users: User[];
  departments: Department[];
  selectedMonth: string; // 'YYYY-MM' or 'all'
  today: string; // 'YYYY-MM-DD' GMT+7
}

interface UserSummary {
  userId: string;
  name: string;
  departmentName: string;
  departmentId: string | null;
  actualDays: number;
  expectedDays: number;
  totalActualHours: number;
  totalExpectedHours: number;
  lateCount: number;
  missingCheckOutCount: number;
  otHours: number;
  status: 'sufficient' | 'insufficient' | 'newMember';
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

export function MonthlyTimesheetTable({
  records,
  users,
  departments,
  selectedMonth,
  today,
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

    // Gom nhóm bản ghi theo userId
    const recordsByUser = new Map<string, Attendance[]>();
    for (const r of records) {
      const list = recordsByUser.get(r.userId) || [];
      list.push(r);
      recordsByUser.set(r.userId, list);
    }

    // Duyệt qua tất cả người dùng (hoặc những người có log)
    return users.map((user) => {
      const userRecords = recordsByUser.get(user.id) || [];
      const deptName = user.departmentId ? deptMap.get(user.departmentId) || t('hrm:attendancePage.allAttendance.timesheet.noDepartment') : t('hrm:attendancePage.allAttendance.timesheet.noDepartment');

      // Kiểm tra xem nhân viên có mới gia nhập trong tháng này không
      let isNewMember = false;
      let expectedDays = standardWorkingDays;
      if (user.createdAt) {
        const joinDateGmt7 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(user.createdAt));
        if (joinDateGmt7 >= firstDayOfMonth && joinDateGmt7 <= lastDayOfMonth) {
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
      let otHours = 0;

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

            // 4. Quy tắc OT: Giờ làm sau mốc kết thúc ca quy định (17:30 GMT+7)
            const { hour: outHour, minute: outMin } = getGmt7TimeParts(rec.checkOutAt);
            if (outHour > 17 || (outHour === 17 && outMin > 30)) {
              const otMin = (outHour - 17) * 60 + (outMin - 30);
              otHours += otMin / 60;
            }
          }
        }
      }

      // Đánh giá trạng thái
      let status: 'sufficient' | 'insufficient' | 'newMember' = 'sufficient';
      if (isNewMember) {
        status = 'newMember';
      } else if (actualDays < expectedDays || totalActualHours < totalExpectedHours * 0.9) {
        status = 'insufficient';
      }

      return {
        userId: user.id,
        name: user.fullName || user.email,
        departmentName: deptName,
        departmentId: user.departmentId ?? null,
        actualDays,
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
  }, [records, users, deptMap, selectedMonth, today, t]);

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
      `${t('hrm:attendancePage.allAttendance.timesheet.columns.workHours')} (${t('hrm:attendancePage.allAttendance.timesheet.hoursUnit')})`,
      t('hrm:attendancePage.allAttendance.timesheet.columns.lateCount'),
      t('hrm:attendancePage.allAttendance.timesheet.columns.missingCheckOut'),
      `${t('hrm:attendancePage.allAttendance.timesheet.columns.otHours')} (${t('hrm:attendancePage.allAttendance.timesheet.hoursUnit')})`,
      t('hrm:attendancePage.allAttendance.timesheet.columns.status'),
    ];

    const rows = filteredSummaries.map((s) => [
      sanitizeCsvValue(s.name),
      sanitizeCsvValue(s.departmentName),
      sanitizeCsvValue(`${s.actualDays}/${s.expectedDays}`),
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

  // Xuất file tương thích Payroll (Mock Header chuẩn MISA/Fast)
  const handleExportPayroll = () => {
    // Header chuẩn MISA / Fast HRM import template
    const headers = [
      'Mã nhân viên', // i18n-lint-ignore: MISA/Fast payroll header
      'Họ và tên', // i18n-lint-ignore: MISA/Fast payroll header
      'Phòng ban', // i18n-lint-ignore: MISA/Fast payroll header
      'Công chuẩn', // i18n-lint-ignore: MISA/Fast payroll header
      'Công thực tế', // i18n-lint-ignore: MISA/Fast payroll header
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
      sanitizeCsvValue(s.actualDays),
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
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('hrm:attendancePage.allAttendance.timesheet.searchPlaceholder')}
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 pl-8.5 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <CustomFilterSelect
            value={selectedDeptId}
            options={deptFilterOptions}
            onChange={setSelectedDeptId}
            ariaLabel={t('hrm:attendancePage.allAttendance.timesheet.allDepartments')}
            className="min-w-[140px]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-xl border-slate-200/80 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <DownloadIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>{t('hrm:attendancePage.allAttendance.exportCsv')}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleExportPayroll}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
          >
            <FileTextIcon className="h-3.5 w-3.5" />
            <span>{t('hrm:extensions.payroll.exportButton')}</span>
          </Button>
        </div>
      </div>

      {/* Hiển thị bảng số liệu trên màn hình Desktop */}
      <div className="hidden sm:block overflow-x-auto max-h-[460px] overflow-y-auto rounded-xl border border-slate-200/70">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200">
            <tr className="text-left font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-3">{t('hrm:attendancePage.allAttendance.timesheet.columns.employee')}</th>
              <th className="py-2.5 px-3">{t('hrm:attendancePage.allAttendance.timesheet.columns.department')}</th>
              <th className="py-2.5 px-3 text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.actualDays')}</th>
              <th className="py-2.5 px-3 text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.workHours')}</th>
              <th className="py-2.5 px-3 text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.lateCount')}</th>
              <th className="py-2.5 px-3 text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.missingCheckOut')}</th>
              <th className="py-2.5 px-3 text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.otHours')}</th>
              <th className="py-2.5 px-3 text-center">{t('hrm:attendancePage.allAttendance.timesheet.columns.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredSummaries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  {t('hrm:attendancePage.allAttendance.timesheet.empty')}
                </td>
              </tr>
            ) : (
              filteredSummaries.map((s) => (
                <tr key={s.userId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.name} size="sm" className="h-6 w-6 text-[10px]" />
                      <span className="font-semibold text-slate-900 truncate max-w-[150px]">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{s.departmentName}</td>
                  <td className="py-2 px-3 text-center font-mono whitespace-nowrap">
                    <span className="font-bold text-slate-800">{s.actualDays}</span>
                    <span className="text-slate-400 font-normal"> / {s.expectedDays}</span>
                  </td>
                  <td className="py-2 px-3 text-center font-mono whitespace-nowrap">
                    <span className="font-bold text-slate-800">{s.totalActualHours}h</span>
                    <span className="text-slate-400 font-normal"> / {s.totalExpectedHours}h</span>
                  </td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    {s.lateCount > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold text-[11px] border border-amber-200/50">
                        {s.lateCount}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    {s.missingCheckOutCount > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-[11px] border border-rose-200/50">
                        {s.missingCheckOutCount}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center font-mono font-medium text-slate-700 whitespace-nowrap">
                    {s.otHours > 0 ? `${s.otHours}h` : '—'}
                  </td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    {s.status === 'newMember' && (
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                        {t('hrm:attendancePage.allAttendance.timesheet.status.newMember')}
                      </Badge>
                    )}
                    {s.status === 'sufficient' && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        {t('hrm:attendancePage.allAttendance.timesheet.status.sufficient')}
                      </Badge>
                    )}
                    {s.status === 'insufficient' && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                        {t('hrm:attendancePage.allAttendance.timesheet.status.insufficient')}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Hiển thị dạng Card danh sách trên giao diện Di động (Mobile) */}
      <div className="block sm:hidden space-y-2.5 max-h-[460px] overflow-y-auto pr-0.5">
        {filteredSummaries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {t('hrm:attendancePage.allAttendance.timesheet.empty')}
          </div>
        ) : (
          filteredSummaries.map((s) => (
            <div
              key={s.userId}
              className="p-3 rounded-xl border border-slate-200/80 bg-white shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={s.name} size="sm" className="h-7 w-7 text-[10px]" />
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{s.departmentName}</p>
                  </div>
                </div>
                {s.status === 'newMember' && (
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                    {t('hrm:attendancePage.allAttendance.timesheet.status.newMember')}
                  </Badge>
                )}
                {s.status === 'sufficient' && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    {t('hrm:attendancePage.allAttendance.timesheet.status.sufficient')}
                  </Badge>
                )}
                {s.status === 'insufficient' && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                    {t('hrm:attendancePage.allAttendance.timesheet.status.insufficient')}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {t('hrm:attendancePage.allAttendance.timesheet.columns.actualDays')}:
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {s.actualDays} / {s.expectedDays} {t('hrm:attendancePage.allAttendance.timesheet.daysUnit')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {t('hrm:attendancePage.allAttendance.timesheet.columns.workHours')}:
                  </span>
                  <span className="font-mono font-bold text-slate-800">
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
          ))
        )}
      </div>
    </div>
  );
}

