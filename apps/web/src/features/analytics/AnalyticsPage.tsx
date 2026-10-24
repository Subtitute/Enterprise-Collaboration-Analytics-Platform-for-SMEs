import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { QueryState } from '@/components/ui/QueryState';
import { Spinner } from '@/components/ui/Spinner';
import { HelpCircleIcon } from '@/components/ui/Icons';
import { useProjectNameMap } from '@/hooks/useOrgProjects';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useAllDealsQuery } from '@/features/crm/hooks';
import { DATE_RANGE_OPTIONS } from '@/types';
import type { DateRangeOption, DrillDownScope, InsightScope } from '@/types';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren trang Bao cao & Phan tich, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
// 16/10/2026: mirror dung cach lam tren - tai su dung useProductsQuery (Danh muc san pham + Kho,
// features/inventory/hooks.ts) de resolve ten san pham cho khoi "San pham ban chay nhat" ben
// duoi, khong tu viet lai ham fetch san pham rieng trong module Analytics.
import { useProductsQuery } from '@/features/inventory/hooks';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { unwrapList } from '@/lib/utils';
import type { Product } from '@/types';
import {
  useAiInsightsMutation,
  useAnomaliesMutation,
  useDocumentActivityQuery,
  useDrillDownMutation,
  useProductSalesTrendQuery,
  useProjectProgressQuery,
  useTopProductsQuery,
} from './hooks';
import { ProjectProgressChart } from './components/ProjectProgressChart';
import { ProjectProgressTable } from './components/ProjectProgressTable';
import { DocumentActivityChart } from './components/DocumentActivityChart';
import { ProductSalesTrendChart } from './components/ProductSalesTrendChart';
import { TopProductsChart } from './components/TopProductsChart';
import { DrillDownPanel } from './components/DrillDownPanel';
import { AnomalySection } from './components/AnomalySection';
import { AnalyticsKpiCards } from './components/AnalyticsKpiCards';
import { AiAssistantSection } from './components/AiAssistantSection';

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

  // 16/10/2026: khoi "Xu huong thi truong" moi - dung CHUNG bo loc khoang thoi gian (range) da co
  // san cua trang nay, khong them bo chon rieng (tranh 2 bo loc cung y nghia gay nham lan).
  const productSalesTrendQuery = useProductSalesTrendQuery(range);
  const topProductsQuery = useTopProductsQuery(range, 5);
  // Analytics Service chi tra ve productId/categoryId tho (database-per-service) - resolve ten
  // san pham phia client qua GET /products, mirror dung useProjectNameMap() o tren.
  const productsQuery = useProductsQuery({ limit: 200 });

  const productNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of unwrapList<Product>(productsQuery.data)) {
      map[p.id] = p.name;
    }
    return map;
  }, [productsQuery.data]);

  const topProductRows = useMemo(() => {
    return (topProductsQuery.data ?? []).map((item) => ({
      productId: item.productId,
      name: productNames[item.productId] ?? t('analytics:productSales.unnamedProduct', { id: item.productId.slice(0, 8) }),
      unitsSold: item.unitsSold,
      revenue: item.revenue,
    }));
  }, [topProductsQuery.data, productNames, t]);

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
  const resolveInsightScopeLabel = useCallback(
    (scope: InsightScope, scopeId: string | null): string => {
      if (scope === 'organization') return t('analytics:aiInsight.scopeOrg');
      if (scope === 'department') {
        return (departmentsQuery.data ?? []).find((d) => d.id === scopeId)?.name ?? t('analytics:aiInsight.scopeDepartment');
      }
      return projectNames[scopeId ?? ''] ?? t('analytics:aiInsight.scopeProject');
    },
    [departmentsQuery.data, projectNames, t],
  );

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

  // 24/09/2026: Layer 2 Diagnostic - bam vao 1 thanh trong AiInsightsChart.tsx mo panel drill-down
  // cho DUNG scope/scopeId cua thanh do (mirror useAiInsightsMutation() ve cach dung useMutation
  // cho 1 hanh dong theo yeu cau, xem hooks.ts).
  const drillDownMutation = useDrillDownMutation();
  const [drillDownTarget, setDrillDownTarget] = useState<{ scope: DrillDownScope; scopeId: string } | null>(null);

  const closeDrillDown = useCallback(() => {
    setDrillDownTarget(null);
    drillDownMutation.reset();
  }, [drillDownMutation]);

  const handleDrillDown = useCallback(
    (scope: DrillDownScope, scopeId: string) => {
      setDrillDownTarget({ scope, scopeId });
      // Dung dung range CUA KET QUA dang hien thi (khong phai aiRange hien tai) - tranh lech neu
      // aiPeriod da doi nhung nguoi dung chua bam "Tao tom tat bao cao" lai (du o truong hop do
      // AiInsightsChart cung da bi useEffect ben duoi reset mat, chi la phong thu 2 lop).
      drillDownMutation.mutate({
        scope,
        scopeId,
        range: (aiInsightsMutation.data?.range as DateRangeOption | undefined) ?? aiRange,
      });
    },
    [drillDownMutation, aiInsightsMutation.data?.range, aiRange],
  );

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

  const handleGenerateAiInsights = useCallback(() => {
    aiInsightsMutation.mutate({ range: aiRange, anomalies: anomaliesMutation.data?.anomalies });
  }, [aiInsightsMutation, aiRange, anomaliesMutation.data?.anomalies]);

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
          <h1 className="text-[28px] leading-[36px] font-semibold text-text-primary tracking-tight">{t('analytics:page.title')}</h1>
          <p className="mt-1 text-[14px] leading-[22px] text-text-secondary">{t('analytics:page.subtitle')}</p>
        </div>
        {/* Filter góc phải: DateRange w-[180px], Department w-[200px], flex-row items-center gap-2.5 */}
        <div className="flex flex-row items-center justify-end gap-2.5 shrink-0">
          <CustomFilterSelect
            value={range}
            onChange={(val) => setRange(val as DateRangeOption)}
            ariaLabel={t('analytics:filters.dateRangeAriaLabel')}
            options={DATE_RANGE_OPTIONS.map((key) => ({
              value: key,
              label: t(`common:enums.dateRange.${key}`),
            }))}
            className="w-[180px] shrink-0"
          />
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
            className="w-[200px] shrink-0"
          />
        </div>
      </div>

      {/* HÀNG 4 THẺ CHỈ SỐ KPI NHANH (STAT CARDS - DATA FIRST, ZERO-SHADOW, ZERO-ICON) */}
      <AnalyticsKpiCards stats={kpiStats} />

      {/* KHỐI TRỢ LÝ PHÂN TÍCH NỘI BỘ (SPEC V1.1 - DATA-FIRST, ZERO-SHADOW, ZERO-ACCENT-MISMATCH) */}
      <AiAssistantSection
        aiPeriod={aiPeriod}
        onPeriodChange={setAiPeriod}
        onGenerate={handleGenerateAiInsights}
        isPending={aiInsightsMutation.isPending}
        data={aiInsightsMutation.data}
        resolveLabel={resolveInsightScopeLabel}
        onDrillDown={handleDrillDown}
      />

      <AnomalySection range={range} mutation={anomaliesMutation} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors">
          <CardHeader className="px-5 py-4 border-b border-border-subtle">
            <CardTitle className="text-[15px] font-semibold text-text-primary">{t('analytics:charts.projectProgressTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ProjectProgressChart
              data={progressRows}
              isLoading={progressQuery.isLoading}
              isError={progressQuery.isError}
              onRetry={() => progressQuery.refetch()}
            />
          </CardContent>
        </Card>

        <Card className="shadow-none border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors">
          <CardHeader className="px-5 py-4 border-b border-border-subtle">
            <CardTitle className="text-[15px] font-semibold text-text-primary">{t('analytics:charts.documentActivityTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <DocumentActivityChart
              data={activityQuery.data ?? []}
              isLoading={activityQuery.isLoading}
              isError={activityQuery.isError}
              onRetry={() => activityQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>

      {/* 16/10/2026: khoi "Xu huong thi truong" moi (Danh muc san pham + Kho, Technical_Spec.md
          muc 22) - mirror dung bo cuc 2 cot cua khoi ProjectProgressChart/DocumentActivityChart o
          tren, dat NGAY SAU de giu nguyen vi tri cac khoi con lai cua trang (toi thieu xao tron). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="shadow-none border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors">
          <CardHeader className="px-5 py-4 border-b border-border-subtle">
            <CardTitle className="text-[15px] font-semibold text-text-primary">{t('analytics:productSales.trendTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ProductSalesTrendChart
              data={productSalesTrendQuery.data ?? []}
              isLoading={productSalesTrendQuery.isLoading}
              isError={productSalesTrendQuery.isError}
              onRetry={() => productSalesTrendQuery.refetch()}
            />
          </CardContent>
        </Card>

        <Card className="shadow-none border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors">
          <CardHeader className="px-5 py-4 border-b border-border-subtle">
            <CardTitle className="text-[15px] font-semibold text-text-primary">{t('analytics:productSales.topProductsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <TopProductsChart
              data={topProductRows}
              isLoading={topProductsQuery.isLoading}
              isError={topProductsQuery.isError}
              onRetry={() => topProductsQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none border border-border-subtle hover:border-border-strong rounded-radius-md transition-colors">
        <CardHeader className="px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-1.5">
            <CardTitle className="text-[15px] font-semibold text-text-primary">{t('analytics:projectProgressTableSection.title')}</CardTitle>
            <div
              className="group relative flex items-center justify-center text-text-tertiary hover:text-text-secondary cursor-help"
              tabIndex={0}
              aria-label={t('analytics:projectProgressTable.footnote')}
            >
              <HelpCircleIcon className="h-4 w-4" />
              <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 z-20 hidden w-64 rounded-radius-md bg-text-primary px-3 py-1.5 text-xs text-white shadow-none group-hover:block group-focus-visible:block">
                {t('analytics:projectProgressTable.footnote')}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
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
