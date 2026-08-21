import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import { SparklesIcon } from '@/components/ui/Icons';
import { useProjectNameMap } from '@/hooks/useOrgProjects';
import { DATE_RANGE_OPTIONS } from '@/types';
import type { DateRangeOption } from '@/types';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren trang Bao cao & Phan tich, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { useAiInsightMutation, useDocumentActivityQuery, useProjectProgressQuery } from './hooks';
import { ProjectProgressChart } from './components/ProjectProgressChart';
import { ProjectProgressTable } from './components/ProjectProgressTable';
import { DocumentActivityChart } from './components/DocumentActivityChart';

export function AnalyticsPage() {
  const { t } = useTranslation();
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
          name: projectNames[item.projectId] ?? t('analytics:page.unnamedProject', { id: item.projectId.slice(0, 8) }),
          progress,
          completedTasks,
          totalTasks,
        };
      }),
    [progressQuery.data, projectNames, t],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('analytics:page.title')}</h1>
          <p className="text-sm text-slate-500">{t('analytics:page.subtitle')}</p>
        </div>
        {/* 25/07/2026: them aria-label - cung ly do nhu Select tuong tu o DashboardPage.tsx (khong
            co <Label> hien thi kem theo de trinh doc man hinh doc ten). */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={range}
            onChange={(e) => setRange(e.target.value as DateRangeOption)}
            aria-label={t('analytics:filters.dateRangeAriaLabel')}
            style={{ width: 'auto' }}
          >
            {DATE_RANGE_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {t(`common:enums.dateRange.${key}`)}
              </option>
            ))}
          </Select>
          {/* 28/07/2026: bo loc "Phong ban" moi - chi anh huong "So sanh tien do du an" +
              "Bang chi so theo du an" (deu dua tren GET /analytics/project-progress da ho tro
              departmentId); "Xu huong hoat dong tai lieu" ben duoi khong loc theo phong ban. */}
          <Select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            aria-label={t('analytics:filters.departmentAriaLabel')}
            style={{ width: 'auto' }}
          >
            <option value="">{t('analytics:filters.allDepartments')}</option>
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
          <CardTitle>{t('analytics:aiInsight.title')}</CardTitle>
          <Button
            size="sm"
            variant="outline"
            isLoading={aiInsightMutation.isPending}
            onClick={() =>
              aiInsightMutation.mutate({ range, departmentId: departmentId || undefined, departmentName: selectedDepartmentName })
            }
          >
            <SparklesIcon className="h-4 w-4" />
            {t('analytics:aiInsight.generateButton')}
          </Button>
        </CardHeader>
        <CardContent>
          {aiInsightMutation.data ? (
            <div className="space-y-1">
              <p className="text-sm text-slate-700">{aiInsightMutation.data.insight}</p>
              <p className="text-xs text-slate-400">
                {aiInsightMutation.variables?.departmentName
                  ? t('analytics:aiInsight.summaryWithDepartment', {
                      range: t(`common:enums.dateRange.${aiInsightMutation.variables?.range ?? range}`).toLowerCase(),
                      department: aiInsightMutation.variables.departmentName,
                    })
                  : t('analytics:aiInsight.summaryAllOrg', {
                      range: t(`common:enums.dateRange.${aiInsightMutation.variables?.range ?? range}`).toLowerCase(),
                    })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t('analytics:aiInsight.placeholder')}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('analytics:charts.projectProgressTitle')}</CardTitle>
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
            <CardTitle>{t('analytics:charts.documentActivityTitle')}</CardTitle>
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
          <CardTitle>{t('analytics:projectProgressTableSection.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={progressQuery.isLoading}
            isError={progressQuery.isError}
            onRetry={() => progressQuery.refetch()}
            errorTitle={t('analytics:projectProgressTableSection.errorTitle')}
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
