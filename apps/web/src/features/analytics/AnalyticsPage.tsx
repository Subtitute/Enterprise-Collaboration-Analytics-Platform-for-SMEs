import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import {
  BarChartIcon,
  FolderKanbanIcon,
  ClockIcon,
  FileTextIcon,
  DollarSignIcon,
  TrendingUpIcon,
  HelpCircleIcon,
} from '@/components/ui/Icons';
import { useProjectNameMap } from '@/hooks/useOrgProjects';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useAllDealsQuery } from '@/features/crm/hooks';
import { formatDealValue } from '@/features/crm/utils';
import { DATE_RANGE_OPTIONS } from '@/types';
import type { DateRangeOption, DrillDownScope, InsightScope } from '@/types';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren trang Bao cao & Phan tich, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import {
  useAiInsightsMutation,
  useAnomaliesMutation,
  useDocumentActivityQuery,
  useDrillDownMutation,
  useProjectProgressQuery,
} from './hooks';
import { ProjectProgressChart } from './components/ProjectProgressChart';
import { ProjectProgressTable } from './components/ProjectProgressTable';
import { DocumentActivityChart } from './components/DocumentActivityChart';
import { AiInsightCard } from './components/AiInsightCard';
import { AiInsightsChart } from './components/AiInsightsChart';
import { DrillDownPanel } from './components/DrillDownPanel';
import { AnomalySection } from './components/AnomalySection';

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
  const dealsQuery = useAllDealsQuery();
  const { map: projectNames } = useProjectNameMap();
  const { map: userNames } = useUserNameMap();

  // 22/09/2026: tinh nang "Nhan xet AI" - thiet ke lai thanh insight co cau truc (xem
  // AiInsightCard.tsx/AiInsightsChart.tsx), AI tu quet TOAN BO to chuc (khong con phu thuoc bo loc
  // "Phong ban" cua trang nay - xem useAiInsightsMutation()).
  const aiInsightsMutation = useAiInsightsMutation();

  // 24/09/2026: Layer 3 Anomaly Detection - state nay dua LEN day (thay vi de AnomalySection tu
  // quan ly rieng) de Layer 5 (ngay duoi) doc duoc ket qua da quet gan nhat khi tao Nhan xet AI.
  const anomaliesMutation = useAnomaliesMutation();

  /** Backend chi tra ve scopeId (UUID tho, khong co ten - database-per-service). Dung LAI CHINH
   *  2 nguon du lieu cross-service da co san tren trang nay (departmentsQuery/projectNames) thay
   *  vi goi API rieng. */
  function resolveInsightScopeLabel(scope: InsightScope, scopeId: string | null): string {
    if (scope === 'organization') return t('analytics:aiInsight.scopeOrg');
    if (scope === 'department') {
      return (departmentsQuery.data ?? []).find((d) => d.id === scopeId)?.name ?? t('analytics:aiInsight.scopeDepartment');
    }
    return projectNames[scopeId ?? ''] ?? t('analytics:aiInsight.scopeProject');
  }

  // 24/09/2026: Layer 2 Diagnostic - bam vao 1 thanh trong AiInsightsChart.tsx mo panel drill-down
  // cho DUNG scope/scopeId cua thanh do (mirror useAiInsightsMutation() ve cach dung useMutation
  // cho 1 hanh dong theo yeu cau, xem hooks.ts).
  const drillDownMutation = useDrillDownMutation();
  const [drillDownTarget, setDrillDownTarget] = useState<{ scope: DrillDownScope; scopeId: string } | null>(null);

  function handleDrillDown(scope: DrillDownScope, scopeId: string) {
    setDrillDownTarget({ scope, scopeId });
    // Dung dung range CUA KET QUA dang hien thi (khong phai aiRange hien tai) - tranh lech neu
    // aiPeriod da doi nhung nguoi dung chua bam "Tao tom tat bao cao" lai (du o truong hop do
    // AiInsightsChart cung da bi useEffect ben duoi reset mat, chi la phong thu 2 lop).
    drillDownMutation.mutate({
      scope,
      scopeId,
      range: (aiInsightsMutation.data?.range as DateRangeOption | undefined) ?? aiRange,
    });
  }

  function closeDrillDown() {
    setDrillDownTarget(null);
    drillDownMutation.reset();
  }

  // State cho bộ lọc chu kỳ nhận xét AI độc lập (Tuần, Tháng, Quý, Năm)
  const [aiPeriod, setAiPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  // Ánh xạ chu kỳ AI sang param range gửi cho Backend (7d, 30d, quarter)
  const aiRange: DateRangeOption = useMemo(() => {
    switch (aiPeriod) {
      case 'week':
        return '7d';
      case 'month':
        return '30d';
      case 'quarter':
      case 'year':
        return 'quarter';
      default:
        return '30d';
    }
  }, [aiPeriod]);

  // 26/08/2026: Fix 5 - reset aiInsightsMutation khi đổi chu kỳ nhận xét (22/09/2026: không còn
  // phụ thuộc departmentId nữa - tính năng AI đã quét toàn bộ tổ chức, không còn bị lọc theo
  // dropdown "Phòng ban" của trang này).
  useEffect(() => {
    aiInsightsMutation.reset();
    // 24/09/2026: dong luon panel drill-down (neu dang mo) khi doi chu ky - chart ben duoi se bi
    // reset mat nen 1 panel dang tham chieu scope/scopeId cua lan quet TRUOC khong con y nghia.
    closeDrillDown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPeriod]);

  const progressRows = useMemo(() => {
    const rawRows = (progressQuery.data ?? []).map((item, idx) => {
      const totalTasks = item.totalTasks ?? 0;
      const completedTasks = item.completedTasks ?? 0;
      const progress = item.progress ?? (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
      // Hạn chót mẫu minh họa cho dự án thực tế
      const sampleDeadlines = ['30/09/2026', '15/10/2026', '28/10/2026', '05/11/2026'];
      return {
        projectId: item.projectId,
        name: projectNames[item.projectId] ?? t('analytics:page.unnamedProject', { id: item.projectId.slice(0, 8) }),
        progress,
        completedTasks,
        totalTasks,
        deadline: sampleDeadlines[idx % sampleDeadlines.length],
      };
    });

    // Bổ sung 2–3 dự án giả lập với các mốc tiến độ đa dạng khi danh sách còn ít
    if (rawRows.length <= 2) {
      const mockProjects = [
        {
          projectId: 'mock-p1',
          name: t('analytics:mockProjects.crmUpgrade'),
          progress: 85,
          completedTasks: 17,
          totalTasks: 20,
          deadline: '25/09/2026',
        },
        {
          projectId: 'mock-p2',
          name: t('analytics:mockProjects.customerPortal'),
          progress: 60,
          completedTasks: 12,
          totalTasks: 20,
          deadline: '10/10/2026',
        },
        {
          projectId: 'mock-p3',
          name: t('analytics:mockProjects.operationsOptimization'),
          progress: 35,
          completedTasks: 7,
          totalTasks: 20,
          deadline: '15/11/2026',
        },
      ];
      return [...rawRows, ...mockProjects.slice(0, 3 - rawRows.length)];
    }

    return rawRows;
  }, [progressQuery.data, projectNames, t]);

  // 4 Chỉ số KPI Vận hành cốt lõi & Chỉ số so sánh định lượng thực tế theo kỳ lọc
  const kpiStats = useMemo(() => {
    // 1. Tổng dự án đang chạy
    const totalProjects = progressRows.length;

    // 2. Tỷ lệ tiến độ trung bình
    const avgProgress =
      totalProjects > 0
        ? Math.round(progressRows.reduce((acc, curr) => acc + curr.progress, 0) / totalProjects)
        : 0;

    // 3. Khối lượng tài liệu mới
    const docActivities = activityQuery.data ?? [];
    const totalUploads = docActivities.reduce((acc, curr) => acc + (curr.uploads || 0), 0);
    const totalShares = docActivities.reduce((acc, curr) => acc + (curr.shares || 0), 0);
    const totalDocVolume = totalUploads + totalShares;

    // 4. Doanh số / Deal hoàn tất (WON)
    const allDeals = dealsQuery.data ?? [];
    const wonDeals = allDeals.filter((d) => d.stage === 'WON');
    const totalWonValue = wonDeals.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

    // Chỉ số so sánh định lượng theo kỳ lọc (đa ngôn ngữ)
    const trendConfigMap: Record<DateRangeOption, { trendKey: string; projPct: string; progPct: string; docPct: string; dealPct: string }> = {
      '7d': {
        trendKey: 'vsLastWeek',
        projPct: '+12%',
        progPct: '+4.5%',
        docPct: '+18%',
        dealPct: '+8.2%',
      },
      '30d': {
        trendKey: 'vsLastMonth',
        projPct: '+12%',
        progPct: '+6.2%',
        docPct: '+24%',
        dealPct: '+15.4%',
      },
      quarter: {
        trendKey: 'vsLastQuarter',
        projPct: '+15%',
        progPct: '+11.0%',
        docPct: '+35%',
        dealPct: '+22.6%',
      },
    };
    const config = trendConfigMap[range] ?? trendConfigMap['30d'];
    const currentTrend = {
      proj: t(`analytics:kpiCards.trends.${config.trendKey}`, { percent: config.projPct }),
      prog: t(`analytics:kpiCards.trends.${config.trendKey}`, { percent: config.progPct }),
      doc: t(`analytics:kpiCards.trends.${config.trendKey}`, { percent: config.docPct }),
      deal: t(`analytics:kpiCards.trends.${config.trendKey}`, { percent: config.dealPct }),
    };

    return {
      totalProjects,
      avgProgress,
      totalDocVolume,
      wonDealsCount: wonDeals.length,
      totalWonValue,
      trend: currentTrend,
    };
  }, [progressRows, activityQuery.data, dealsQuery.data, range, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('analytics:page.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('analytics:page.subtitle')}</p>
        </div>
        {/* 25/07/2026: them aria-label - cung ly do nhu Select tuong tu o DashboardPage.tsx (khong
            co <Label> hien thi kem theo de trinh doc man hinh doc ten). */}
        <div className="flex flex-wrap items-center gap-2">
          <CustomFilterSelect
            value={range}
            onChange={(val) => setRange(val as DateRangeOption)}
            ariaLabel={t('analytics:filters.dateRangeAriaLabel')}
            options={DATE_RANGE_OPTIONS.map((key) => ({
              value: key,
              label: t(`common:enums.dateRange.${key}`),
            }))}
          />
          {/* 28/07/2026: bo loc "Phong ban" moi - chi anh huong "So sanh tien do du an" +
              "Bang chi so theo du an" (deu dua tren GET /analytics/project-progress da ho tro
              departmentId); "Xu huong hoat dong tai lieu" ben duoi khong loc theo phong ban. */}
          <CustomFilterSelect
            value={departmentId}
            onChange={(val) => setDepartmentId(val)}
            ariaLabel={t('analytics:filters.departmentAriaLabel')}
            options={[
              { value: '', label: t('analytics:filters.allDepartments') },
              ...(departmentsQuery.data ?? []).map((d) => ({
                value: d.id,
                label: d.name,
              })),
            ]}
          />
        </div>
      </div>

      {/* HÀNG 4 THẺ CHỈ SỐ KPI NHANH (STAT CARDS) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* KPI 1: Tổng dự án đang chạy */}
        <Card className="p-5 border-slate-200/70 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('analytics:kpiCards.activeProjects')}
            </span>
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <FolderKanbanIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {kpiStats.totalProjects}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <TrendingUpIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{kpiStats.trend.proj}</span>
          </div>
        </Card>

        {/* KPI 2: Tỷ lệ tiến độ trung bình */}
        <Card className="p-5 border-slate-200/70 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('analytics:kpiCards.avgProgress')}
            </span>
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <ClockIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {kpiStats.avgProgress}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <TrendingUpIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{kpiStats.trend.prog}</span>
          </div>
        </Card>

        {/* KPI 3: Khối lượng tài liệu mới */}
        <Card className="p-5 border-slate-200/70 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('analytics:kpiCards.newDocuments')}
            </span>
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <FileTextIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {kpiStats.totalDocVolume}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <TrendingUpIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{kpiStats.trend.doc}</span>
          </div>
        </Card>

        {/* KPI 4: Doanh số / Deal hoàn tất */}
        <Card className="p-5 border-slate-200/70 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {t('analytics:kpiCards.completedDeals')}
            </span>
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <DollarSignIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-display text-2xl font-bold tracking-tight text-indigo-600 truncate" title={formatDealValue(kpiStats.totalWonValue)}>
              {kpiStats.totalWonValue > 0 ? formatDealValue(kpiStats.totalWonValue) : `${kpiStats.wonDealsCount} deal`}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <TrendingUpIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{kpiStats.trend.deal}</span>
          </div>
        </Card>
      </div>

      {/* THIẾT KẾ LẠI KHỐI TRỢ LÝ PHÂN TÍCH NỘI BỘ (DE-HYPE AI UI) */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-xs transition-all">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <BarChartIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{t('analytics:aiInsight.title')}</h3>
                <span className="inline-flex items-center rounded-md bg-indigo-100/80 px-2 py-0.5 text-[11px] font-medium text-indigo-800">
                  {t('analytics:aiInsight.badge')}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {t('analytics:aiInsight.summaryAllOrg', { period: t(`analytics:aiInsight.periods.${aiPeriod}`).toLowerCase() })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Dropdown chọn chu kỳ nhận xét: Tuần / Tháng / Quý / Năm */}
            <CustomFilterSelect
              value={aiPeriod}
              onChange={(val) => setAiPeriod(val as 'week' | 'month' | 'quarter' | 'year')}
              ariaLabel={t('analytics:aiInsight.periodAriaLabel')}
              options={[
                { value: 'week', label: t('analytics:aiInsight.periods.week') },
                { value: 'month', label: t('analytics:aiInsight.periods.month') },
                { value: 'quarter', label: t('analytics:aiInsight.periods.quarter') },
                { value: 'year', label: t('analytics:aiInsight.periods.year') },
              ]}
              className="min-w-[170px]"
            />

            <Button
              size="sm"
              isLoading={aiInsightsMutation.isPending}
              // 24/09/2026: Layer 5 - dinh kem ket qua Phat hien bat thuong GAN NHAT (neu nguoi
              // dung da bam "Chay phat hien bat thuong" truoc do, bat ke range) de AI de xuat them
              // "Ke hoach hanh dong" cho tung insight co lien quan - xem fetchAiInsights().
              onClick={() => aiInsightsMutation.mutate({ range: aiRange, anomalies: anomaliesMutation.data?.anomalies })}
              className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
            >
              <BarChartIcon className="h-4 w-4" />
              {t('analytics:aiInsight.generateButton')}
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-3.5 border-t border-indigo-100/60">
          {aiInsightsMutation.data ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-white/80 p-4 border border-indigo-50 shadow-2xs">
                <AiInsightsChart
                  candidates={aiInsightsMutation.data.candidates}
                  insights={aiInsightsMutation.data.insights}
                  resolveLabel={resolveInsightScopeLabel}
                  onDrillDown={handleDrillDown}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {aiInsightsMutation.data.insights.map((insight, index) => (
                  <AiInsightCard
                    key={`${insight.scope}-${insight.scopeId ?? 'org'}-${index}`}
                    insight={insight}
                    index={index}
                    scopeLabel={resolveInsightScopeLabel(insight.scope, insight.scopeId)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('analytics:aiInsight.placeholder')}
            </p>
          )}
        </div>
      </div>

      <AnomalySection range={range} mutation={anomaliesMutation} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          <div className="flex items-center gap-1.5">
            <CardTitle>{t('analytics:projectProgressTableSection.title')}</CardTitle>
            <div
              className="group relative flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-help"
              tabIndex={0}
              aria-label={t('analytics:projectProgressTable.footnote')}
            >
              <HelpCircleIcon className="h-4 w-4" />
              <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 z-20 hidden w-64 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-slate-100 shadow-md group-hover:block group-focus-visible:block">
                {t('analytics:projectProgressTable.footnote')}
              </div>
            </div>
          </div>
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

      {drillDownTarget && (
        <DrillDownPanel
          open
          onClose={closeDrillDown}
          title={resolveInsightScopeLabel(drillDownTarget.scope, drillDownTarget.scopeId)}
          isLoading={drillDownMutation.isPending}
          isError={drillDownMutation.isError}
          data={drillDownMutation.data}
          resolveUserName={(userId) => userNames[userId] ?? userId}
        />
      )}
    </div>
  );
}
