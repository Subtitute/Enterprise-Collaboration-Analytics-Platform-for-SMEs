import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CameraIcon, ClockIcon, MapPinIcon, UsersIcon, UserIcon, PlusIcon, EditIcon, CheckIcon } from '@/components/ui/Icons';
import { formatTime, formatDateTime, formatDate } from '@/lib/utils';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useAuthStore } from '@/stores/auth.store';
import { CheckInCamera } from './components/CheckInCamera';
import type { CheckInLocation } from './components/CheckInCamera';
import { MonthlyTimesheetTable } from './components/MonthlyTimesheetTable';
import { AttendanceAdjustmentModal } from './components/AttendanceAdjustmentModal';
import { OvertimeRegistrationModal } from './components/OvertimeRegistrationModal';
import { PendingAdjustmentsList } from './components/PendingAdjustmentsList';
import { PendingOvertimeList } from './components/PendingOvertimeList';
import { getAttendancePhotoUrl } from './api';
import {
  useAllAttendanceQuery,
  useApproveAttendanceAdjustment,
  useApprovedAttendanceAdjustmentsQuery,
  useApproveOvertimeRequest,
  useApprovedOvertimeRequestsQuery,
  useCheckIn,
  useCheckOut,
  useMyAttendanceQuery,
  useMyLeaveRequestsQuery,
  usePendingAttendanceAdjustmentsQuery,
  usePendingOvertimeRequestsQuery,
  useRejectAttendanceAdjustment,
  useRejectOvertimeRequest,
} from './hooks';

/**
 * 13/08/2026 (Technical_Spec.md muc 17): huy hieu co "on-site"/"off-site" - `null`/`undefined`
 * (chua co du lieu de danh gia) KHONG hien gi ca, CHI hien khi co ket qua ro rang. Day la tin
 * hieu THEM cho Manager doi chieu voi anh, khong phai trang thai loi/canh bao chan cham cong.
 */
