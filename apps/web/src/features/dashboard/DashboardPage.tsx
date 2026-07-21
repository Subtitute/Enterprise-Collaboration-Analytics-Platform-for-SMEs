import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FolderKanbanIcon, CheckCircleIcon, UserIcon, FileTextIcon } from '@/components/ui/Icons';
import { DATE_RANGE_LABEL_VI } from '@/types';
import type { DateRangeOption } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { hasAdminRole } from '@/lib/utils';
import { useProjectsQuery } from '@/features/projects/hooks';
import { useAnalyticsSummary, useTaskStatusBreakdown, useTaskTrend } from './hooks';
import { KpiCard } from './components/KpiCard';
import { TaskTrendChart } from './components/TaskTrendChart';
import { TaskStatusDonut } from './components/TaskStatusDonut';
import { RecentActivityFeed } from './components/RecentActivityFeed';

export function DashboardPage() {
  const [range, setRange] = useState<DateRangeOption>('30d');
  const summaryQuery = useAnalyticsSummary(range);
  const trendQuery = useTaskTrend(range);
  const breakdownQuery = useTaskStatusBreakdown(range);

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
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Tổng quan hoạt động của tổ chức bạn.</p>
      </div>

      {showOnboarding && (
        <Card className="flex flex-col items-start gap-3 border-primary-100 bg-primary-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Chào mừng đến với ECAP for SMEs!</p>
            <p className="mt-1 text-sm text-slate-600">
              Tổ chức của bạn chưa có dự án nào. Mời thêm thành viên hoặc tạo dự án đầu tiên để bắt đầu.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {canInviteMembers && (
              <Link to="/admin/members">
                <Button variant="outline">Mời thành viên</Button>
              </Link>
            )}
            <Link to="/projects">
              <Button>Tạo dự án đầu tiên</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* 4 KPI card theo dung Wireframe.md muc 3: Tong cong viec / Ty le hoan thanh /
          Tai lieu moi tuan nay / Thanh vien hoat dong - khop chinh xac voi AnalyticsSummary
          tra ve boi GET /analytics/summary (khong con "du an dang hoat dong" hay "qua han"
          vi Analytics Service khong theo doi 2 chi so do - xem types/index.ts). Breakpoint 2 cot
          o `md` (768px) theo dung Wireframe.md muc 10 (mobile giu 1 cot xuyen suot <768px). */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tổng công việc"
          value={summary?.totalTasksCreated ?? '—'}
          hint={summary ? `${summary.totalTasksCompleted} đã hoàn thành` : undefined}
          icon={<FolderKanbanIcon className="h-5 w-5" />}
          isLoading={summaryQuery.isLoading}
        />
        <KpiCard
          label="Tỷ lệ hoàn thành"
          value={summary ? `${summary.completionRate}%` : '—'}
          hint="Trên tổng số công việc"
          icon={<CheckCircleIcon className="h-5 w-5" />}
          accentClassName="bg-emerald-50 text-emerald-600"
          isLoading={summaryQuery.isLoading}
        />
        <KpiCard
          label="Tài liệu mới (7 ngày)"
          value={summary?.newDocumentsThisWeek ?? '—'}
          hint="Tệp tải lên trong tuần"
          icon={<FileTextIcon className="h-5 w-5" />}
          accentClassName="bg-violet-50 text-violet-600"
          isLoading={summaryQuery.isLoading}
        />
        <KpiCard
          label="Thành viên hoạt động"
          value={summary?.activeUsersLast7Days ?? '—'}
          hint="Trong 7 ngày qua"
          icon={<UserIcon className="h-5 w-5" />}
          accentClassName="bg-amber-50 text-amber-600"
          isLoading={summaryQuery.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Xu hướng hoàn thành công việc</CardTitle>
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value as DateRangeOption)}
              className="text-xs"
              style={{ width: 'auto' }}
            >
              {(Object.keys(DATE_RANGE_LABEL_VI) as DateRangeOption[]).map((key) => (
                <option key={key} value={key}>
                  {DATE_RANGE_LABEL_VI[key]}
                </option>
              ))}
            </Select>
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Phân bố trạng thái công việc</CardTitle>
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
          <CardTitle>Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentActivityFeed />
        </CardContent>
      </Card>
    </div>
  );
}
