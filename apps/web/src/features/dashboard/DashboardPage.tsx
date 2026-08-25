import { useState } from 'react';
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
import { useProjectsQuery } from '@/features/projects/hooks';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren Dashboard, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useAnalyticsSummary, useTaskStatusBreakdown, useTaskTrend } from './hooks';
import { KpiCard } from './components/KpiCard';
import { TaskTrendChart } from './components/TaskTrendChart';
import { TaskStatusDonut } from './components/TaskStatusDonut';
import { RecentActivityFeed } from './components/RecentActivityFeed';

export function DashboardPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<DateRangeOption>('30d');
  // 28/07/2026: state cho bo loc "Phong ban" moi - '' nghia la khong loc (hanh vi toan to chuc
  // nhu truoc day). Chi truyen vao useAnalyticsSummary/useTaskStatusBreakdown; useTaskTrend
  // (GET /analytics/task-trend) khong nhan departmentId vi backend chua ho tro tham so nay.
  const [departmentId, setDepartmentId] = useState('');
  const departmentsQuery = useDepartmentsQuery();
  const summaryQuery = useAnalyticsSummary(range, departmentId || undefined);
  const trendQuery = useTaskTrend(range);
  const breakdownQuery = useTaskStatusBreakdown(range, undefined, departmentId || undefined);

  // Onboarding sau dang ky to chuc (Wireframe.md muc 1): to chuc moi tinh gon la "chua co du
  // an nao" - hien banner goi y "moi thanh vien" / "tao du an dau tien" thay vi mot Dashboard
  // rong khong co huong dan. Dung lai GET /projects (limit=1) chi de biet tong so du an.
  const roles = useAuthStore((s) => s.user?.roles);
  const canInviteMembers = hasAdminRole(roles);
  const projectsProbeQuery = useProjectsQuery({ limit: 1 });
  const showOnboarding = !projectsProbeQuery.isLoading && !projectsProbeQuery.isError && (projectsProbeQuery.data?.meta.total ?? 0) === 0;

  const summary = summaryQuery.data;

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

      {/* 4 KPI card theo dung Wireframe.md muc 3: Tong cong viec / Ty le hoan thanh /
          Tai lieu moi tuan nay / Thanh vien hoat dong - khop chinh xac voi AnalyticsSummary
          tra ve boi GET /analytics/summary (khong con "du an dang hoat dong" hay "qua han"
          vi Analytics Service khong theo doi 2 chi so do - xem types/index.ts). Breakpoint 2 cot
          o `md` (768px) theo dung Wireframe.md muc 10 (mobile giu 1 cot xuyen suot <768px). */}
      {/* 22/07/2026: sua loi thuc te - ca 4 the KPI truoc day chi nhan isLoading, khong nhan
          isError/onRetry, nen khi GET /analytics/summary that bai thi ca 4 the hien '—' MAI MAI
          khong co cach nao phan biet voi "chua co du lieu", va cung khong co nut thu lai - khac
          han 2 bieu do ben duoi (TaskTrendChart/TaskStatusDonut) tren CUNG trang nay da lam dung.
          Them isError={summaryQuery.isError} + onRetry={summaryQuery.refetch} cho ca 4 the de
          nhat quan voi pattern loi/thu lai da co san. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label={t('dashboard:kpi.totalTasks.label')}
          value={summary?.totalTasksCreated ?? '—'}
          hint={summary ? t('dashboard:kpi.totalTasks.hint', { count: summary.totalTasksCompleted }) : undefined}
          icon={<FolderKanbanIcon className="h-5 w-5" />}
          accentClassName="bg-blue-50 text-blue-600 border border-blue-100/80 shadow-blue-500/10"
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          onRetry={() => summaryQuery.refetch()}
        />
        <KpiCard
          label={t('dashboard:kpi.completionRate.label')}
          value={summary ? `${summary.completionRate}%` : '—'}
          hint={t('dashboard:kpi.completionRate.hint')}
          icon={<CheckCircleIcon className="h-5 w-5" />}
          accentClassName="bg-emerald-50 text-emerald-600 border border-emerald-100/80 shadow-emerald-500/10"
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          onRetry={() => summaryQuery.refetch()}
        />
        <KpiCard
          label={t('dashboard:kpi.newDocuments.label')}
          value={summary?.newDocumentsThisWeek ?? '—'}
          hint={t('dashboard:kpi.newDocuments.hint')}
          icon={<FileTextIcon className="h-5 w-5" />}
          accentClassName="bg-purple-50 text-purple-600 border border-purple-100/80 shadow-purple-500/10"
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          onRetry={() => summaryQuery.refetch()}
        />
        <KpiCard
          label={t('dashboard:kpi.activeUsers.label')}
          value={summary?.activeUsersLast7Days ?? '—'}
          hint={t('dashboard:kpi.activeUsers.hint')}
          icon={<UserIcon className="h-5 w-5" />}
          accentClassName="bg-orange-50 text-orange-600 border border-orange-100/80 shadow-orange-500/10"
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          onRetry={() => summaryQuery.refetch()}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
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
              data={trendQuery.data ?? []}
              isLoading={trendQuery.isLoading}
              isError={trendQuery.isError}
              onRetry={() => trendQuery.refetch()}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 drop-shadow-md border-slate-200/90">
          <CardHeader>
            <CardTitle>{t('dashboard:charts.taskStatusTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskStatusDonut
              data={breakdownQuery.data ?? []}
              isLoading={breakdownQuery.isLoading}
              isError={breakdownQuery.isError}
              onRetry={() => breakdownQuery.refetch()}
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