// 03/10/2026: export - AttendanceDetailPage.tsx (trang chi tiet cham cong 1 nhan vien,
// /attendance/:userId) tai su dung nguyen ham nay thay vi chep lai, mirror cach PhotoProofModal/
// AttendanceStatusBadge/formatTotalHours/getTodayGmt7 duoi day cung duoc export cho cung muc dich.
export function OnSiteBadge({ isOnSite }: { isOnSite?: boolean | null }) {
  const { t } = useTranslation();
  if (isOnSite === undefined || isOnSite === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isOnSite ? 'text-emerald-600' : 'text-amber-600'}`}
      title={isOnSite ? t('hrm:attendancePage.onSiteBadge.onSiteTitle') : t('hrm:attendancePage.onSiteBadge.offSiteTitle')}
    >
      <MapPinIcon className="h-3 w-3" />
      {isOnSite ? t('hrm:attendancePage.onSiteBadge.onSite') : t('hrm:attendancePage.onSiteBadge.offSite')}
    </span>
  );
}

/**
 * Tính tổng số giờ làm việc giữa check-in và check-out (Ví dụ: 8.5 giờ)
 * 16/09/2026: gop merge - ca 2 nhanh deu tu them 1 key i18n rieng cho chuoi "X giờ"
 * (totalHoursValue vs hoursUnit). Giu totalHoursValue (di kem kieu TFunction da co san import
 * o dau file), xoa hoursUnit khoi hrm.json (vi/en/ja) vi khong con noi nao goi toi.
 */
export function formatTotalHours(t: TFunction, checkInAt?: string | null, checkOutAt?: string | null): string {
  if (!checkInAt || !checkOutAt) return '—';
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '—';
  const diffHours = (end - start) / (1000 * 60 * 60);
  return t('hrm:attendancePage.totalHoursValue', { hours: diffHours.toFixed(1) });
}

/**
 * Modal hiển thị ảnh chụp bằng chứng chấm công (Photo-Proof Modal)
 */
export function PhotoProofModal({
  target,
  onClose,
}: {
  target: { id: string; kind: 'checkin' | 'checkout'; time: string; userName?: string; isOnSite?: boolean | null } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!target) {
      setPhotoUrl(null);
      setIsLoading(false);
      setError(false);
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    setError(false);

    getAttendancePhotoUrl(target.id, target.kind)
      .then((url) => {
        if (isMounted) {
          setPhotoUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(true);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [target]);

  if (!target) return null;

  const actionText = target.kind === 'checkin' ? t('hrm:attendancePage.photoModal.actionCheckIn') : t('hrm:attendancePage.photoModal.actionCheckOut');

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-[16px] leading-[24px] font-semibold text-text-primary">
          <CameraIcon className="h-4 w-4 text-accent" />
          <span>{t('hrm:attendancePage.photoModal.title', { action: actionText })}</span>
        </div>
      }
      size="sm"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('hrm:attendancePage.photoModal.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs bg-bg-subtle p-2.5 rounded-radius-sm border border-border-subtle">
          <div>
            <span className="font-semibold text-text-primary">{target.userName || t('hrm:attendancePage.photoModal.personal')}</span>
            <div className="font-mono text-text-primary font-medium mt-0.5 tabular-nums">{target.time}</div>
          </div>
          <OnSiteBadge isOnSite={target.isOnSite} />
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-radius-md bg-slate-900 border border-border-subtle flex items-center justify-center">
          {isLoading && (
            <div className="flex flex-col items-center gap-2 text-accent">
              <Spinner className="h-8 w-8 text-accent" />
              <span className="text-xs text-text-tertiary">{t('hrm:attendancePage.photoModal.loading')}</span>
            </div>
          )}
          {error && (
            <div className="p-4 text-center text-xs text-error">
              {t('hrm:attendancePage.photoModal.error')}
            </div>
          )}
          {photoUrl && !isLoading && (
            <img src={photoUrl} alt={t('hrm:attendancePage.photoModal.imageAlt')} className="h-full w-full object-cover" />
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * Hệ thống Nhãn trạng thái (Status Badges) cho chấm công:
 * - Đúng giờ (bg-emerald-100 text-emerald-700)
 * - Đi muộn (bg-amber-100 text-amber-700)
 * - Quên check-out (bg-rose-100 text-rose-600)
 */
export function AttendanceStatusBadge({
  record,
  today,
  isAdjusted = false,
}: {
  record: { workDate: string; checkInAt: string; checkOutAt?: string | null };
  today: string;
  isAdjusted?: boolean;
}) {
  const { t } = useTranslation();

  if (isAdjusted) {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-accent-soft text-accent whitespace-nowrap">
        <span className="h-1 w-1 rounded-full bg-accent" />
        {t('hrm:extensions.adjustment.badge.adjusted')}
      </span>
    );
  }

  const checkInDate = new Date(record.checkInAt);
  const gmt7Parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(checkInDate);
  const checkInHour = Number(gmt7Parts.find((p) => p.type === 'hour')?.value ?? 0);
  const checkInMinute = Number(gmt7Parts.find((p) => p.type === 'minute')?.value ?? 0);
  const isLate = checkInHour > 8 || (checkInHour === 8 && checkInMinute > 30); // Giờ chuẩn vào ca 8:30
  const isPastDay = record.workDate < today;
  const isMissingCheckOut = !record.checkOutAt && isPastDay;

  if (isMissingCheckOut) {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-error-soft text-error whitespace-nowrap">
        <span className="h-1 w-1 rounded-full bg-error" />
        {t('hrm:attendancePage.statusBadge.missingCheckOut')}
      </span>
    );
  }

  if (isLate) {
    return (
      <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-warning-soft text-warning whitespace-nowrap">
        <span className="h-1 w-1 rounded-full bg-warning" />
        {t('hrm:attendancePage.statusBadge.late')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-success-soft text-success whitespace-nowrap">
      <span className="h-1 w-1 rounded-full bg-success" />
      {t('hrm:attendancePage.statusBadge.onTime')}
    </span>
  );
}

/** Ngay hien tai theo lich GMT+7, dang 'YYYY-MM-DD' - dung 'en-CA' vi dinh dang chuan cua locale
 *  nay trung khop ISO date (YYYY-MM-DD), tranh phai tu ghep chuoi thu cong. */
export function getTodayGmt7(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

/** Trang Cham cong (HRM-lite) - Technical_Spec.md muc 17, Wireframe.md muc 13. */
export function AttendancePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cameraMode, setCameraMode] = useState<'checkin' | 'checkout' | null>(null);
  const [orgSubTab, setOrgSubTab] = useState<'timesheet' | 'log' | 'adjustments' | 'overtime'>('timesheet');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Modal states for extensions
  const [viewingPhoto, setViewingPhoto] = useState<{
    id: string;
    kind: 'checkin' | 'checkout';
    time: string;
    userName?: string;
    isOnSite?: boolean | null;
  } | null>(null);
  const [adjustmentRecord, setAdjustmentRecord] = useState<import('@/types').Attendance | null>(null);
  const [showOtModal, setShowOtModal] = useState(false);

  const currentUser = useAuthStore((s) => s.user);

  // Bộ lọc Dropdown Tháng/Năm (mặc định tháng hiện tại: 'YYYY-MM')
  // 03/10/2026: sua loi thuc te phat hien qua rieng soat - ban cu dung `toISOString()` (UTC), trong
  // khi ca trang con lai (vd `today` ben duoi) dung GMT+7. Tu 00:00-06:59 gio VN ngay dau thang,
  // UTC con o THANG TRUOC, khien bo loc mac dinh chon nham thang cu va an mat ban ghi cham cong vua
  // tao trong thang moi cho den khi tu doi dropdown. Dung getTodayGmt7() (da co san, dung cho
  // `today`) thay vi tu tinh lai bang UTC.
  const currentMonthStr = useMemo(() => getTodayGmt7().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [orgSelectedMonth, setOrgSelectedMonth] = useState<string>(currentMonthStr);

  // Tạo danh sách 6 tháng gần nhất để lựa chọn nhanh
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: t('hrm:attendancePage.monthFilter.allTime') }];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lbl = t('hrm:attendancePage.monthFilter.monthYear', { month: d.getMonth() + 1, year: d.getFullYear() });
      options.push({ value: val, label: lbl });
    }
    return options;
  }, [t]);

  // Đồng hồ chạy thời gian thực (Live Digital Clock)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const attendanceQuery = useMyAttendanceQuery({ limit: 50 });
  // 03/10/2026: truyen `orgSelectedMonth` de server loc dung thang dang xem (xem chu thich tai
  // useAllAttendanceQuery) thay vi luon ke 100 dong moi nhat roi tu cat o client.
  const allAttendanceQuery = useAllAttendanceQuery(orgSelectedMonth);
  const myLeaveRequestsQuery = useMyLeaveRequestsQuery();
  const { map: userNameMap, users: orgUsers } = useUserNameMap();
  const departmentsQuery = useDepartmentsQuery();
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();

  // 22/09/2026: giai trinh cham cong/tang ca - du lieu that tu server (thay localStorage truoc
  // day). Danh sach "cho duyet" (Manager/Org Admin) va "cua toi" deu can cho trang nay: "cho duyet"
  // de hien trong PendingAdjustmentsList/PendingOvertimeList, "cua toi" khong con can thiet truc
  // tiep vi hau qua da phan anh THANG vao Attendance that (xem duoi) - nhung van giu useApprovedOvertimeRequestsQuery()
  // rieng cho MonthlyTimesheetTable (otHours that).
  const pendingAdjustmentsQuery = usePendingAttendanceAdjustmentsQuery();
  const pendingOvertimeQuery = usePendingOvertimeRequestsQuery();
  const approvedAdjustmentsQuery = useApprovedAttendanceAdjustmentsQuery();
  const approvedOvertimeQuery = useApprovedOvertimeRequestsQuery();
  const approveAdjustmentMutation = useApproveAttendanceAdjustment();
  const rejectAdjustmentMutation = useRejectAttendanceAdjustment();
  const approveOvertimeMutation = useApproveOvertimeRequest();
  const rejectOvertimeMutation = useRejectOvertimeRequest();

  const today = useMemo(getTodayGmt7, []);
  const todayRecord = attendanceQuery.data?.data.find((a) => a.workDate === today);
  // 403 (khong co PERMISSIONS.ATTENDANCE_VIEW) la ket qua BINH THUONG cho Employee thuong - coi
  // nhu "khong ap dung", mirror canApprove cua LeaveRequestsPage.tsx.
  const canViewAll = !allAttendanceQuery.isError && allAttendanceQuery.isSuccess;
  // 03/10/2026: phat hien qua rieng soat - 2 phan he Giai trinh/Tang ca dung permission RIENG
  // (ATTENDANCE_ADJUSTMENT_VIEW/OVERTIME_REQUEST_VIEW, xem DEFAULT_ROLE_PERMISSIONS) chu khong
  // phai ATTENDANCE_VIEW, nhung ca khoi "Quan ly to chuc" (bao gom 2 tab nay) truoc day chi gate
  // theo DUY NHAT `canViewAll`. 1 vai tro tuy chinh qua Quan tri > Vai tro & Phan quyen duoc cap
  // rieng 1 trong 2 quyen nay (khong kem ATTENDANCE_VIEW) se bi an mat toan bo khoi, du backend
  // van cho phep duyet/tu choi binh thuong. Suy ra tin hieu rieng cho tung tab, cung 1 quy uoc
  // "doi chieu isSuccess/isError cua chinh query do" nhu canViewAll o tren.
  const canViewAdjustments = !pendingAdjustmentsQuery.isError && pendingAdjustmentsQuery.isSuccess;
  const canViewOvertime = !pendingOvertimeQuery.isError && pendingOvertimeQuery.isSuccess;
  const canViewOrgCard = canViewAll || canViewAdjustments || canViewOvertime;

  // 03/10/2026: `orgSubTab` mac dinh la 'timesheet' (xem useState o tren), nhung 1 vai tro chi
  // duoc cap ATTENDANCE_ADJUSTMENT_VIEW/OVERTIME_REQUEST_VIEW (khong kem ATTENDANCE_VIEW) se
  // khong thay tab 'timesheet'/'log' nao ca - tu chuyen sang tab DAU TIEN ho thuc su xem duoc
  // ngay khi xac dinh duoc quyen (tranh dung "mac ket" o 1 tab rong/an).
  useEffect(() => {
    if (orgSubTab === 'timesheet' || orgSubTab === 'log') {
      if (canViewAll) return;
    } else if (orgSubTab === 'adjustments') {
      if (canViewAdjustments) return;
    } else if (canViewOvertime) {
      return;
    }
    if (canViewAll) setOrgSubTab('timesheet');
    else if (canViewAdjustments) setOrgSubTab('adjustments');
    else if (canViewOvertime) setOrgSubTab('overtime');
  }, [canViewAll, canViewAdjustments, canViewOvertime, orgSubTab]);

  // 22/09/2026: duyet giai trinh THANH CONG se ghi de checkInAt/checkOutAt THAT cua Attendance
  // ngay tren server (xem AttendanceAdjustmentsService.decide()), va useApproveAttendanceAdjustment()
  // da invalidate ['attendance'] - attendanceQuery/allAttendanceQuery se tu dong tai lai gia tri
  // DUNG, khong con can tu vá (patch) client-side nhu truoc (applyApprovedAdjustment() da bi xoa).
  // Danh dau "da sua cong" (badge) van giu lai, chi doi nguon: quet PENDING/APPROVED tu ca 2 danh
  // sach cho duyet lan cua toi thay vi 1 bien trang thai cuc bo.
  const pendingAdjustments = useMemo(
    () => pendingAdjustmentsQuery.data?.data.filter((a) => a.status === 'PENDING') ?? [],
    [pendingAdjustmentsQuery.data],
  );
  const pendingOvertimeRequests = useMemo(
    () => pendingOvertimeQuery.data?.data.filter((ot) => ot.status === 'PENDING') ?? [],
    [pendingOvertimeQuery.data],
  );
  const pendingAdjustmentsCount = pendingAdjustments.length;
  const pendingOtCount = pendingOvertimeRequests.length;

  const approvedAdjustmentAttendanceIds = useMemo(
    () => new Set((approvedAdjustmentsQuery.data ?? []).map((a) => a.attendanceId)),
    [approvedAdjustmentsQuery.data],
  );

  const pendingAdjustmentsWithName = useMemo(
    () => pendingAdjustments.map((a) => ({ ...a, userName: userNameMap[a.userId] ?? a.userId })),
    [pendingAdjustments, userNameMap],
  );
  const pendingOvertimeWithName = useMemo(
    () => pendingOvertimeRequests.map((ot) => ({ ...ot, userName: userNameMap[ot.userId] ?? ot.userId })),
    [pendingOvertimeRequests, userNameMap],
  );

  const handleApproveAdjustment = (id: string) => approveAdjustmentMutation.mutate(id);
  const handleRejectAdjustment = (id: string) => rejectAdjustmentMutation.mutate(id);
  const handleApproveOt = (id: string) => approveOvertimeMutation.mutate(id);
  const handleRejectOt = (id: string) => rejectOvertimeMutation.mutate(id);

  // Lọc dữ liệu theo Tháng/Năm đã chọn
  const filteredMyRecords = useMemo(() => {
    const rawRecords = attendanceQuery.data?.data ?? [];
    if (selectedMonth === 'all') return rawRecords;
    return rawRecords.filter((r) => r.workDate.startsWith(selectedMonth));
  }, [attendanceQuery.data?.data, selectedMonth]);

  const filteredAllRecords = useMemo(() => {
    const raw = allAttendanceQuery.data?.data ?? [];
    if (orgSelectedMonth === 'all') return raw;
    return raw.filter((r) => r.workDate.startsWith(orgSelectedMonth));
  }, [allAttendanceQuery.data?.data, orgSelectedMonth]);

  const effectiveTodayRecord = todayRecord;

  function handleConfirmPhoto(photo: Blob, location?: CheckInLocation) {
    const mutation = cameraMode === 'checkin' ? checkInMutation : checkOutMutation;
    mutation.mutate({ photo, location }, { onSuccess: () => setCameraMode(null) });
  }

  const timeString = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('hrm:attendancePage.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('hrm:attendancePage.subtitle')}</p>
      </div>

      {/* Bố cục Lưới bất đối xứng (Grid & Tabs): Gập 1 cột mượt mà trên Mobile (grid-cols-1), 2 cột trên Desktop (lg:grid-cols-12) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        {/* Khối bên trái: Card A - Hôm nay với đồng hồ số lớn */}
        <div className="w-full lg:col-span-5 flex flex-col">
          <Card className="border border-border-subtle bg-surface shadow-none overflow-hidden flex flex-col h-full rounded-radius-md">
            <CardHeader className="pb-3 border-b border-border-subtle">
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <CardTitle className="text-[15px] font-semibold text-text-primary min-w-0">
                  {t('hrm:attendancePage.today.cardTitle', { date: formatDate(today) })}
                </CardTitle>
                {effectiveTodayRecord?.checkOutAt ? (
                  <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-success-soft text-success whitespace-nowrap shrink-0">
                    <span className="h-1 w-1 rounded-full bg-success" />
                    {t('hrm:attendancePage.today.doneToday')}
                  </span>
                ) : effectiveTodayRecord ? (
                  <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-bg-muted text-text-secondary whitespace-nowrap shrink-0">
                    <span className="h-1 w-1 rounded-full bg-text-secondary" />
                    {t('hrm:attendancePage.today.checkedInBadge')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold bg-bg-muted text-text-secondary whitespace-nowrap shrink-0">
                    <span className="h-1 w-1 rounded-full bg-text-secondary" />
                    {t('hrm:attendancePage.today.notCheckedInBadge')}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5 flex flex-col items-center text-center flex-1 justify-between">
              <div className="w-full">
                {/* Đồng hồ số điện tử lớn: IBM Plex Mono 40/48 w500 tabular-nums, CĂN GIỮA */}
                <div className="py-2 text-center">
                  <div
                    className="font-mono text-[40px] leading-[48px] font-medium text-text-primary tabular-nums tracking-normal text-center select-none"
                    style={{ fontFeatureSettings: '"tnum"' }}
                  >
                    {timeString}
                  </div>
                  <p className="text-[12px] leading-[18px] text-text-tertiary font-normal mt-1 text-center">
                    {t('hrm:attendancePage.today.systemTimeLabel')}
                  </p>
                </div>

                {/* Trạng thái chấm công trong ngày: 2 row thông tin nền bg-subtle radius 6 padding 12 */}
                <div className="mt-4 w-full rounded-radius-sm bg-bg-subtle p-3 text-left space-y-2 border border-border-subtle">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-text-secondary flex items-center gap-1.5 font-normal">
                      <ClockIcon className="h-3.5 w-3.5 text-text-tertiary" />
                      {t('hrm:attendancePage.today.checkInLabel')}
                    </span>
                    {effectiveTodayRecord ? (
                      <span className="font-medium text-text-primary flex items-center gap-1.5">
                        <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
                          {formatTime(effectiveTodayRecord.checkInAt)}
                        </span>
                        <OnSiteBadge isOnSite={effectiveTodayRecord.checkInIsOnSite} />
                      </span>
                    ) : (
                      <span className="text-text-tertiary italic font-normal">{t('hrm:attendancePage.today.notRecorded')}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border-subtle pt-2 text-[13px]">
                    <span className="text-text-secondary flex items-center gap-1.5 font-normal">
                      <ClockIcon className="h-3.5 w-3.5 text-text-tertiary" />
                      {t('hrm:attendancePage.today.checkOutLabel')}
                    </span>
                    {effectiveTodayRecord?.checkOutAt ? (
                      <span className="font-medium text-text-primary flex items-center gap-1.5">
                        <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
                          {formatTime(effectiveTodayRecord.checkOutAt)}
                        </span>
                        <OnSiteBadge isOnSite={effectiveTodayRecord.checkOutIsOnSite} />
                      </span>
                    ) : (
                      <span className="text-text-tertiary italic font-normal">{t('hrm:attendancePage.today.notRecorded')}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Nút hành động Check-in / Check-out */}
              <div className="mt-5 w-full">
                {!effectiveTodayRecord && (
                  <Button
                    size="lg"
                    className="w-full justify-center bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-10 text-[14px] font-medium cursor-pointer"
                    onClick={() => setCameraMode('checkin')}
                  >
                    <CameraIcon className="h-4 w-4" /> {t('hrm:attendancePage.today.checkInButton')}
                  </Button>
                )}
                {effectiveTodayRecord && !effectiveTodayRecord.checkOutAt && (
                  <Button
                    size="lg"
                    className="w-full justify-center bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-10 text-[14px] font-medium cursor-pointer"
                    onClick={() => setCameraMode('checkout')}
                  >
                    <CameraIcon className="h-4 w-4" /> {t('hrm:attendancePage.today.checkOutButton')}
                  </Button>
                )}
                {effectiveTodayRecord?.checkOutAt && (
                  <div className="flex items-center justify-center gap-2 rounded-radius-sm bg-success-soft px-3 py-2.5 text-[13px] font-medium text-success text-center">
                    <CheckIcon className="h-3.5 w-3.5" />
                    <span>{t('hrm:attendancePage.today.completedMessage')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Khối bên phải: Card B - Lịch sử chấm công */}
        <div className="w-full lg:col-span-7 flex flex-col">
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
                    onClick={() => setShowOtModal(true)}
                    className="border-border-strong text-text-secondary hover:bg-canvas hover:text-text-primary rounded-radius-sm h-9 px-3 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <PlusIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{t('hrm:extensions.overtime.registerButton')}</span>
                  </Button>

                  <CustomFilterSelect
                    value={selectedMonth}
                    options={monthOptions}
                    onChange={setSelectedMonth}
                    ariaLabel={t('hrm:attendancePage.monthFilter.ariaLabel')}
                    className="w-[160px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col min-h-0">
              <QueryState
                isLoading={attendanceQuery.isLoading}
                isError={attendanceQuery.isError}
                onRetry={() => attendanceQuery.refetch()}
                loadingFallback={<FullPageSpinner label={t('hrm:attendancePage.history.loading')} />}
                errorTitle={t('hrm:attendancePage.history.errorTitle')}
                errorDescription={t('hrm:attendancePage.history.errorDescription')}
              >
                {filteredMyRecords.length === 0 ? (
                  <EmptyState
                    title={t('hrm:attendancePage.history.emptyTitle')}
                    description={selectedMonth !== 'all' ? t('hrm:attendancePage.history.emptyFilteredDescription', { month: monthOptions.find((m) => m.value === selectedMonth)?.label }) : t('hrm:attendancePage.history.emptyDescription')}
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
                        {filteredMyRecords.map((record) => {
                          const isAdjusted = approvedAdjustmentAttendanceIds.has(record.id);
                          return (
                            <tr key={record.id} className="hover:bg-bg-subtle transition-colors">
                              <td className="py-2.5 px-3 text-text-primary font-mono text-[13px] whitespace-nowrap">{formatDate(record.workDate)}</td>
                              <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">{formatTime(record.checkInAt)}</span>
                                  <OnSiteBadge isOnSite={record.checkInIsOnSite} />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingPhoto({
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
                                    <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">{formatTime(record.checkOutAt)}</span>
                                    <OnSiteBadge isOnSite={record.checkOutIsOnSite} />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setViewingPhoto({
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
                                  <span className="text-text-tertiary italic font-normal">{t('hrm:attendancePage.today.notRecorded')}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[13px] font-medium whitespace-nowrap tabular-nums">
                                <span className={record.checkOutAt ? 'text-text-primary' : 'text-text-tertiary font-normal'}>
                                  {formatTotalHours(t, record.checkInAt, record.checkOutAt)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <AttendanceStatusBadge record={record} today={today} isAdjusted={isAdjusted} />
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap text-right">
                                <button
                                  type="button"
                                  onClick={() => setAdjustmentRecord(record)}
                                  className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline cursor-pointer"
                                  title={t('hrm:extensions.adjustment.requestButton')}
                                >
                                  <EditIcon className="h-3 w-3" />
                                  <span>{t('hrm:extensions.adjustment.requestButton')}</span>
                                </button>
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
        </div>
      </div>

      {/* Khối bên dưới: Card "Quản lý tổ chức" toàn màn hình (chỉ hiển thị cho Manager / Admin) */}
      {canViewOrgCard && (
        <Card className="border border-border-subtle bg-surface shadow-none overflow-hidden rounded-radius-md">
          <CardHeader className="pb-3 border-b border-border-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {/* Tiêu đề & Segmented Control */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-text-tertiary" />
                  <CardTitle className="text-[15px] font-semibold text-text-primary">
                    {t('hrm:extensions.orgTabs.mainTitle')}
                  </CardTitle>
                </div>

                {/* Sub-tabs điều hướng: Segmented Control phẳng (nền bg-subtle, active nền trắng + Ink w600 + border subtle) */}
                <div className="flex flex-wrap items-center gap-1 rounded-radius-sm bg-bg-subtle p-1 border border-border-subtle">
                  {canViewAll && (
                    <button
                      type="button"
                      onClick={() => setOrgSubTab('timesheet')}
                      className={`px-3 py-1 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer ${
                        orgSubTab === 'timesheet'
                          ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t('hrm:extensions.orgTabs.subtabs.timesheet')}
                    </button>
                  )}

                  {canViewAll && (
                    <button
                      type="button"
                      onClick={() => setOrgSubTab('log')}
                      className={`px-3 py-1 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer ${
                        orgSubTab === 'log'
                          ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t('hrm:extensions.orgTabs.subtabs.log')}
                    </button>
                  )}

                  {canViewAdjustments && (
                    <button
                      type="button"
                      onClick={() => setOrgSubTab('adjustments')}
                      className={`flex items-center gap-1.5 px-3 py-1 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer ${
                        orgSubTab === 'adjustments'
                          ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <EditIcon className="h-3 w-3" />
                      <span>{t('hrm:extensions.orgTabs.subtabs.adjustments')}</span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium ${
                          pendingAdjustmentsCount > 0
                            ? 'bg-warning-soft text-warning'
                            : 'bg-bg-muted text-text-tertiary'
                        }`}
                      >
                        {pendingAdjustmentsCount}
                      </span>
                    </button>
                  )}

                  {canViewOvertime && (
                    <button
                      type="button"
                      onClick={() => setOrgSubTab('overtime')}
                      className={`flex items-center gap-1.5 px-3 py-1 text-[13px] leading-5 rounded-[4px] transition-all cursor-pointer ${
                        orgSubTab === 'overtime'
                          ? 'bg-white text-text-primary font-semibold shadow-xs border border-border-subtle'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <ClockIcon className="h-3 w-3" />
                      <span>{t('hrm:extensions.orgTabs.subtabs.overtime')}</span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium ${
                          pendingOtCount > 0
                            ? 'bg-warning-soft text-warning'
                            : 'bg-bg-muted text-text-tertiary'
                        }`}
                      >
                        {pendingOtCount}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bộ lọc tháng cho Quản lý tổ chức (khi xem Timesheet hoặc Log) */}
              {(orgSubTab === 'timesheet' || orgSubTab === 'log') && (
                <div className="flex items-center gap-2">
                  <CustomFilterSelect
                    value={orgSelectedMonth}
                    options={monthOptions}
                    onChange={setOrgSelectedMonth}
                    ariaLabel={t('hrm:attendancePage.monthFilter.ariaLabel')}
                    className="min-w-[140px]"
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {orgSubTab === 'adjustments' ? (
              <PendingAdjustmentsList
                adjustments={pendingAdjustmentsWithName}
                onApprove={handleApproveAdjustment}
                onReject={handleRejectAdjustment}
              />
            ) : orgSubTab === 'overtime' ? (
              <PendingOvertimeList
                overtimeList={pendingOvertimeWithName}
                onApprove={handleApproveOt}
                onReject={handleRejectOt}
              />
            ) : (
              <QueryState
                isLoading={allAttendanceQuery.isLoading || departmentsQuery.isLoading}
                isError={allAttendanceQuery.isError}
                onRetry={() => {
                  allAttendanceQuery.refetch();
                  departmentsQuery.refetch();
                }}
                loadingFallback={<FullPageSpinner label={t('hrm:attendancePage.allAttendance.loading')} />}
                errorTitle={t('hrm:attendancePage.allAttendance.errorTitle')}
                errorDescription={t('hrm:attendancePage.allAttendance.errorDescription')}
              >
                {orgSubTab === 'timesheet' ? (
                  <MonthlyTimesheetTable
                    records={filteredAllRecords}
                    users={orgUsers}
                    departments={departmentsQuery.data ?? []}
                    selectedMonth={orgSelectedMonth}
                    today={today}
                    approvedOvertime={approvedOvertimeQuery.data ?? []}
                  />
                ) : filteredAllRecords.length === 0 ? (
                  <EmptyState
                    title={t('hrm:attendancePage.allAttendance.emptyTitle')}
                    description={orgSelectedMonth !== 'all' ? t('hrm:attendancePage.allAttendance.emptyFilteredDescription', { month: monthOptions.find((m) => m.value === orgSelectedMonth)?.label }) : t('hrm:attendancePage.allAttendance.emptyDescription')}
                  />
                ) : (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-[13px]">
                      <thead className="sticky top-0 bg-bg-subtle z-10 border-b border-border-subtle">
                        <tr className="text-left text-[12px] font-medium text-text-tertiary">
                          <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.employee')}</th>
                          <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.date')}</th>
                          <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.checkIn')}</th>
                          <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.checkOut')}</th>
                          <th className="py-2.5 px-3 bg-bg-subtle text-right">{t('hrm:attendancePage.allAttendance.columns.totalHours')}</th>
                          <th className="py-2.5 px-3 bg-bg-subtle">{t('hrm:attendancePage.allAttendance.columns.status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {filteredAllRecords.map((record) => {
                          const name = userNameMap[record.userId] ?? record.userId;
                          return (
                            <tr
                              key={record.id}
                              onClick={() => navigate(`/attendance/${record.userId}`)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') navigate(`/attendance/${record.userId}`);
                              }}
                              className="cursor-pointer hover:bg-bg-subtle transition-colors"
                            >
                              <td className="py-2.5 px-3 text-text-primary font-medium whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <Avatar name={name} size="sm" className="h-6 w-6 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] font-semibold" />
                                  <span className="truncate max-w-[160px]">{name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-text-primary font-mono text-[13px] whitespace-nowrap">{formatDate(record.workDate)}</td>
                              <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">{formatTime(record.checkInAt)}</span>
                                  <OnSiteBadge isOnSite={record.checkInIsOnSite} />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingPhoto({
                                        id: record.id,
                                        kind: 'checkin',
                                        time: formatDateTime(record.checkInAt),
                                        userName: name,
                                        isOnSite: record.checkInIsOnSite,
                                      });
                                    }}
                                    className="inline-flex items-center justify-center h-6 w-6 rounded-radius-sm bg-bg-subtle text-text-tertiary hover:bg-canvas hover:text-text-primary transition-colors cursor-pointer"
                                    title={t('hrm:attendancePage.allAttendance.viewProofInOf', { name })}
                                    aria-label={t('hrm:attendancePage.allAttendance.viewProofInOf', { name })}
                                  >
                                    <CameraIcon className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                                {record.checkOutAt ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">{formatTime(record.checkOutAt)}</span>
                                    <OnSiteBadge isOnSite={record.checkOutIsOnSite} />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingPhoto({
                                          id: record.id,
                                          kind: 'checkout',
                                          time: formatDateTime(record.checkOutAt),
                                          userName: name,
                                          isOnSite: record.checkOutIsOnSite,
                                        });
                                      }}
                                      className="inline-flex items-center justify-center h-6 w-6 rounded-radius-sm bg-bg-subtle text-text-tertiary hover:bg-canvas hover:text-text-primary transition-colors cursor-pointer"
                                      title={t('hrm:attendancePage.allAttendance.viewProofOutOf', { name })}
                                      aria-label={t('hrm:attendancePage.allAttendance.viewProofOutOf', { name })}
                                    >
                                      <CameraIcon className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-text-tertiary italic font-normal">{t('hrm:attendancePage.today.notRecorded')}</span>
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
                                  isAdjusted={approvedAdjustmentAttendanceIds.has(record.id)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </QueryState>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal xác thực camera check-in / check-out */}
      <CheckInCamera
        open={cameraMode !== null}
        onClose={() => setCameraMode(null)}
        onConfirm={handleConfirmPhoto}
        isSubmitting={checkInMutation.isPending || checkOutMutation.isPending}
      />

      {/* Modal xem ảnh bằng chứng chấm công */}
      <PhotoProofModal
        target={viewingPhoto}
        onClose={() => setViewingPhoto(null)}
      />

      {/* Modal giải trình / sửa công */}
      <AttendanceAdjustmentModal
        record={adjustmentRecord}
        open={Boolean(adjustmentRecord)}
        onClose={() => setAdjustmentRecord(null)}
      />

      {/* Modal đăng ký làm thêm giờ (OT) */}
      <OvertimeRegistrationModal
        userId={currentUser?.id || ''}
        open={showOtModal}
        onClose={() => setShowOtModal(false)}
        leaveRequests={myLeaveRequestsQuery.data?.data ?? []}
      />
    </div>
  );
}
