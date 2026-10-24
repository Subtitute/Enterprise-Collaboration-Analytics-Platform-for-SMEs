import React from 'react';
import { useTranslation } from 'react-i18next';
import { EditIcon } from '@/components/ui/Icons';

export interface LeaveBalanceInfo {
  year: number;
  usedDays: number;
  entitledDays: number;
  seniorityBonusDays: number;
  remainingDays: number;
}

export interface LeaveBalanceCardProps {
  leaveBalance: LeaveBalanceInfo | null;
  canManagePolicy: boolean;
  onOpenPolicyModal: () => void;
  seniorityYearsPerBonusDay?: number;
}

export const LeaveBalanceCard = React.memo(function LeaveBalanceCard({
  leaveBalance,
  canManagePolicy,
  onOpenPolicyModal,
  seniorityYearsPerBonusDay,
}: LeaveBalanceCardProps) {
  const { t } = useTranslation();

  if (!leaveBalance) return null;

  return (
    /* Khối 1: Số dư phép năm. Thu nhỏ gọn gàng (h-auto, padding vừa, số mono ~20-24px) */
    <div className="rounded-radius-md border border-border-subtle bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border-subtle">
        <h2 className="text-[14px] font-semibold text-text-primary">
          {t('hrm:leaveRequestsPage.balance.cardTitle', { year: leaveBalance.year })}
        </h2>
        {canManagePolicy && (
          <button
            type="button"
            onClick={onOpenPolicyModal}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 shrink-0 whitespace-nowrap rounded-radius-xs border border-border-strong bg-white hover:bg-bg-subtle text-[11px] font-medium text-text-primary transition-colors cursor-pointer"
          >
            <EditIcon className="h-3 w-3 text-text-secondary shrink-0" />
            <span>{t('hrm:leaveRequestsPage.balance.editPolicyButton')}</span>
          </button>
        )}
      </div>

      {/* 3 cột chỉ số: số mono ~20-24px */}
      <div className="grid grid-cols-3 divide-x divide-border-subtle py-1 text-center">
        <div className="px-1.5">
          <p className="font-mono text-[22px] leading-[28px] font-medium text-text-primary tabular-nums">
            {leaveBalance.entitledDays}
          </p>
          <p className="mt-0.5 text-[11px] font-normal text-text-secondary truncate">
            {t('hrm:leaveRequestsPage.balance.entitledLabel')}
          </p>
        </div>
        <div className="px-1.5">
          <p className="font-mono text-[22px] leading-[28px] font-medium text-text-primary tabular-nums">
            {leaveBalance.usedDays}
          </p>
          <p className="mt-0.5 text-[11px] font-normal text-text-secondary truncate">
            {t('hrm:leaveRequestsPage.balance.usedLabel')}
          </p>
        </div>
        <div className="px-1.5">
          <p
            className={`font-mono text-[22px] leading-[28px] font-medium tabular-nums ${
              leaveBalance.remainingDays < 0 ? 'text-[#B3261E]' : 'text-text-primary'
            }`}
          >
            {leaveBalance.remainingDays}
          </p>
          <p className="mt-0.5 text-[11px] font-normal text-text-secondary truncate">
            {t('hrm:leaveRequestsPage.balance.remainingLabel')}
          </p>
        </div>
      </div>

      {leaveBalance.seniorityBonusDays > 0 && (
        <p className="border-t border-border-subtle pt-2 text-center text-[11px] text-text-tertiary">
          {t('hrm:leaveRequestsPage.balance.seniorityNote', {
            bonusDays: leaveBalance.seniorityBonusDays,
            yearsPerBonus: seniorityYearsPerBonusDay,
          })}
        </p>
      )}
    </div>
  );
});

