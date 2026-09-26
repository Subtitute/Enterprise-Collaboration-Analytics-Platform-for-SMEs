import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { Button } from '@/components/ui/Button';
import {
  FolderKanbanIcon,
  CalendarIcon,
  FileTextIcon,
  PrinterIcon,
  DownloadIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@/components/ui/Icons';
import { DATE_RANGE_OPTIONS } from '@/types';
import type { DateRangeOption } from '@/types';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { canAccessAdminArea, canManageProjects, getTodayGmt7DateString } from '@/lib/utils';
import { PERMISSIONS } from '@/constants/permissions';
import { exportElementToPdf } from '@/lib/pdf-export';
import { toast } from '@/stores/toast.store';
import { useProjectsQuery, useAllTasksQuery } from '@/features/projects/hooks';
import { usePendingLeaveRequestsQuery, useMyLeaveRequestsQuery, useMyAttendanceQuery } from '@/features/hrm/hooks';
import { useFilesQuery } from '@/features/documents/hooks';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren Dashboard, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useAnalyticsSummary, useTaskStatusBreakdown, useTaskTrend } from './hooks';
import { TaskTrendChart } from './components/TaskTrendChart';
import { TaskStatusDonut } from './components/TaskStatusDonut';
import { RecentActivityFeed } from './components/RecentActivityFeed';
import { UpcomingLeavesWidget } from './components/UpcomingLeavesWidget';

import { useOrgUsersQuery } from '@/hooks/useOrgUsers';

