import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { Button } from '@/components/ui/Button';
import {
  FolderKanbanIcon,
  FolderIcon,
  CalendarIcon,
  FileTextIcon,
  PrinterIcon,
  DownloadIcon,
  UploadIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@/components/ui/Icons';
import { DATE_RANGE_OPTIONS } from '@/types';
import type { DateRangeOption } from '@/types';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { canAccessAdminArea, canManageProjects, formatDate, formatShortDate, formatTime, getTodayGmt7DateString } from '@/lib/utils';
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

  // Tính toán dữ liệu xu hướng (Trend Chart) theo ngày:
  // Dashboard tự tính toán 100% dựa trên thời gian thực tế của công việc (createdAt / updatedAt từ validTasks).
  // Việc này giải quyết độ trễ làm mới (refresh lag) của TimescaleDB continuous aggregate (daily_task_summary / weekly_project_progress),
  // giúp các công việc vừa được tạo hoặc hoàn thành hôm nay xuất hiện NGAY LẬP TỨC trên cả 3 chế độ: 7 ngày, 30 ngày (tuần hiện tại) và Quý này (tháng hiện tại).
  // Khi chưa tải xong tasks, fallback về trendQuery.data từ backend.
  const dynamicTaskTrend = useMemo(() => {
    // Nếu chưa tải xong tasks thực tế từ API, dùng tạm trendQuery.data nếu có
    if (!allTasksQuery.data) {
      return trendQuery.data ?? [];
    }

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

    // Khởi tạo các mốc ngày trong khoảng thời gian để biểu đồ liền mạch (mỗi ngày 1 điểm cho tất cả các khoảng)
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      map[dStr] = { created: 0, completed: 0 };
    }

    // Đếm số công việc được tạo đúng ngày thực tế
    for (const t of validTasks) {
      const cDate = t.createdAt ? t.createdAt.slice(0, 10) : '';
      if (cDate && cDate >= cutoffStr) {
        if (!map[cDate]) {
          map[cDate] = { created: 0, completed: 0 };
        }
        map[cDate].created++;
      }
    }

    // Đếm số công việc hoàn thành đúng ngày thực tế (dựa vào updatedAt lúc chuyển sang DONE)
    const doneTasks = validTasks.filter((t) => t.status === 'DONE');
    for (const t of doneTasks) {
      const uDate = t.updatedAt ? t.updatedAt.slice(0, 10) : (t.createdAt ? t.createdAt.slice(0, 10) : '');
      if (uDate && uDate >= cutoffStr) {
        if (!map[uDate]) {
          map[uDate] = { created: 0, completed: 0 };
        }
        map[uDate].completed++;
      }
    }

    const dates = Object.keys(map).sort();
    return dates.map((d) => ({ date: d, ...map[d] }));
  }, [allTasksQuery.data, validTasks, range, trendQuery.data]);

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
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-[#1E3A8A] leading-tight">
            {t('dashboard:page.title')}
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            {canViewAnalytics
              ? `Tổng quan hoạt động kinh doanh của tổ chức, cập nhật lúc ${formatTime(new Date().toISOString())} ngày ${formatDate(new Date().toISOString())}.`
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

          {/* Nút Xuất PDF và In: Outline #1E3A8A, chữ #1E3A8A, nền trắng */}
          {canViewAnalytics && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={isExportingPdf}
                onClick={handleExportPdf}
                title={t('dashboard:page.exportPdf')}
                className="border-[#1E3A8A] bg-white text-[#1E3A8A] hover:bg-[#EFF6FF] font-medium cursor-pointer active:scale-[0.98]"
              >
                <DownloadIcon className="h-4 w-4 mr-1.5 text-[#1E3A8A]" />
                <span>{t('dashboard:page.exportPdf')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                title={t('dashboard:page.print')}
                className="border-[#E5E7EB] bg-white hover:bg-slate-50 text-[#374151] font-medium cursor-pointer active:scale-[0.98]"
              >
                <PrinterIcon className="h-4 w-4 text-[#6B7280] mr-1.5" />
                <span>{t('dashboard:page.print')}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {showOnboarding && (
        <Card className="flex flex-col items-start gap-3 border-[#E5E7EB] bg-[#EFF6FF]/60 p-5 sm:flex-row sm:items-center sm:justify-between no-print">
          <div>
            <p className="text-sm font-semibold text-[#1E3A8A]">{t('dashboard:onboarding.welcomeTitle')}</p>
            <p className="mt-1 text-sm text-[#6B7280]">
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
                <Button className="bg-[#1E3A8A] hover:bg-[#1a3275] text-white">{t('dashboard:onboarding.createFirstProject')}</Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* 1. THANH TRẠNG THÁI KPI NẰM NGANG DUY NHẤT (STATUS BAR)
          - Phần A (chiếm 1/3): Thẻ "Tiến độ công việc" (col-span-1)
          - Phần B (chiếm 2/3): 3 khối nhỏ (col-span-2) dùng grid grid-cols-3 divide-x divide-[#E5E7EB]
          - Nền trắng, viền 1px #E5E7EB, bo góc 12px, padding 20px, KHÔNG đổ bóng */}
      <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#1E3A8A]">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-0">
          {/* PHẦN A (1/3 chiều rộng, col-span-1): Thẻ "Tiến độ công việc" */}
          <Link
            to="/projects"
            className="group col-span-1 flex flex-col justify-between lg:pr-6"
          >
            <div>
              {/* Tiêu đề thẻ: Sentence case "Tiến độ công việc", Lora 600, 14-15px, #374151 */}
              <span className="font-heading text-[15px] font-semibold text-[#374151]">
                {canViewAnalytics ? 'Tiến độ công việc' : 'Tiến độ cá nhân'}
              </span>

              {/* Số lớn: Roboto 700, 32px, #1E3A8A */}
              <div className="mt-1">
                <span className="font-sans text-[32px] font-bold text-[#1E3A8A] leading-tight">
                  {completionRate}%
                </span>
              </div>

              {/* Dòng phụ: size 13px, #6B7280 */}
              <p className="mt-1 text-[13px] text-[#6B7280]">
                {totalTasksCompleted}/{totalTasksCreated} công việc đã hoàn thành
              </p>

              {/* Thanh progress bar: nền #E5E7EB, fill #10B981, cao 8px, bo góc 999px */}
              <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                <div
                  className="h-full rounded-full bg-[#10B981] transition-all duration-300"
                  style={{ width: `${Math.max(2, Math.min(100, completionRate))}%` }}
                />
              </div>
            </div>

            {/* 3 sub-metrics nằm ngang, mỗi cái có chấm tròn màu + text */}
            <div className="mt-4 pt-3.5 border-t border-[#E5E7EB] flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-[#374151]">
                <span className="h-2 w-2 rounded-full bg-[#10B981] shrink-0" />
                <span>Đã xong: <strong className="font-medium">{totalTasksCompleted}</strong></span>
              </span>
              <span className="flex items-center gap-1.5 text-[#374151]">
                <span className="h-2 w-2 rounded-full bg-[#3B82F6] shrink-0" />
                <span>Đang làm: <strong className="font-medium">{validTasks.filter((t) => t.status === 'DOING').length}</strong></span>
              </span>
              <span className="flex items-center gap-1.5 text-[#374151]">
                <span className="h-2 w-2 rounded-full bg-[#9CA3AF] shrink-0" />
                <span>Cần làm: <strong className="font-medium">{validTasks.filter((t) => t.status === 'TODO').length}</strong></span>
              </span>
            </div>
          </Link>

          {/* PHẦN B (2/3 chiều rộng, col-span-2): 3 khối nhỏ nằm ngang dùng grid grid-cols-3 divide-x divide-[#E5E7EB] */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB] lg:border-l lg:border-[#E5E7EB]">
            {/* Khối 1: "Dự án đang chạy" */}
            <Link
              to="/projects?status=active"
              className="group flex flex-col justify-between py-4 sm:py-0 sm:px-5 first:sm:pl-6"
            >
              <div>
                {/* Icon: Folder trong ô vuông nền nhạt #EFF6FF 40x40px, bo góc 8px, icon #1E3A8A */}
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#EFF6FF] text-[#1E3A8A] shrink-0">
                  <FolderIcon className="h-5 w-5" />
                </div>

                {/* Số lớn: Roboto 700, size 24px, màu #374151 */}
                <div className="mt-3 mb-1">
                  <span className="font-sans text-[24px] font-bold text-[#374151] leading-none">
                    {activeProjectsCount}
                  </span>
                </div>
              </div>

              {/* Text mô tả: size 12px, #6B7280 */}
              <p className="mt-2 text-[12px] leading-relaxed text-[#6B7280]">
                Dự án đang trong trạng thái hoạt động, cần theo dõi tiến độ.
              </p>
            </Link>

            {/* Khối 2: "Đơn nghỉ chờ duyệt" */}
            <Link
              to={canApproveLeave ? '/leave-requests?status=pending' : '/attendance'}
              className="group flex flex-col justify-between py-4 sm:py-0 sm:px-5"
            >
              <div>
                {/* Icon: FileText trong ô vuông nền nhạt #FEF3C7 40x40px, bo góc 8px, icon #F59E0B */}
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#FEF3C7] text-[#F59E0B] shrink-0">
                  <FileTextIcon className="h-5 w-5" />
                </div>

                {/* Số lớn: Roboto 700, size 24px, màu #374151 */}
                <div className="mt-3 mb-1">
                  <span className="font-sans text-[24px] font-bold text-[#374151] leading-none">
                    {canApproveLeave ? pendingLeavesCount : monthlyWorkDaysCount}
                  </span>
                </div>
              </div>

              {/* Badge inline đặt dưới số "1", cạnh text mô tả */}
              <div className="mt-2 flex items-start gap-1.5">
                {canApproveLeave && pendingLeavesCount > 0 && (
                  <span className="inline-flex shrink-0 items-center rounded bg-[#F59E0B] px-1.5 py-0.5 text-[10px] font-medium text-white shadow-2xs">
                    Chờ duyệt
                  </span>
                )}
                <p className="text-[12px] leading-relaxed text-[#6B7280]">
                  {canApproveLeave ? 'Đơn xin nghỉ phép đang chờ quản lý phê duyệt.' : 'Số ngày công ghi nhận tháng này'}
                </p>
              </div>
            </Link>

            {/* Khối 3: "Tài liệu mới (7 ngày)" */}
            <Link
              to="/documents"
              className="group flex flex-col justify-between py-4 sm:py-0 sm:px-5 last:sm:pr-0"
            >
              <div>
                {/* Icon: Upload trong ô vuông nền nhạt #D1FAE5 40x40px, bo góc 8px, icon #10B981 */}
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#D1FAE5] text-[#10B981] shrink-0">
                  <UploadIcon className="h-5 w-5" />
                </div>

                {/* Số lớn: Roboto 700, size 24px, màu #374151 */}
                <div className="mt-3 mb-1">
                  <span className="font-sans text-[24px] font-bold text-[#374151] leading-none">
                    {newDocumentsCount}
                  </span>
                </div>
              </div>

              {/* Text mô tả: size 12px, #6B7280 */}
              <p className="mt-2 text-[12px] leading-relaxed text-[#6B7280]">
                Tài liệu được tải lên trong 7 ngày gần nhất.
              </p>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. BẢO TOÀN VÀ ĐIỀU CHỈNH 2 BIỂU ĐỒ (LINE & DONUT):
          - Chuẩn Grid 12 (8 cols cho Line Trend và 4 cols cho Donut Snapshot)
          - Bộ lọc thời gian (7 ngày qua / 30 ngày) giữ làm local filter trong Header Biểu đồ đường */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{t('dashboard:charts.taskTrendTitle')}</CardTitle>
              {/* Dấu chấm nhỏ (dot) màu #10B981 nhấp nháy nhẹ (pulse animation 2s) */}
              <span className="relative flex h-2 w-2" title="Dữ liệu thời gian thực">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75 [animation-duration:2s]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
              </span>
            </div>
            {/* Bộ lọc thời gian cục bộ (Local filter) */}
            <div className="flex items-center gap-2">
              <CustomFilterSelect
                id="dashboard-date-range-filter"
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
              range={range}
              filterSelectId="dashboard-date-range-filter"
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
