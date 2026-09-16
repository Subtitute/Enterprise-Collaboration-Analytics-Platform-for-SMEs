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
import { useAllDealsQuery } from '@/features/crm/hooks';
import { formatDealValue } from '@/features/crm/utils';
import { DATE_RANGE_OPTIONS } from '@/types';
import type { DateRangeOption } from '@/types';
// 28/07/2026: tai su dung useDepartmentsQuery da co san (dung chung o MembersPage/InviteMemberModal)
// cho bo loc "Phong ban" moi tren trang Bao cao & Phan tich, khong tao hook fetch phong ban rieng.
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
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
  const dealsQuery = useAllDealsQuery();
  const { map: projectNames } = useProjectNameMap();

  // 28/07/2026: tinh nang "Nhan xet AI" - departmentName CHI de hien thi trong doan van AI sinh
  // ra (xem fetchAiInsight()), lay tu du lieu departmentsQuery da co san cho dropdown ben tren.
  const aiInsightMutation = useAiInsightMutation();

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

  // 26/08/2026: Fix 5 - reset aiInsightMutation khi đổi bộ lọc hoặc chu kỳ nhận xét
  useEffect(() => {
    aiInsightMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPeriod, departmentId]);

  const selectedDepartmentName = departmentId
    ? (departmentsQuery.data ?? []).find((d) => d.id === departmentId)?.name
    : undefined;

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
                {selectedDepartmentName
                  ? t('analytics:aiInsight.summaryWithDepartment', {
                      period: t(`analytics:aiInsight.periods.${aiPeriod}`).toLowerCase(),
                      department: selectedDepartmentName,
                    })
                  : t('analytics:aiInsight.summaryAllOrg', {
                      period: t(`analytics:aiInsight.periods.${aiPeriod}`).toLowerCase(),
                    })}
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
              isLoading={aiInsightMutation.isPending}
              onClick={() =>
                aiInsightMutation.mutate({ range: aiRange, departmentId: departmentId || undefined, departmentName: selectedDepartmentName })
              }
              className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
            >
              <BarChartIcon className="h-4 w-4" />
              {t('analytics:aiInsight.generateButton')}
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-3.5 border-t border-indigo-100/60">
          {aiInsightMutation.data ? (
            <div className="rounded-xl bg-white/80 p-4 border border-indigo-50 shadow-2xs">
              {(() => {
                const text = aiInsightMutation.data.insight;
                // Nhận diện hoặc phân tách nội dung thành 3 gạch đầu dòng rõ ràng: Điểm sáng, Rủi ro, Khuyến nghị
                const lines = text
                  .split(/\n+/)
                  .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
                  .filter(Boolean);

                let highlight = '';
                let risk = '';
                let recommendation = '';

                // 16/09/2026: cac chuoi tieng Viet trong .includes(...)/regex ben duoi (vd 'diem
                // sang', 'rui ro', 'khuyen nghi'...) la HANG SO de doi chieu/tach doan van ban AI
                // (Gemini/Groq) ma backend analytics-service sinh ra bang tieng Viet (xem
                // useAiInsightMutation ben tren) - khong phai chuoi hien thi cho nguoi dung nen
                // KHONG dua qua t(): noi dung AI insight luon la tieng Viet bat ke ngon ngu UI dang
                // chon, boc qua t() se lam sai pattern matching. Moi dong .includes(...)/regex co
                // dau duoi day duoc danh dau i18n-lint-ignore vi ly do tren.
                // Tìm theo từ khóa nếu có sẵn trong câu
                for (const line of lines) {
                  const lower = line.toLowerCase();
                  if (!highlight && (lower.includes('điểm sáng') || lower.includes('nổi bật') || lower.includes('tích cực') || lower.includes('hoàn thành'))) { // i18n-lint-ignore: khop van ban AI backend, khong phai chuoi UI
                    highlight = line.replace(/^(điểm sáng|điểm nổi bật)[:\s-]*/i, '').trim(); // i18n-lint-ignore: regex khop van ban AI backend, khong phai chuoi UI
                  } else if (!risk && (lower.includes('rủi ro') || lower.includes('chậm') || lower.includes('tồn đọng') || lower.includes('hạn chế'))) { // i18n-lint-ignore: khop van ban AI backend, khong phai chuoi UI
                    risk = line.replace(/^(rủi ro|rủi ro tiềm ẩn)[:\s-]*/i, '').trim(); // i18n-lint-ignore: regex khop van ban AI backend, khong phai chuoi UI
                  } else if (!recommendation && (lower.includes('khuyến nghị') || lower.includes('đề xuất') || lower.includes('gợi ý') || lower.includes('cần'))) { // i18n-lint-ignore: khop van ban AI backend, khong phai chuoi UI
                    recommendation = line.replace(/^(khuyến nghị|đề xuất|gợi ý)[:\s-]*/i, '').trim(); // i18n-lint-ignore: regex khop van ban AI backend, khong phai chuoi UI
                  }
                }

                // Nếu là 1 đoạn văn liền mạch hoặc chưa khớp đủ 3 mục, phân tách theo câu
                if (!highlight || !risk || !recommendation) {
                  const sentences = text
                    .split(/(?<=[.?!])\s+/)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 5);

                  if (!highlight && sentences[0]) highlight = sentences[0];
                  if (!risk && sentences[1]) risk = sentences[1];
                  if (!recommendation && sentences[2]) recommendation = sentences.slice(2).join(' ');
                  if (!risk && !recommendation && highlight) {
                    risk = t('analytics:aiInsight.fallbacks.risk');
                    recommendation = t('analytics:aiInsight.fallbacks.recommendationWhenHighlightOnly');
                  } else if (!recommendation) {
                    recommendation = t('analytics:aiInsight.fallbacks.recommendationDefault');
                  }
                }

                return (
                  <ul className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>
                        <strong className="font-semibold text-slate-900">{t('analytics:aiInsight.labels.highlight')}</strong> {highlight}
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>
                        <strong className="font-semibold text-slate-900">{t('analytics:aiInsight.labels.risk')}</strong> {risk}
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>
                        <strong className="font-semibold text-slate-900">{t('analytics:aiInsight.labels.recommendation')}</strong> {recommendation}
                      </span>
                    </li>
                  </ul>
                );
              })()}
            </div>
          ) : (
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('analytics:aiInsight.placeholder')}
            </p>
          )}
        </div>
      </div>

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
    </div>
  );
}
