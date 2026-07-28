import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import { useProjectNameMap } from '@/hooks/useOrgProjects';
import { DATE_RANGE_LABEL_VI } from '@/types';
import type { DateRangeOption } from '@/types';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren trang Bao cao & Phan tich, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useDocumentActivityQuery, useProjectProgressQuery } from './hooks';
import { ProjectProgressChart } from './components/ProjectProgressChart';
import { ProjectProgressTable } from './components/ProjectProgressTable';
import { DocumentActivityChart } from './components/DocumentActivityChart';

export function AnalyticsPage() {
  const [range, setRange] = useState<DateRangeOption>('30d');
  // 28/07/2026: state cho bo loc "Phong ban" moi - '' nghia la khong loc (hanh vi toan to chuc
  // nhu truoc day). Chi truyen vao useProjectProgressQuery; useDocumentActivityQuery giu nguyen
  // vi hoat dong tai lieu khong phai du lieu theo cong viec/nguoi thuc hien nen khong loc theo
  // phong ban duoc.
  const [departmentId, setDepartmentId] = useState('');
  const departmentsQuery = useDepartmentsQuery();

  const progressQuery = useProjectProgressQuery(range, departmentId || undefined);
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
        {/* 25/07/2026: them aria-label - cung ly do nhu Select tuong tu o DashboardPage.tsx (khong
            co <Label> hien thi kem theo de trinh doc man hinh doc ten). */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={range}
            onChange={(e) => setRange(e.target.value as DateRangeOption)}
            aria-label="Khoảng thời gian"
            style={{ width: 'auto' }}
          >
            {(Object.keys(DATE_RANGE_LABEL_VI) as DateRangeOption[]).map((key) => (
              <option key={key} value={key}>
                {DATE_RANGE_LABEL_VI[key]}
              </option>
            ))}
          </Select>
          {/* 28/07/2026: bo loc "Phong ban" moi - chi anh huong "So sanh tien do du an" +
              "Bang chi so theo du an" (deu dua tren GET /analytics/project-progress da ho tro
              departmentId); "Xu huong hoat dong tai lieu" ben duoi khong loc theo phong ban. */}
          <Select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            aria-label="Phòng ban"
            style={{ width: 'auto' }}
          >
            <option value="">Tất cả phòng ban</option>
            {(departmentsQuery.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>So sánh tiến độ dự án</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectProgressChart
              data={progressRows}
              isLoading={progressQuery.isLoading}
              isError={progressQuery.isError}
              onRetry={() => progressQuery.refetch()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Xu hướng hoạt động tài liệu</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentActivityChart
              data={activityQuery.data ?? []}
              isLoading={activityQuery.isLoading}
              isError={activityQuery.isError}
              onRetry={() => activityQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bảng chỉ số theo dự án</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={progressQuery.isLoading}
            isError={progressQuery.isError}
            onRetry={() => progressQuery.refetch()}
            errorTitle="Không thể tải bảng chỉ số dự án"
            loadingFallback={
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            }
          >
            <ProjectProgressTable rows={progressRows} />
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
