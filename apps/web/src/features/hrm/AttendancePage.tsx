import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useAuthStore } from '@/stores/auth.store';
import { CheckInCamera } from './components/CheckInCamera';
import type { CheckInLocation } from './components/CheckInCamera';
import { AttendanceAdjustmentModal } from './components/AttendanceAdjustmentModal';
import { OvertimeRegistrationModal } from './components/OvertimeRegistrationModal';
import {
  OnSiteBadge,
  formatTotalHours,
  PhotoProofModal,
  AttendanceStatusBadge,
  getTodayGmt7,
  type ViewingPhotoTarget,
} from './components/attendance-shared';
import { TodayAttendanceCard } from './components/TodayAttendanceCard';
import { PersonalAttendanceTable } from './components/PersonalAttendanceTable';
import { OrgAttendanceCard } from './components/OrgAttendanceCard';
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
export {
  OnSiteBadge,
  formatTotalHours,
  PhotoProofModal,
  AttendanceStatusBadge,
  getTodayGmt7,
};

/** Trang Cham cong (HRM-lite) - Technical_Spec.md muc 17, Wireframe.md muc 13. */
export function AttendancePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cameraMode, setCameraMode] = useState<'checkin' | 'checkout' | null>(null);
  const [orgSubTab, setOrgSubTab] = useState<'timesheet' | 'log' | 'adjustments' | 'overtime'>('timesheet');

  // Modal states for extensions
  const [viewingPhoto, setViewingPhoto] = useState<ViewingPhotoTarget | null>(null);
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

  const handleNavigateUser = useCallback(
    (userId: string) => navigate(`/attendance/${userId}`),
    [navigate],
  );

  const handleRetryAllAttendance = useCallback(() => {
    allAttendanceQuery.refetch();
    departmentsQuery.refetch();
  }, [allAttendanceQuery, departmentsQuery]);

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
          <TodayAttendanceCard
            today={today}
            todayRecord={effectiveTodayRecord}
            onOpenCheckIn={() => setCameraMode('checkin')}
            onOpenCheckOut={() => setCameraMode('checkout')}
          />
        </div>

        {/* Khối bên phải: Card B - Lịch sử chấm công */}
        <div className="w-full lg:col-span-7 flex flex-col">
          <PersonalAttendanceTable
            records={filteredMyRecords}
            selectedMonth={selectedMonth}
            monthOptions={monthOptions}
            onMonthChange={setSelectedMonth}
            isLoading={attendanceQuery.isLoading}
            isError={attendanceQuery.isError}
            onRetry={() => attendanceQuery.refetch()}
            today={today}
            approvedAdjustmentAttendanceIds={approvedAdjustmentAttendanceIds}
            onOpenOtModal={() => setShowOtModal(true)}
            onViewPhoto={setViewingPhoto}
            onRequestAdjustment={setAdjustmentRecord}
          />
        </div>
      </div>

      {/* Khối bên dưới: Card "Quản lý tổ chức" toàn màn hình (chỉ hiển thị cho Manager / Admin) */}
      {canViewOrgCard && (
        <OrgAttendanceCard
          canViewAll={canViewAll}
          canViewAdjustments={canViewAdjustments}
          canViewOvertime={canViewOvertime}
          orgSubTab={orgSubTab}
          setOrgSubTab={setOrgSubTab}
          pendingAdjustmentsCount={pendingAdjustmentsCount}
          pendingOtCount={pendingOtCount}
          orgSelectedMonth={orgSelectedMonth}
          setOrgSelectedMonth={setOrgSelectedMonth}
          monthOptions={monthOptions}
          pendingAdjustmentsWithName={pendingAdjustmentsWithName}
          pendingOvertimeWithName={pendingOvertimeWithName}
          onApproveAdjustment={handleApproveAdjustment}
          onRejectAdjustment={handleRejectAdjustment}
          onApproveOt={handleApproveOt}
          onRejectOt={handleRejectOt}
          isAllAttendanceLoading={allAttendanceQuery.isLoading}
          isAllAttendanceError={allAttendanceQuery.isError}
          isDepartmentsLoading={departmentsQuery.isLoading}
          onRetryAllAttendance={handleRetryAllAttendance}
          filteredAllRecords={filteredAllRecords}
          orgUsers={orgUsers}
          departments={departmentsQuery.data ?? []}
          today={today}
          approvedOvertime={approvedOvertimeQuery.data ?? []}
          userNameMap={userNameMap}
          approvedAdjustmentAttendanceIds={approvedAdjustmentAttendanceIds}
          onNavigateUser={handleNavigateUser}
          onViewPhoto={setViewingPhoto}
        />
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
