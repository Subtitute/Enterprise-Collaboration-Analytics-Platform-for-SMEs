import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { Button } from '@/components/ui/Button';
import { FolderKanbanIcon, CheckCircleIcon, UserIcon, FileTextIcon } from '@/components/ui/Icons';
import { DATE_RANGE_OPTIONS } from '@/types';
import type { DateRangeOption } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { hasAdminRole } from '@/lib/utils';
import { useProjectsQuery, useAllTasksQuery } from '@/features/projects/hooks';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren Dashboard, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useAnalyticsSummary, useTaskStatusBreakdown, useTaskTrend } from './hooks';
import { KpiCard } from './components/KpiCard';
import { TaskTrendChart } from './components/TaskTrendChart';
import { TaskStatusDonut } from './components/TaskStatusDonut';
import { RecentActivityFeed } from './components/RecentActivityFeed';

import { useOrgUsersQuery } from '@/hooks/useOrgUsers';

export function DashboardPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRangeOption>('7d');
  const [departmentId, setDepartmentId] = useState('');
  const departmentsQuery = useDepartmentsQuery();
  const summaryQuery = useAnalyticsSummary(range, departmentId || undefined);
  const trendQuery = useTaskTrend(range);
  const breakdownQuery = useTaskStatusBreakdown(range, undefined, departmentId || undefined);

  // Lấy danh sách toàn bộ dự án, tasks và người dùng để tính toán số liệu khớp tuyệt đối với bộ lọc
  const allProjectsQuery = useProjectsQuery({ limit: 100 });
  const allTasksQuery = useAllTasksQuery();
  const allUsersQuery = useOrgUsersQuery();

  const roles = useAuthStore((s) => s.user?.roles);
  const canInviteMembers = hasAdminRole(roles);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('dashboard:page.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('dashboard:page.subtitle')}</p>
      </div>

      {showOnboarding && (
        <Card className="flex flex-col items-start gap-3 border-primary-100 bg-primary-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
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
            <Link to="/projects">
              <Button>{t('dashboard:onboarding.createFirstProject')}</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* BỐ CỤC ĐỒNG BỘ LƯỚI 12 CỘT (GRID 12) CHO CẢ 2 HÀNG:
          - Hàng 1: Thẻ Tổng quan (8/12 cols) + 2 Thẻ KPI phụ (4/12 cols).
          - Hàng 2: Biểu đồ đường AreaChart (8/12 cols) + Biểu đồ tròn Donut (4/12 cols). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Thẻ Hero Lớn: Điểm nhấn Tổng quan Hiệu suất & Tiến độ Toàn Doanh nghiệp */}
        <Card className="flex flex-col justify-between p-6 border-slate-200/60 bg-white shadow-sm lg:col-span-8 group hover:shadow-md hover:border-indigo-300 transition-all duration-200">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              {t('dashboard:hero.title')}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('dashboard:hero.subtitle')}
            </p>

            {/* Trọng tâm thị giác: Hàng 1 chứa con số % cực đại + Text thống kê, Hàng 2 là Thanh máu boss w-full */}
            <div className="mt-5 space-y-3">
              {/* Hàng 1: Con số % cực đại bên trái, thông tin số việc đã xong bên phải */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-primary-600 leading-none">
                    {`${completionRate}%`}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard:hero.completionRateLabel')}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-500">{t('dashboard:hero.progressLabel')}: </span>
                  <span className="text-xs font-bold text-slate-900">{`${totalTasksCompleted} / ${totalTasksCreated} ${t('dashboard:hero.progressUnit')}`}</span>
                </div>
              </div>

              {/* Hàng 2: "Thanh máu boss" Progress Bar trải dài toàn bộ chiều rộng w-full, dày dặn bo tròn */}
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/60 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-primary-500 to-violet-600 transition-all duration-700 ease-out shadow-sm"
                  style={{ width: `${Math.max(2, Math.min(100, completionRate))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100/90 pt-4 text-xs sm:text-sm">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50/80 border border-emerald-200/60 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                {t('dashboard:hero.completedStatus')}:
                <strong className="text-sm sm:text-base font-bold text-emerald-900 ml-0.5">{totalTasksCompleted}</strong>
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-indigo-50/80 border border-indigo-200/60 px-3 py-1.5 text-xs font-semibold text-indigo-800 shadow-2xs">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-200" />
                {t('dashboard:hero.totalTasksStatus')}:
                <strong className="text-sm sm:text-base font-bold text-indigo-900 ml-0.5">{totalTasksCreated}</strong>
              </span>
            </div>
            <Link
              to="/projects"
              className="font-semibold text-sm text-primary-600 hover:text-primary-700 transition-colors inline-flex items-center gap-1"
            >
              {t('dashboard:hero.viewAllLink')}
            </Link>
          </div>
        </Card>

        {/* 2 Thẻ KPI phụ bên cạnh (4/12 cols) - Thiết lập h-full để khớp tuyệt đối chiều cao với Thẻ Hero */}
        <div className="flex flex-col justify-between gap-4 lg:col-span-4 h-full">
          <KpiCard
            label={t('dashboard:kpi.newDocuments.label')}
            value={summary?.newDocumentsThisWeek ?? '—'}
            hint={t('dashboard:kpi.newDocuments.hint')}
            icon={<FileTextIcon className="h-5 w-5" />}
            accentClassName="bg-violet-100 text-violet-600"
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
            onRetry={() => summaryQuery.refetch()}
            className="flex-1"
          />
          <KpiCard
            label={t('dashboard:kpi.activeUsers.label')}
            value={summary?.activeUsersLast7Days ?? '—'}
            hint={t('dashboard:kpi.activeUsers.hint')}
            icon={<UserIcon className="h-5 w-5" />}
            accentClassName="bg-amber-100 text-amber-600"
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
            onRetry={() => summaryQuery.refetch()}
            className="flex-1"
          />
        </div>
      </div>

      {/* HÀNG DƯỚI: ĐỒNG BỘ CHUẨN GRID 12 (8 COLS VÀ 4 COLS) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>{t('dashboard:charts.taskTrendTitle')}</CardTitle>
            {/* 25/07/2026: them aria-label - Select nay khong co <Label> hien thi kem theo (chi
                dat canh CardTitle) nen truoc do khong co ten hop le cho trinh doc man hinh. */}
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
              {/* 28/07/2026: bo loc "Phong ban" moi cho khoi KPI cua Dashboard (KHONG anh huong
                  bieu do "Xu hướng hoàn thành công việc" ben duoi - GET /analytics/task-trend
                  chua ho tro departmentId, xem Technical_Spec.md). Dat canh Select khoang thoi
                  gian de dung chung mot vi tri quen thuoc tren trang. */}
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

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard:recentActivitySection.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivityFeed />
        </CardContent>
      </Card>
    </div>
  );
}
