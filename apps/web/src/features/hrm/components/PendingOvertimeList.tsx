import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { CheckIcon, XIcon, ClockIcon } from '@/components/ui/Icons';
import type { OvertimeRegistration } from '../attendance-extensions.types';

interface PendingOvertimeListProps {
  overtimeList: OvertimeRegistration[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function PendingOvertimeList({
  overtimeList,
  onApprove,
  onReject,
}: PendingOvertimeListProps) {
  const { t } = useTranslation();

  if (overtimeList.length === 0) {
    return (
      <EmptyState
        icon={<ClockIcon className="h-6 w-6 text-slate-400" />}
        title={t('hrm:extensions.overtime.emptyTitle')}
        description={t('hrm:extensions.overtime.emptyDescription')}
        className="my-4 border-slate-100 bg-slate-50/50"
      />
    );
  }

  return (
    <div className="space-y-3">
      {overtimeList.map((ot) => {
        const multLabel =
          ot.multiplierType === 'HOLIDAY'
            ? t('hrm:extensions.overtime.multipliers.holiday')
            : ot.multiplierType === 'WEEKEND'
            ? t('hrm:extensions.overtime.multipliers.weekend')
            : t('hrm:extensions.overtime.multipliers.weekday');

        return (
          <div
            key={ot.id}
            className="p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs space-y-2.5 transition-all hover:border-indigo-200"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={ot.userName} size="sm" className="h-7 w-7 text-[10px]" />
                <div className="min-w-0">
                  <span className="font-bold text-xs text-slate-900 block truncate">{ot.userName}</span>
                  <span className="text-[10px] text-slate-400 block">{formatDate(ot.workDate)}</span>
                </div>
              </div>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                {t('hrm:extensions.overtime.badge.pending')}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px]">
                  {t('hrm:extensions.overtime.timeSlotLabel', 'Khung giờ OT:')}
                </span>
                <span className="font-mono font-bold text-slate-800">{ot.otStart} → {ot.otEnd}</span>
                <span className="text-[10px] text-slate-500 block">({ot.estimatedHours}h)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">
                  {t('hrm:extensions.overtime.multiplierLabelShort', 'Hệ số tính lương:')}
                </span>
                <span className="font-bold text-indigo-700">{multLabel}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100 italic">
              "{ot.reason}"
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onReject(ot.id)}
                className="text-xs h-7 px-2.5 text-rose-600 hover:bg-rose-50 border-rose-200"
              >
                <XIcon className="h-3 w-3 mr-1" />
                {t('hrm:extensions.overtime.rejectButton')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onApprove(ot.id)}
                className="text-xs h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <CheckIcon className="h-3 w-3 mr-1" />
                {t('hrm:extensions.overtime.approveButton')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
