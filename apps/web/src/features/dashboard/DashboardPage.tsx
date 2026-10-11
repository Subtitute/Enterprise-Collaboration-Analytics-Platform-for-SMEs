import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { Button } from '@/components/ui/Button';
import { PrinterIcon, DownloadIcon } from '@/components/ui/Icons';
import { DATE_RANGE_OPTIONS } from '@/types';
import type { DateRangeOption } from '@/types';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { canAccessAdminArea, canManageProjects, getTodayGmt7DateString } from '@/lib/utils';
import { PERMISSIONS } from '@/constants/permissions';
import { exportElementToPdf } from '@/lib/pdf-export';
import { toast } from '@/stores/toast.store';
import { useProjectsQuery, useAllTasksQuery } from '@/features/projects/hooks';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren Dashboard, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useAnalyticsSummary, useTaskStatusBreakdown, useTaskTrend } from './hooks';
import { KpiCard } from './components/KpiCard';
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

  const roles = useAuthStore((s) => s.user?.roles);
  const canInviteMembers = canAccessAdminArea(permissions);
  const canCreateProject = canManageProjects(roles);
  const showOnboarding = !allProjectsQuery.isLoading && !allProjectsQuery.isError && (allProjectsQuery.data?.meta.total ?? 0) === 0;

  const summary = summaryQuery.data;

  // Lọc và tính toán số lượng công việc chỉ thuộc về các dự án còn tồn tại
  const existingProjects = allProjectsQuery.data?.data ?? [];
  const existingProjectIds = new Set(existingProjects.map((p) => p.id));
  
  // Ánh xạ thành viên theo phòng ban nếu có chọn phòng ban
  const deptUserIds = useMemo(() => {
    if (!departmentId || !allUsersQuery.data) return null;
    return new Set(allUsersQuery.data.filter((u) => u.departmentId === departmentId).map((u) => u.id));
  }, [departmentId, allUsersQuery.data]);

  // Lọc danh sách công việc hợp lệ (dự án còn tồn tại + lọc theo phòng ban nếu được chọn)
  const validTasks = useMemo(() => {
    const rawTasks = (allTasksQuery.data ?? []).filter((task) => existingProjectIds.has(task.projectId));
    if (!deptUserIds) return rawTasks;

    return rawTasks.filter((task) => {
      // Công việc thuộc phòng ban nếu có người được giao thuộc phòng ban đó
      const hasAssigneeInDept = task.assignees?.some((a) => deptUserIds.has(a.userId));
      return hasAssigneeInDept;
    });
  }, [allTasksQuery.data, existingProjectIds, deptUserIds]);

  const totalTasksCreated = allTasksQuery.data ? validTasks.length : (summary?.totalTasksCreated ?? 0);
  const totalTasksCompleted = allTasksQuery.data ? validTasks.filter((t) => t.status === 'DONE').length : (summary?.totalTasksCompleted ?? 0);
  const completionRate = totalTasksCreated > 0 ? Math.round((totalTasksCompleted / totalTasksCreated) * 100) : (summary?.completionRate ?? 0);

  // 17/09/2026: 2 KPI ca nhan thay the cho "Tai lieu moi"/"Thanh vien hoat dong" (2 chi so cap to
  // chuc, khong phu hop voi Employee - xem nhanh render ben duoi). Tinh THANG tren validTasks (da
  // loc san chi con task cua chinh Employee do backend enforce - xem ProjectsService/TasksService
  // .getVisibleProjectIds(), khong phai loc them o day) - khong can goi API rieng.
  const todayGmt7 = getTodayGmt7DateString();
  const myInProgressCount = validTasks.filter((t) => t.status === 'DOING').length;
  const myOverdueCount = validTasks.filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate.slice(0, 10) < todayGmt7).length;

  // Tính biến động thực tế trong 7 ngày qua (dựa trên thời gian tạo/cập nhật thực tế của task & project)
  const sevenDaysAgoCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  // Số dự án mới tạo trong 7 ngày qua (Dữ liệu thực từ allProjectsQuery)
  const newProjectsLast7Days = useMemo(() => {
    return existingProjects.filter((p) => p.createdAt && p.createdAt >= sevenDaysAgoCutoff).length;
  }, [existingProjects, sevenDaysAgoCutoff]);

  // Số công việc hoàn thành trong 7 ngày qua (Dữ liệu thực từ validTasks)
  const completedTasksLast7Days = useMemo(() => {
    return validTasks.filter((t) => t.status === 'DONE' && ((t.updatedAt && t.updatedAt >= sevenDaysAgoCutoff) || (t.createdAt && t.createdAt >= sevenDaysAgoCutoff))).length;
  }, [validTasks, sevenDaysAgoCutoff]);

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
      if (t.status === 'DONE') {
        const uDate = t.updatedAt ? t.updatedAt.slice(0, 10) : cDate;
        if (uDate >= cutoffStr) {
          map[uDate] = map[uDate] || { created: 0, completed: 0 };
          map[uDate].completed++;
        }
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
    <div className="space-y-6">
      {/* 1. Page Header (KHÔNG nằm trong printableRef) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-[36px] font-semibold text-text-primary">
            {t('common:nav.homeNav.overview')}
          </h1>
          <p className="mt-1 text-[14px] leading-[22px] text-text-secondary">
            {t('dashboard:page.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => window.print()}
            title={t('dashboard:page.print', 'In')}
            className="h-9 px-3.5 text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-subtle border-none"
          >
            <PrinterIcon className="h-3.5 w-3.5 mr-1.5" />
            <span>{t('dashboard:page.print', 'In')}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={isExportingPdf}
            onClick={handleExportPdf}
            title={t('dashboard:page.exportPdf')}
            className="h-9 px-3.5 text-[13px] font-medium border-border-strong bg-white hover:bg-bg-subtle"
          >
            <DownloadIcon className="h-3.5 w-3.5 mr-1.5" />
            <span>{t('dashboard:page.exportPdf')}</span>
          </Button>
        </div>
      </div>

      {/* 2. Filter Bar (Hàng riêng dưới Header, căn TRÁI, KHÔNG nằm trong printableRef) */}
      <div className="flex flex-wrap items-center gap-2 my-5 no-print">
        <div className="w-[140px]">
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
        {canViewAnalytics && (
          <div className="w-[180px]">
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
          </div>
        )}
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

      {/* VÙNG CHỤP PDF: Chỉ bao gồm KPI Cards + Charts + Widgets */}
      <div ref={printableRef} className="space-y-6">
        {/* ROW 1: 4 THẺ KPI ĐỒNG KÍCH THƯỚC (GRID-COLS-4) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {canViewAnalytics ? (
            <>
              {/* KPI 1: DỰ ÁN ĐANG TRIỂN KHAI */}
              <KpiCard
                overline={t('dashboard:kpi.projects.label')}
                value={existingProjects.length}
                delta={
                  newProjectsLast7Days > 0
                    ? {
                        type: 'increase',
                        text: t('dashboard:kpi.projects.delta', { count: newProjectsLast7Days }),
                      }
                    : {
                        type: 'neutral',
                        text: t('dashboard:kpi.projects.noNew'),
                      }
                }
                isLoading={allProjectsQuery.isLoading}
                isError={allProjectsQuery.isError}
                onRetry={() => allProjectsQuery.refetch()}
              />
              {/* KPI 2: TỶ LỆ HOÀN THÀNH */}
              <KpiCard
                overline={t('dashboard:kpi.completionRate.label')}
                value={completionRate}
                unit="%"
                delta={
                  completedTasksLast7Days > 0
                    ? {
                        type: 'increase',
                        text: t('dashboard:kpi.completionRate.delta', { count: completedTasksLast7Days }),
                      }
                    : {
                        type: 'neutral',
                        text: t('dashboard:kpi.completionRate.noCompleted'),
                      }
                }
                isLoading={allTasksQuery.isLoading}
                isError={allTasksQuery.isError}
                onRetry={() => allTasksQuery.refetch()}
              />
              {/* KPI 3: CÔNG VIỆC QUÁ HẠN */}
              <KpiCard
                overline={t('dashboard:kpi.overdueTasks.label')}
                value={myOverdueCount}
                delta={
                  myOverdueCount > 0
                    ? {
                        type: 'decrease',
                        text: t('dashboard:kpi.overdueTasks.deltaAction', { count: myOverdueCount }),
                      }
                    : {
                        type: 'empty-good',
                        text: t('dashboard:kpi.overdueTasks.noOverdue'),
                      }
                }
                isLoading={allTasksQuery.isLoading}
                isError={allTasksQuery.isError}
                onRetry={() => allTasksQuery.refetch()}
              />
              {/* KPI 4: THÀNH VIÊN HOẠT ĐỘNG */}
              <KpiCard
                overline={t('dashboard:kpi.activeUsers.label')}
                value={`${summary?.activeUsersLast7Days ?? (allUsersQuery.data?.length || 0)}/${allUsersQuery.data?.length || summary?.activeUsersLast7Days || 0}`}
                delta={{
                  type: 'neutral',
                  text: t('dashboard:kpi.activeUsers.delta'),
                }}
                isLoading={summaryQuery.isLoading || allUsersQuery.isLoading}
                isError={summaryQuery.isError && allUsersQuery.isError}
                onRetry={() => {
                  summaryQuery.refetch();
                  allUsersQuery.refetch();
                }}
              />
            </>
          ) : (
            <>
              {/* Employee KPI 1: DỰ ÁN THAM GIA */}
              <KpiCard
                overline={t('dashboard:kpi.projects.personalLabel')}
                value={existingProjects.length}
                delta={
                  newProjectsLast7Days > 0
                    ? {
                        type: 'increase',
                        text: t('dashboard:kpi.projects.delta', { count: newProjectsLast7Days }),
                      }
                    : {
                        type: 'neutral',
                        text: t('dashboard:kpi.projects.noNew'),
                      }
                }
                isLoading={allProjectsQuery.isLoading}
                isError={allProjectsQuery.isError}
                onRetry={() => allProjectsQuery.refetch()}
              />
              {/* Employee KPI 2: TỶ LỆ HOÀN THÀNH */}
              <KpiCard
                overline={t('dashboard:kpi.completionRate.label')}
                value={completionRate}
                unit="%"
                delta={
                  completedTasksLast7Days > 0
                    ? {
                        type: 'increase',
                        text: t('dashboard:kpi.completionRate.delta', { count: completedTasksLast7Days }),
                      }
                    : {
                        type: 'neutral',
                        text: t('dashboard:kpi.completionRate.noCompleted'),
                      }
                }
                isLoading={allTasksQuery.isLoading}
                isError={allTasksQuery.isError}
                onRetry={() => allTasksQuery.refetch()}
              />
              {/* Employee KPI 3: CÔNG VIỆC QUÁ HẠN */}
              <KpiCard
                overline={t('dashboard:kpi.overdueTasks.label')}
                value={myOverdueCount}
                delta={
                  myOverdueCount > 0
                    ? {
                        type: 'decrease',
                        text: t('dashboard:kpi.overdueTasks.needsAction'),
                      }
                    : {
                        type: 'empty-good',
                        text: t('dashboard:kpi.overdueTasks.noOverdue'),
                      }
                }
                isLoading={allTasksQuery.isLoading}
                isError={allTasksQuery.isError}
                onRetry={() => allTasksQuery.refetch()}
              />
              {/* Employee KPI 4: CÔNG VIỆC ĐANG LÀM */}
              <KpiCard
                overline={t('dashboard:kpi.myTasks.label')}
                value={myInProgressCount}
                delta={{
                  type: 'neutral',
                  text: myInProgressCount > 5 ? t('dashboard:kpi.myTasks.priority') : t('dashboard:kpi.myTasks.onTrack'),
                }}
                isLoading={allTasksQuery.isLoading}
                isError={allTasksQuery.isError}
                onRetry={() => allTasksQuery.refetch()}
              />
            </>
          )}
        </div>


      {/* ROW 2: 2 CHARTS ĐẠT CHUẨN (GRID 5 CỘT: 3 COLS LINE CHART + 2 COLS DONUT CHART) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Line Chart (col-span-3) */}
        <div className="lg:col-span-3 rounded-lg border border-border-subtle bg-bg-surface p-5">
          <h2 className="text-[15px] leading-[22px] font-semibold text-text-primary mb-4 text-left">
            {t('dashboard:charts.taskTrendTitle')}
          </h2>
          <TaskTrendChart
            data={dynamicTaskTrend}
            isLoading={trendQuery.isLoading || allTasksQuery.isLoading}
            isError={trendQuery.isError && allTasksQuery.isError}
            onRetry={() => {
              trendQuery.refetch();
              allTasksQuery.refetch();
            }}
          />
        </div>

        {/* Donut Chart (col-span-2) */}
        <div className="lg:col-span-2 rounded-lg border border-border-subtle bg-bg-surface p-5">
          <h2 className="text-[15px] leading-[22px] font-semibold text-text-primary mb-4 text-left">
            {t('dashboard:charts.taskStatusTitle')}
          </h2>
          <TaskStatusDonut
            data={dynamicTaskBreakdown}
            isLoading={breakdownQuery.isLoading || allTasksQuery.isLoading}
            isError={breakdownQuery.isError && allTasksQuery.isError}
            onRetry={() => {
              breakdownQuery.refetch();
              allTasksQuery.refetch();
            }}
          />
        </div>
      </div>


      {/* ROW 3: 2 WIDGETS PHÍA DƯỚI (GRID 5 CỘT: 3 COLS ACTIVITY + 2 COLS UPCOMING LEAVES) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {canViewAnalytics ? (
          <>
            <div className="lg:col-span-3 rounded-lg border border-border-subtle bg-bg-surface p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-[15px] leading-[22px] font-semibold text-text-primary pb-3 border-b border-border-subtle mb-1">
                  {t('dashboard:recentActivitySection.title')}
                </h2>
                <RecentActivityFeed />
              </div>
            </div>

            <div className="lg:col-span-2">
              <UpcomingLeavesWidget />
            </div>
          </>
        ) : (
          <div className="lg:col-span-5">
            <UpcomingLeavesWidget />
          </div>
        )}
      </div>
      </div>
    </div>

  );
}

