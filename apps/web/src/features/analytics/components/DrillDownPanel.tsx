import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { STATUS } from '@/lib/chart-colors';
import type { DrillDownResult } from '@/types';

interface DrillDownPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  isLoading: boolean;
  isError: boolean;
  data: DrillDownResult | null | undefined;
  resolveUserName: (userId: string) => string;
}

function FunnelStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold" style={{ color: color ?? '#0f172a' }}>
        {value}
      </p>
    </div>
  );
}

/**
 * 24/09/2026: Layer 2 Diagnostic - hien thi phau "Tong -> Chua xong -> Qua han -> Tap trung o 1
 * nguoi" cho 1 phong ban/du an cu the (bam vao 1 thanh AiInsightsChart.tsx se mo panel nay). Tai
 * su dung Modal.tsx co san (khong tu xay slide-over rieng) - xem AnalyticsPage.tsx noi goi.
 */
export function DrillDownPanel({ open, onClose, title, isLoading, isError, data, resolveUserName }: DrillDownPanelProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {!isLoading && isError && <p className="text-sm text-rose-600">{t('analytics:drillDown.error')}</p>}
      {!isLoading && !isError && data && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">{t('analytics:drillDown.description')}</p>

          <div className="grid grid-cols-3 gap-3">
            <FunnelStat label={t('analytics:drillDown.totalTasks')} value={data.totalTasks} />
            <FunnelStat label={t('analytics:drillDown.notDoneTasks')} value={data.notDoneTasks} color={STATUS.warning} />
            <FunnelStat label={t('analytics:drillDown.overdueTasks')} value={data.overdueTasks} color={STATUS.critical} />
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('analytics:drillDown.topAssignee')}
            </p>
            {data.topAssignee ? (
              <div className="flex items-center gap-2.5">
                <Avatar name={resolveUserName(data.topAssignee.userId)} size="sm" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{resolveUserName(data.topAssignee.userId)}</p>
                  <p className="text-xs text-slate-500">
                    {t('analytics:drillDown.topAssigneeCount', { count: data.topAssignee.notDoneTaskCount })}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">{t('analytics:drillDown.noTopAssignee')}</p>
            )}
          </div>

          <p className="text-[11px] leading-snug text-slate-400">{t('analytics:drillDown.dueDateLimitationNote')}</p>
        </div>
      )}
    </Modal>
  );
}
