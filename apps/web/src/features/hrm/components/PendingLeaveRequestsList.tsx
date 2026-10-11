import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { CheckIcon, XIcon } from '@/components/ui/Icons';
import { formatDate, calculateWorkingDays } from '@/lib/utils';
import type { LeaveRequest, User } from '@/types';
import { LeaveTypeBadge, LeaveStatusBadge, parseLeaveReason } from './leave-shared';
import { EmployeeHistoryPicker } from './EmployeeHistoryPicker';

interface PendingLeaveItemProps {
  request: LeaveRequest;
  userNameMap: Record<string, string>;
  rowAction?: 'approve' | 'reject';
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const PendingLeaveItem = React.memo(function PendingLeaveItem({
  request,
  userNameMap,
  rowAction,
  onApprove,
  onReject,
}: PendingLeaveItemProps) {
  const { t } = useTranslation();
  const isRowBusy = rowAction !== undefined;
  const days = calculateWorkingDays(request.startDate, request.endDate);
  const employeeName = userNameMap[request.userId] || t('hrm:leaveRequestsPage.pending.unknownEmployee');
  const { rawType, leaveType, cleanReason } = parseLeaveReason(request.reason, t);

  return (
    <div
      key={request.id}
      className="rounded-radius-md rounded-lg border border-border-subtle bg-bg-surface p-3.5 transition-colors hover:border-border-strong space-y-2"
    >
      {/* Nhân sự */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={employeeName} className="h-6 w-6 text-[10px] bg-[#E4EFEE] text-[#0E5E5E] shrink-0 font-semibold" />
          <Link
            to={`/leave-requests/${request.userId}`}
            className="text-[13px] font-medium text-text-primary hover:text-accent truncate"
          >
            {employeeName}
          </Link>
        </div>
      </div>

      {/* Dòng 1: Dải ngày mono 13/500 text-primary + • + {n} ngày mono 12/400 text-secondary */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-mono text-[12px] font-medium text-text-primary tabular-nums">
          {formatDate(request.startDate)} – {formatDate(request.endDate)}
        </span>
        {days > 0 && (
          <>
            <span className="text-text-secondary">•</span>
            <span className="font-mono text-[11px] font-normal text-text-secondary tabular-nums">
              {t('hrm:leaveRequestsPage.daysCount', { count: days })}
            </span>
          </>
        )}
      </div>

      {/* Dòng 2: Badge loại nghỉ (§4) */}
      {leaveType && (
        <div className="flex items-center gap-2 flex-wrap">
          <LeaveTypeBadge rawType={rawType} label={leaveType} />
        </div>
      )}

      {/* Dòng 3: Lý do 13/400 text-secondary italic */}
      {cleanReason && (
        <p className="text-[12px] font-normal text-text-secondary italic line-clamp-2" title={cleanReason}>
          {cleanReason}
        </p>
      )}

      {/* Nút action Pending */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-subtle">
        <button
          type="button"
          onClick={() => onReject(request.id)}
          disabled={isRowBusy}
          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-radius-sm text-[12px] font-medium text-[#B3261E] hover:bg-[#F8E5E3] transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <XIcon className="h-3 w-3" />
          <span>{t('hrm:leaveRequestsPage.pending.reject')}</span>
        </button>
        <button
          type="button"
          onClick={() => onApprove(request.id)}
          disabled={isRowBusy}
          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
        >
          <CheckIcon className="h-3 w-3" />
          <span>{t('hrm:leaveRequestsPage.pending.approve')}</span>
        </button>
      </div>
    </div>
  );
});

export interface PendingLeaveRequestsListProps {
  canViewEmployeeHistory: boolean;
  canApprove: boolean;
  orgUsers: User[];
  onSelectEmployee: (userId: string) => void;
  pendingRequests: LeaveRequest[];
  userNameMap: Record<string, string>;
  pendingActions: Record<string, 'approve' | 'reject'>;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function PendingLeaveRequestsList({
  canViewEmployeeHistory,
  canApprove,
  orgUsers,
  onSelectEmployee,
  pendingRequests,
  userNameMap,
  pendingActions,
  onApprove,
  onReject,
}: PendingLeaveRequestsListProps) {
  const { t } = useTranslation();

  if (!canViewEmployeeHistory && !canApprove) return null;

  return (
    /* Khối 2: Gộp chung 1 Card: Header/Top là Tra cứu lịch sử, phần dưới là Danh sách Chờ duyệt */
    <div className="rounded-radius-md border border-border-subtle bg-white p-4 space-y-4">
      {/* Header/Top: Tra cứu lịch sử theo nhân viên */}
      {canViewEmployeeHistory && (
        <div className="space-y-2">
          <h2 className="text-[14px] font-semibold text-text-primary">
            {t('hrm:employeePicker.label')}
          </h2>
          <EmployeeHistoryPicker users={orgUsers} onSelect={onSelectEmployee} />
        </div>
      )}

      {/* Phần dưới: Danh sách Chờ duyệt */}
      {canApprove && (
        <div className={`space-y-3 ${canViewEmployeeHistory ? 'pt-3 border-t border-border-subtle' : ''}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-text-primary">
              {t('hrm:leaveRequestsPage.pending.cardTitle', { count: pendingRequests.length })}
            </h2>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-radius-sm border border-dashed border-border-subtle p-5 text-center text-[12px] font-normal text-text-tertiary">
              {t('hrm:leaveRequestsPage.pending.emptyMessage')}
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <PendingLeaveItem
                  key={request.id}
                  request={request}
                  userNameMap={userNameMap}
                  rowAction={pendingActions[request.id]}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

