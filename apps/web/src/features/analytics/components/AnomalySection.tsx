import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { AlertCircleIcon } from '@/components/ui/Icons';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import type { AnomaliesResult, AnomalyItem, DateRangeOption } from '@/types';

function formatDeviationValue(item: AnomalyItem['topDeviation']): string {
  return item.metric === 'overdueTasks' ? `${item.value}` : `${item.value}%`;
}

function formatTeamAverage(item: AnomalyItem['topDeviation']): string {
  return item.metric === 'overdueTasks' ? `${item.teamAverage}` : `${item.teamAverage}%`;
}

/**
 * 24/09/2026: Layer 3 Anomaly Detection - khoi moi tren trang Bao cao & Phan tich, nut bam THEO
 * YEU CAU (khong tu goi) - mirror dung UX khoi "Tro ly phan tich noi bo" (AiInsightsChart) da co.
 * Goi that apps/ml-service (scikit-learn IsolationForest that, khong phai heuristic gia lap).
 *
 * 24/09/2026: `mutation` duoc AnalyticsPage.tsx so huu va truyen xuong (thay vi tu goi
 * useAnomaliesMutation() o day) - Layer 5 (Ke hoach hanh dong trong AiInsightCard.tsx) can doc
 * duoc ket qua quet bat thuong gan nhat tu cung 1 cap component cha.
 */
export function AnomalySection({
  range,
  mutation,
}: {
  range: DateRangeOption;
  mutation: UseMutationResult<AnomaliesResult, unknown, DateRangeOption, unknown>;
}) {
  const { t } = useTranslation();
  const { map: userNames } = useUserNameMap();
  const permissions = usePermissions();

  // 24/09/2026: an han khoi nay neu nguoi dung khong co ml:view (vd Org Admin da tuy chinh go bo
  // quyen nay khoi role qua trang Vai trò & Quyền) - tranh hien 1 nut chi de dan toi loi 403.
  if (!permissions.includes(PERMISSIONS.ML_VIEW)) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t('analytics:anomaly.title')}</CardTitle>
            <p className="mt-0.5 text-xs text-slate-500">{t('analytics:anomaly.subtitle')}</p>
          </div>
          <Button size="sm" isLoading={mutation.isPending} onClick={() => mutation.mutate(range)}>
            {t('analytics:anomaly.runButton')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!mutation.data && !mutation.isPending && !mutation.isError && (
          <p className="text-xs text-slate-500 leading-relaxed">{t('analytics:anomaly.placeholder')}</p>
        )}

        {mutation.data && (
          <div className="space-y-3">
            {mutation.data.anomalies.length === 0 ? (
              <p className="text-sm text-emerald-700">
                {t('analytics:anomaly.noAnomalies', { count: mutation.data.sampleSize })}
              </p>
            ) : (
              mutation.data.anomalies.map((item) => (
                <div
                  key={item.userId}
                  className="flex items-center gap-3 rounded-xl border border-rose-200/70 bg-rose-50/50 p-3"
                >
                  <Avatar name={userNames[item.userId] ?? item.userId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {userNames[item.userId] ?? item.userId}
                    </p>
                    <p className="text-xs text-rose-700">
                      {t(`analytics:anomaly.metricLabels.${item.topDeviation.metric}`)}{' '}
                      {formatDeviationValue(item.topDeviation)} {item.topDeviation.direction === 'down' ? '↓' : '↑'}{' '}
                      {t('analytics:anomaly.teamAverageLabel', { value: formatTeamAverage(item.topDeviation) })}
                    </p>
                  </div>
                  <AlertCircleIcon className="h-4 w-4 shrink-0 text-rose-500" />
                </div>
              ))
            )}
            <p className="text-[11px] text-slate-400">
              {t('analytics:anomaly.sampleSizeNote', { count: mutation.data.sampleSize })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
