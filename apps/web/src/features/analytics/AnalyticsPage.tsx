import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import { SparklesIcon } from '@/components/ui/Icons';
import { useProjectNameMap } from '@/hooks/useOrgProjects';
import { DATE_RANGE_LABEL_VI } from '@/types';
import type { DateRangeOption } from '@/types';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren trang Bao cao & Phan tich, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useAiInsightMutation, useDocumentActivityQuery, useProjectProgressQuery } from './hooks';
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

  // 28/07/2026: tinh nang "Nhan xet AI" - departmentName CHI de hien thi trong doan van AI sinh
  // ra (xem fetchAiInsight()), lay tu du lieu departmentsQuery da co san cho dropdown ben tren.
  const aiInsightMutation = useAiInsightMutation();
  const selectedDepartmentName = departmentId
    ? (departmentsQuery.data ?? []).find((d) => d.id === departmentId)?.name
    : undefined;

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

      {/* 28/07/2026: tinh nang "Nhan xet AI" - theo yeu cau (nut bam), KHONG tu dong goi khi vao
          trang/doi bo loc, vi day la tinh nang goi Google Gemini API (co han ngach mien phi) -
          xem ly do day du tai hooks.ts (useAiInsightMutation). */}
      <Card>
        <CardHeader>
          <CardTitle>Nhận xét AI</CardTitle>
          <Button
            size="sm"
            variant="outline"
            isLoading={aiInsightMutation.isPending}
            onClick={() =>
              aiInsightMutation.mutate({ range, departmentId: departmentId || undefined, departmentName: selectedDepartmentName })
            }
          >
            <SparklesIcon className="h-4 w-4" />
            Tạo nhận xét AI
          </Button>
        </CardHeader>
        <CardContent>
          {aiInsightMutation.data ? (
            <div className="space-y-1">
              <p className="text-sm text-slate-700">{aiInsightMutation.data.insight}</p>
              <p className="text-xs text-slate-400">
                Dựa trên số liệu {DATE_RANGE_LABEL_VI[aiInsightMutation.variables?.range ?? range].toLowerCase()}
                {aiInsightMutation.variables?.departmentName ? ` · Phòng ban ${aiInsightMutation.variables.departmentName}` : ' · Toàn tổ chức'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Bấm “Tạo nhận xét AI” để nhận một đoạn nhận xét ngắn gọn về số liệu đang hiển thị, do AI tổng hợp.
            </p>
          )}
        </CardContent>
      </Card>

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
