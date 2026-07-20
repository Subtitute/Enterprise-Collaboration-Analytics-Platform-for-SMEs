import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { useProjectNameMap } from '@/hooks/useOrgProjects';
import { DATE_RANGE_LABEL_VI } from '@/types';
import type { DateRangeOption } from '@/types';
import { useDocumentActivityQuery, useProjectProgressQuery } from './hooks';
import { ProjectProgressChart } from './components/ProjectProgressChart';
import { ProjectProgressTable } from './components/ProjectProgressTable';
import { DocumentActivityChart } from './components/DocumentActivityChart';

export function AnalyticsPage() {
  const [range, setRange] = useState<DateRangeOption>('30d');

  const progressQuery = useProjectProgressQuery();
  const activityQuery = useDocumentActivityQuery(range);
  const { map: projectNames } = useProjectNameMap();

  const progressRows = useMemo(
    () =>
      (progressQuery.data ?? []).map((item) => {
        const totalTasks = item.totalTasks ?? 0;
        const completedTasks = item.completedTasks ?? 0;
        const progress = item.progress ?? (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
        return {
          projectId: item.projectId,
          name: projectNames[item.projectId] ?? `Dự án #${item.projectId.slice(0, 8)}`,
          progress,
          completedTasks,
          totalTasks,
        };
      }),
    [progressQuery.data, projectNames],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Báo cáo &amp; Phân tích</h1>
          <p className="text-sm text-slate-500">Số liệu tổng hợp toàn tổ chức theo khoảng thời gian đã chọn.</p>
        </div>
        <Select value={range} onChange={(e) => setRange(e.target.value as DateRangeOption)} style={{ width: 'auto' }}>
          {(Object.keys(DATE_RANGE_LABEL_VI) as DateRangeOption[]).map((key) => (
            <option key={key} value={key}>
              {DATE_RANGE_LABEL_VI[key]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>So sánh tiến độ dự án</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectProgressChart data={progressRows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Xu hướng hoạt động tài liệu</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentActivityChart data={activityQuery.data ?? []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bảng chỉ số theo dự án</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectProgressTable rows={progressRows} />
        </CardContent>
      </Card>
    </div>
  );
}
