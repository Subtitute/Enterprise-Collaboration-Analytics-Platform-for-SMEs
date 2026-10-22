import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate, formatTime } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { CheckIcon, XIcon, FileTextIcon } from '@/components/ui/Icons';
import type { AttendanceAdjustment } from '@/types';

// 22/09/2026: `userName` khong ton tai tren AttendanceAdjustment (du lieu that tu hrm-service,
// khong luu ten cross-service) - AttendancePage.tsx tu resolve qua useUserNameMap() roi enrich
// truoc khi truyen xuong day (mirror cach cac trang khac lam voi userId cross-service).
interface PendingAdjustmentsListProps {
  adjustments: (AttendanceAdjustment & { userName: string })[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function PendingAdjustmentsList({
  adjustments,
  onApprove,
  onReject,
}: PendingAdjustmentsListProps) {
  const { t } = useTranslation();

  if (adjustments.length === 0) {
    return (
      <EmptyState
        icon={<FileTextIcon className="h-6 w-6 text-slate-400" />}
        title={t('hrm:extensions.adjustment.emptyTitle')}
        description={t('hrm:extensions.adjustment.emptyDescription')}
        className="my-4 border-slate-100 bg-slate-50/50"
      />
    );
  }

  return (
    <div className="space-y-3">
      {adjustments.map((adj) => {
        // 22/09/2026: du lieu that tu server la TIMESTAMPTZ (JSON hoa thanh ISO UTC, vd
        // "...T01:00:00.000Z" cho 08:00 GMT+7) - PHAI quy doi qua formatTime() (Asia/Ho_Chi_Minh),
        // khong con dung .slice(11,16) tho nhu truoc (chi dung voi chuoi localStorage cu da tu gan
        // san hau to "+07:00", se hien SAI gio neu dung lai voi du lieu that).
        const proposedIn = formatTime(adj.proposedCheckInAt);
        const proposedOut = formatTime(adj.proposedCheckOutAt);
        const origIn = formatTime(adj.originalCheckInAt);
        const origOut = formatTime(adj.originalCheckOutAt);

        return (
          <div
            key={adj.id}
            className="p-3.5 rounded-xl border border-[#E5E4E0] bg-white space-y-2.5 transition-all hover:border-[#0E5E5E]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={adj.userName} size="sm" className="h-7 w-7 text-[10px]" />
                <div className="min-w-0">
                  <span className="font-bold text-xs text-slate-900 block truncate">{adj.userName}</span>
                  <span className="text-[10px] text-slate-400 block">{formatDate(adj.workDate)}</span>
                </div>
              </div>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                {t('hrm:extensions.adjustment.badge.pending')}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px]">
                  {t('hrm:extensions.adjustment.originalLabel')}
                </span>
                <span className="font-mono text-slate-600">{origIn} → {origOut}</span>
              </div>
              <div>
                <span className="text-[#0E5E5E] block text-[10px] font-semibold">
                  {t('hrm:extensions.adjustment.proposedLabel')}
                </span>
                <span className="font-mono font-bold text-[#0E5E5E]">{proposedIn} → {proposedOut}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-100 italic">
              &ldquo;{adj.reason}&rdquo;
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onReject(adj.id)}
                className="text-xs h-7 px-2.5 text-rose-600 hover:bg-rose-50 border-rose-200"
              >
                <XIcon className="h-3 w-3 mr-1" />
                {t('hrm:extensions.adjustment.rejectButton')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onApprove(adj.id)}
                className="text-xs h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckIcon className="h-3 w-3 mr-1" />
                {t('hrm:extensions.adjustment.approveButton')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
