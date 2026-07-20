import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { FolderKanbanIcon, CheckCircleIcon, UserIcon, FileTextIcon } from '@/components/ui/Icons';
import { DATE_RANGE_LABEL_VI } from '@/types';
import type { DateRangeOption } from '@/types';
import { useAnalyticsSummary, useTaskStatusBreakdown, useTaskTrend } from './hooks';
import { KpiCard } from './components/KpiCard';
import { TaskTrendChart } from './components/TaskTrendChart';
import { TaskStatusDonut } from './components/TaskStatusDonut';
import { RecentActivityFeed } from './components/RecentActivityFeed';

export function DashboardPage() {
  const [range, setRange] = useState<DateRangeOption>('30d');
  const summaryQuery = useAnalyticsSummary();
  const trendQuery = useTaskTrend(range);
  const breakdownQuery = useTaskStatusBreakdown();

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Tổng quan hoạt động của tổ chức bạn.</p>
      </div>

      {/* 4 KPI card theo dung Wireframe.md muc 3: Tong cong viec / Ty le hoan thanh /
          Tai lieu moi tuan nay / Thanh vien hoat dong - khop chinh xac voi AnalyticsSummary
          tra ve boi GET /analytics/summary (khong con "du an dang hoat dong" hay "qua han"
          vi Analytics Service khong theo doi 2 chi so do - xem types/index.ts). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <TaskTrendChart data={trendQuery.data ?? []} isLoading={trendQuery.isLoading} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Phân bố trạng thái công việc</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskStatusDonut data={breakdownQuery.data ?? []} isLoading={breakdownQuery.isLoading} />
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