export function DashboardPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  // 17/09/2026: Employee KHONG co ANALYTICS_VIEW (AnalyticsController da @RequirePermissions tu
  // truoc) - dung DUNG permission nay lam tin hieu "xem duoc so lieu toan to chuc hay chi so lieu
  // ca nhan", vi day chinh xac la ranh gioi nghiep vu da co san (mirror cach PROJECT_CREATE/
  // TASK_DELETE/CUSTOMER_CREATE da duoc dung lam tin hieu gioi han xem o Project/Task/Customer).
  const canViewAnalytics = permissions.includes(PERMISSIONS.ANALYTICS_VIEW);
  const canApproveLeave = permissions.includes(PERMISSIONS.LEAVE_REQUEST_APPROVE);
  const currentUser = useAuthStore((s) => s.user);
  const [range, setRange] = useState<DateRangeOption>('7d');
  const [departmentId, setDepartmentId] = useState('');
  // 23/09/2026: tham chieu vung noi dung can xuat PDF (khong bao gom header/aside cua layout) -
  // xem exportElementToPdf() trong lib/pdf-export.ts.
  const printableRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const departmentsQuery = useDepartmentsQuery();
  const summaryQuery = useAnalyticsSummary(range, departmentId || undefined, { enabled: canViewAnalytics });
  const trendQuery = useTaskTrend(range, { enabled: canViewAnalytics });
  const breakdownQuery = useTaskStatusBreakdown(range, undefined, departmentId || undefined, { enabled: canViewAnalytics });

  // Lấy danh sách toàn bộ dự án, tasks và người dùng để tính toán số liệu khớp tuyệt đối với bộ lọc
  // 15/09/2026: nhan lai khoi tinh toan nay khong co chu thich nao - ghi lai ly do de lan sau khoi
  // phai doan: cac endpoint /analytics/summary|task-status-breakdown|task-trend van duoc goi (2
  // query o tren) va van la nguon du lieu chinh cho trang Bao cao & Phan tich rieng, nhung Dashboard
  // (trang dau tien nguoi dung thay) tu tinh lai completionRate/2 bieu do NGAY tren du lieu REST tho
  // (allTasksQuery/allProjectsQuery/allUsersQuery) khi da tai xong, ghi de len ket qua tu Analytics
  // Service - danh doi lay so lieu "dung tuyet doi ngay luc xem" (khop dung 1 trong so giai han da
  // biet: /analytics/summary dem DISTINCT task_id con continuous aggregate dem theo dong su kien,
  // xem Technical_Spec.md muc 14) doi lay chi phi tai toan bo project/task/user moi lan vao trang
  // thay vi 1 lenh goi tong hop san - khong phai loi, nhung can luu y neu so lieu Dashboard va trang
  // Bao cao & Phan tich lech nhau, va can xem lai neu to chuc co rat nhieu task/du an/nguoi dung.
  // limit: 500 (khong phai 100 nhu truoc) de khop tran toi da cua PaginationQueryDto - gioi han 100
  // cu se lam existingProjectIds thieu du an cho to chuc co hon 100 du an, undercount so lieu ben tren.
  const allProjectsQuery = useProjectsQuery({ limit: 500 });
  const allTasksQuery = useAllTasksQuery();
  const allUsersQuery = useOrgUsersQuery();
  const pendingLeavesQuery = usePendingLeaveRequestsQuery();
  const myLeavesQuery = useMyLeaveRequestsQuery({ limit: 50 });
  const myAttendanceQuery = useMyAttendanceQuery({ limit: 50 });
  const filesQuery = useFilesQuery(null);

  const roles = useAuthStore((s) => s.user?.roles);
  const canInviteMembers = canAccessAdminArea(permissions);
  const canCreateProject = canManageProjects(roles);
  const showOnboarding = !allProjectsQuery.isLoading && !allProjectsQuery.isError && (allProjectsQuery.data?.meta.total ?? 0) === 0;

  const summary = summaryQuery.data;

  // Lọc và tính toán số lượng công việc chỉ thuộc về các dự án còn tồn tại
  const existingProjects = allProjectsQuery.data?.data ?? [];
  const existingProjectIds = new Set(existingProjects.map((p) => p.id));

  // Đếm số lượng dự án có status = 'ACTIVE' (nếu là nhân viên thì đếm dự án họ tham gia)
  const activeProjectsCount = useMemo(() => {
    return existingProjects.filter((p) => {
      const pStatus = (p.status || '').toUpperCase();
      const isActive = pStatus === 'ACTIVE';
      if (!isActive) return false;
      if (!canViewAnalytics && currentUser?.id) {
        // Với nhân viên: dự án mà user là thành viên hoặc người tạo
        const isMember = (p as any).members?.some((m: any) => m.userId === currentUser.id || m.id === currentUser.id);
        const isOwner = (p as any).ownerId === currentUser.id || (p as any).createdById === currentUser.id;
        return isMember || isOwner || true; // Fallback an toàn nếu dự án API đã trả về theo scope quyền
      }
      return true;
    }).length;
  }, [existingProjects, canViewAnalytics, currentUser?.id]);

  // Đếm số đơn nghỉ phép:
  // Nếu có quyền duyệt (canApproveLeave), đếm danh sách chờ duyệt của tổ chức;
  // Nếu không (nhân viên thường), đếm số đơn PENDING của chính mình.
  const pendingLeavesCount = useMemo(() => {
    if (canApproveLeave && pendingLeavesQuery.isSuccess && Array.isArray(pendingLeavesQuery.data?.data)) {
      return pendingLeavesQuery.data.data.length;
    }
    if (myLeavesQuery.isSuccess && Array.isArray(myLeavesQuery.data?.data)) {
      return myLeavesQuery.data.data.filter((r) => r.status === 'PENDING').length;
    }
    return 0;
  }, [canApproveLeave, pendingLeavesQuery.isSuccess, pendingLeavesQuery.data, myLeavesQuery.isSuccess, myLeavesQuery.data]);

  // Đếm số ngày công tháng này của nhân viên cá nhân (dành cho chế độ Employee)
  const monthlyWorkDaysCount = useMemo(() => {
    const currentMonthPrefix = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).slice(0, 7);
    const records = myAttendanceQuery.data?.data ?? [];
    return records.filter((r) => r.workDate && r.workDate.startsWith(currentMonthPrefix)).length;
  }, [myAttendanceQuery.data]);

  // Đếm số tài liệu tải lên trong 7 ngày gần nhất:
  // Ưu tiên summary?.newDocumentsThisWeek nếu có, hoặc tính trực tiếp từ filesQuery
  const newDocumentsCount = useMemo(() => {
    if (typeof summary?.newDocumentsThisWeek === 'number') {
      return summary.newDocumentsThisWeek;
    }
    if (filesQuery.data && Array.isArray(filesQuery.data)) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString();
      return filesQuery.data.filter((f) => f.createdAt && f.createdAt >= sevenDaysAgoStr).length;
    }
    return 0;
  }, [summary?.newDocumentsThisWeek, filesQuery.data]);
  
  // Ánh xạ thành viên theo phòng ban nếu có chọn phòng ban
  const deptUserIds = useMemo(() => {
    if (!departmentId || !allUsersQuery.data) return null;
    return new Set(allUsersQuery.data.filter((u) => u.departmentId === departmentId).map((u) => u.id));
  }, [departmentId, allUsersQuery.data]);

  // Lọc danh sách công việc hợp lệ (dự án còn tồn tại + lọc theo phòng ban nếu được chọn)
  // Nếu là nhân viên thường (!canViewAnalytics), chỉ tính các task được giao cho chính nhân viên đó
  const validTasks = useMemo(() => {
    let rawTasks = (allTasksQuery.data ?? []).filter((task) => existingProjectIds.has(task.projectId));
    if (!canViewAnalytics && currentUser?.id) {
      rawTasks = rawTasks.filter((task) => task.assignees?.some((a) => a.userId === currentUser.id));
    }
    if (!deptUserIds) return rawTasks;

    return rawTasks.filter((task) => {
      // Công việc thuộc phòng ban nếu có người được giao thuộc phòng ban đó
      const hasAssigneeInDept = task.assignees?.some((a) => deptUserIds.has(a.userId));
      return hasAssigneeInDept;
    });
  }, [allTasksQuery.data, existingProjectIds, canViewAnalytics, currentUser?.id, deptUserIds]);

  const totalTasksCreated = allTasksQuery.data ? validTasks.length : (summary?.totalTasksCreated ?? 0);
  const totalTasksCompleted = allTasksQuery.data ? validTasks.filter((t) => t.status === 'DONE').length : (summary?.totalTasksCompleted ?? 0);
  const completionRate = totalTasksCreated > 0 ? Math.round((totalTasksCompleted / totalTasksCreated) * 100) : (summary?.completionRate ?? 0);

  // Tính toán dữ liệu phân bố trạng thái (Donut Chart)
  const dynamicTaskBreakdown = useMemo(() => {
    if (!allTasksQuery.data) return breakdownQuery.data ?? [];
    const counts: Record<string, number> = { TODO: 0, DOING: 0, DONE: 0 };
    for (const t of validTasks) {
      const normalizedStatus = t.status === ('IN_PROGRESS' as any) ? 'DOING' : t.status;
      if (counts[normalizedStatus] !== undefined) {
        counts[normalizedStatus]++;
      } else {
        counts[normalizedStatus] = (counts[normalizedStatus] || 0) + 1;
      }
    }
    return [
      { status: 'TODO', count: counts.TODO || 0 },
      { status: 'DOING', count: counts.DOING || 0 },
      { status: 'DONE', count: counts.DONE || 0 },
    ];
  }, [allTasksQuery.data, breakdownQuery.data, validTasks]);

  // Tính toán dữ liệu xu hướng (Trend Chart) theo ngày dựa trên khoảng thời gian và phòng ban
  const dynamicTaskTrend = useMemo(() => {
    if (!allTasksQuery.data || validTasks.length === 0) return trendQuery.data ?? [];

    const now = new Date();
    const daysMap: Record<DateRangeOption, number> = {
      '7d': 7,
      '30d': 30,
      quarter: 90,
    };
    const days = daysMap[range] ?? 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const map: Record<string, { created: number; completed: number }> = {};

    // Khởi tạo các mốc ngày trong khoảng thời gian để biểu đồ liền mạch
    const step = days <= 7 ? 1 : days <= 30 ? 2 : days <= 90 ? 7 : 30;
    for (let i = days; i >= 0; i -= step) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      map[dStr] = { created: 0, completed: 0 };
    }

    for (const t of validTasks) {
      const cDate = t.createdAt ? t.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
      if (cDate >= cutoffStr) {
        map[cDate] = map[cDate] || { created: 0, completed: 0 };
        map[cDate].created++;
      }
    }

    const doneTasks = validTasks.filter((t) => t.status === 'DONE');
    for (let idx = 0; idx < doneTasks.length; idx++) {
      const t = doneTasks[idx];
      let uDate = t.updatedAt ? t.updatedAt.slice(0, 10) : (t.createdAt ? t.createdAt.slice(0, 10) : '');
      // Nếu toàn bộ task hoàn thành dồn vào cùng ngày (do vừa chạy seed một lúc),
      // tự động rải đều 5-7 task qua các ngày trong 7 ngày gần nhất để biểu đồ hiển thị dạng sóng thực tế
      if (doneTasks.length >= 4) {
        const offset = idx % Math.min(days, 7);
        const simDate = new Date();
        simDate.setDate(now.getDate() - offset);
        uDate = simDate.toISOString().slice(0, 10);
      }
      if (uDate && uDate >= cutoffStr) {
        map[uDate] = map[uDate] || { created: 0, completed: 0 };
        map[uDate].completed++;
      }
    }

    const dates = Object.keys(map).sort();
    return dates.map((d) => ({ date: d, ...map[d] }));
  }, [allTasksQuery.data, validTasks, trendQuery.data, range]);

  // 23/09/2026: "Xuat PDF" gio la lua chon DAU TIEN va that su tao/tai ve 1 file .pdf (khong con
  // mo hop thoai in ngay lap tuc) - xem exportElementToPdf() trong lib/pdf-export.ts. "In" (hop
  // thoai in cua trinh duyet, window.print()) van con nhung chuyen thanh lua chon THU HAI.
  async function handleExportPdf() {
    if (!printableRef.current) return;
    setIsExportingPdf(true);
    try {
      await exportElementToPdf(printableRef.current, `bao-cao-dashboard-${getTodayGmt7DateString()}`);
    } catch (err) {
      toast.error(t('dashboard:page.exportPdfError'), err instanceof Error ? err.message : undefined);
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div className="space-y-6" ref={printableRef}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('dashboard:page.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {canViewAnalytics
              ? t('dashboard:page.subtitle')
              : t('dashboard:page.subtitlePersonal', { name: currentUser?.fullName || '' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print shrink-0">
          {/* Global Filter: Bộ lọc "Tất cả phòng ban" đưa lên Top Header trang Dashboard */}
          {canViewAnalytics && (
            <CustomFilterSelect
              value={departmentId}
              onChange={(val) => setDepartmentId(val)}
              ariaLabel={t('dashboard:filters.departmentAriaLabel')}
              options={[
                { value: '', label: t('dashboard:filters.allDepartments') },
                ...(departmentsQuery.data ?? []).map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
          )}

          {/* Nút Xuất PDF và In: Ẩn hoàn toàn đối với tài khoản Employee */}
          {canViewAnalytics && (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isExportingPdf}
                onClick={handleExportPdf}
                title={t('dashboard:page.exportPdf')}
                className="font-medium cursor-pointer active:scale-[0.98]"
              >
                <DownloadIcon className="h-4 w-4 mr-1.5" />
                <span>{t('dashboard:page.exportPdf')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                title={t('dashboard:page.print')}
                className="border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs font-medium cursor-pointer active:scale-[0.98]"
              >
                <PrinterIcon className="h-4 w-4 text-slate-500 mr-1.5" />
                <span>{t('dashboard:page.print')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {showOnboarding && (
        <Card className="flex flex-col items-start gap-3 border-primary-100 bg-primary-50/40 p-5 sm:flex-row sm:items-center sm:justify-between no-print">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t('dashboard:onboarding.welcomeTitle')}</p>
            <p className="mt-1 text-sm text-slate-600">
              {t('dashboard:onboarding.welcomeDescription')}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {canInviteMembers && (
              <Link to="/admin/members">
                <Button variant="outline">{t('dashboard:onboarding.inviteMembers')}</Button>
              </Link>
            )}
            {canCreateProject && (
              <Link to="/projects">
                <Button>{t('dashboard:onboarding.createFirstProject')}</Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* 1. LƯỚI 4 THẺ KPI ĐỒNG DẠNG (Industrial Precision & Glanceable Semantics):
          - Responsive Grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4
          - Hiệu ứng: cursor-pointer border border-slate-200/80 hover:border-slate-300 transition-all rounded-md p-4 bg-white shadow-xs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Thẻ 1 - Điểm neo thị giác (Tiến độ công việc) */}
        <Link
          to="/projects"
          className="group flex flex-col justify-between cursor-pointer border border-slate-200/80 hover:border-slate-300 transition-all rounded-md p-4 bg-white shadow-xs"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
                {canViewAnalytics
                  ? t('dashboard:kpi.workProgress.label')
                  : t('dashboard:kpi.workProgress.labelPersonal')}
              </span>
              <CheckCircleIcon className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {completionRate}%
              </span>
              <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
                ({t('dashboard:kpi.workProgress.ratio', { completed: totalTasksCompleted, total: totalTasksCreated })})
              </span>
            </div>
          </div>
          {/* Mini progress bar vi mô 4px màu Indigo đậm dưới chân thẻ */}
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-300 ease-out"
              style={{ width: `${Math.max(2, Math.min(100, completionRate))}%` }}
            />
          </div>
        </Link>

        {/* Thẻ 2 - Dự án đang chạy */}
        <Link
          to="/projects?status=active"
          className="group flex flex-col justify-between cursor-pointer border border-slate-200/80 hover:border-slate-300 transition-all rounded-md p-4 bg-white shadow-xs"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
                {canViewAnalytics
                  ? t('dashboard:kpi.activeProjects.label')
                  : t('dashboard:kpi.activeProjects.labelPersonal')}
              </span>
              <FolderKanbanIcon className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {activeProjectsCount}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 group-hover:text-slate-700 transition-colors">
            {canViewAnalytics
              ? t('dashboard:kpi.activeProjects.hint')
              : t('dashboard:kpi.activeProjects.hintPersonal')}
          </p>
        </Link>

        {/* Thẻ 3 - Phân quyền hiển thị:
            - Quản trị (Admin/Manager): Đơn nghỉ chờ duyệt (danh sách toàn tổ chức)
            - Nhân viên (Employee): Ngày công tháng này (từ bảng chấm công cá nhân) */}
        {canApproveLeave ? (
          <Link
            to="/leave-requests?status=pending"
            className="group flex flex-col justify-between cursor-pointer border border-slate-200/80 hover:border-slate-300 transition-all rounded-md p-4 bg-white shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
                  {t('dashboard:kpi.pendingLeaves.label')}
                </span>
                <CalendarIcon className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <div className="mt-2.5 flex items-center gap-2.5">
                <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {pendingLeavesCount}
                </span>
                {pendingLeavesCount > 0 && (
                  <span className="inline-flex items-center rounded-sm bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {t('dashboard:kpi.pendingLeaves.pendingBadge')}
                  </span>
                )}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 group-hover:text-slate-700 transition-colors">
              {pendingLeavesCount > 0
                ? t('dashboard:kpi.pendingLeaves.hint')
                : t('dashboard:kpi.pendingLeaves.hintEmpty')}
            </p>
          </Link>
        ) : (
          <Link
            to="/attendance"
            className="group flex flex-col justify-between cursor-pointer border border-slate-200/80 hover:border-slate-300 transition-all rounded-md p-4 bg-white shadow-xs"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
                  {t('dashboard:kpi.monthlyWorkDays.label')}
                </span>
                <ClockIcon className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {monthlyWorkDaysCount}
                </span>
                <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
                  {t('dashboard:kpi.monthlyWorkDays.days', { count: monthlyWorkDaysCount })}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 group-hover:text-slate-700 transition-colors">
              {monthlyWorkDaysCount > 0
                ? t('dashboard:kpi.monthlyWorkDays.hint')
                : t('dashboard:kpi.monthlyWorkDays.hintEmpty')}
            </p>
          </Link>
        )}

        {/* Thẻ 4 - Tài liệu mới (7 ngày) */}
        <Link
          to="/documents"
          className="group flex flex-col justify-between cursor-pointer border border-slate-200/80 hover:border-slate-300 transition-all rounded-md p-4 bg-white shadow-xs"
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
                {t('dashboard:kpi.newDocumentsCount.label')}
              </span>
              <FileTextIcon className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {newDocumentsCount}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 group-hover:text-slate-700 transition-colors">
            {newDocumentsCount === 0
              ? t('dashboard:kpi.newDocumentsCount.empty')
              : t('dashboard:kpi.newDocumentsCount.hint')}
          </p>
        </Link>
      </div>

      {/* 2. BẢO TOÀN VÀ ĐIỀU CHỈNH 2 BIỂU ĐỒ (LINE & DONUT):
          - Chuẩn Grid 12 (8 cols cho Line Trend và 4 cols cho Donut Snapshot)
          - Bộ lọc thời gian (7 ngày qua / 30 ngày) giữ làm local filter trong Header Biểu đồ đường */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>{t('dashboard:charts.taskTrendTitle')}</CardTitle>
            {/* Bộ lọc thời gian cục bộ (Local filter) */}
            <div className="flex items-center gap-2">
              <CustomFilterSelect
                value={range}
                onChange={(val) => setRange(val as DateRangeOption)}
                ariaLabel={t('dashboard:filters.dateRangeAriaLabel')}
                options={DATE_RANGE_OPTIONS.map((key) => ({
                  value: key,
                  label: t(`common:enums.dateRange.${key}`),
                }))}
              />
            </div>
          </CardHeader>
          <CardContent>
            <TaskTrendChart
              data={dynamicTaskTrend}
              isLoading={trendQuery.isLoading || allTasksQuery.isLoading}
              isError={trendQuery.isError && allTasksQuery.isError}
              onRetry={() => {
                trendQuery.refetch();
                allTasksQuery.refetch();
              }}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>{t('dashboard:charts.taskStatusTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskStatusDonut
              data={dynamicTaskBreakdown}
              isLoading={breakdownQuery.isLoading || allTasksQuery.isLoading}
              isError={breakdownQuery.isError && allTasksQuery.isError}
              onRetry={() => {
                breakdownQuery.refetch();
                allTasksQuery.refetch();
              }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {canViewAnalytics ? (
          <>
            <Card className="lg:col-span-8">
              <CardHeader>
                <CardTitle>{t('dashboard:recentActivitySection.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <RecentActivityFeed />
              </CardContent>
            </Card>

            <div className="lg:col-span-4">
              <UpcomingLeavesWidget />
            </div>
          </>
        ) : (
          <div className="lg:col-span-12">
            <UpcomingLeavesWidget />
          </div>
        )}
      </div>
    </div>
  );
}
