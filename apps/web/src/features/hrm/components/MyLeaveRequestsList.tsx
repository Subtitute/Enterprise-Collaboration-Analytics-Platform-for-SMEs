import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, calculateWorkingDays } from '@/lib/utils';
import type { LeaveRequest } from '@/types';
import { LeaveTypeBadge, LeaveStatusBadge, parseLeaveReason } from './leave-shared';
import { useCancelLeaveRequest } from '../hooks';

interface MyLeaveRequestItemProps {
  request: LeaveRequest;
}

const MyLeaveRequestItem = React.memo(function MyLeaveRequestItem({ request }: MyLeaveRequestItemProps) {
  const { t } = useTranslation();
  const cancelMutation = useCancelLeaveRequest();
  const days = calculateWorkingDays(request.startDate, request.endDate);
  const { rawType, leaveType, cleanReason } = parseLeaveReason(request.reason, t);

  return (
    <div
      key={request.id}
      className="rounded-radius-md rounded-lg border border-border-subtle bg-bg-surface p-3.5 transition-colors hover:border-border-strong space-y-2"
    >
      {/* Dòng 1: dải ngày mono 12/500 text-primary + • + {n} ngày mono 11/400 text-secondary */}
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

      {/* Dòng 2: Badge loại nghỉ (§4) + badge trạng thái (§5) + Nút Hủy đơn nếu PENDING */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <LeaveTypeBadge rawType={rawType} label={leaveType} />
          <LeaveStatusBadge
            status={request.status}
            label={t(`hrm:enums.leaveRequestStatus.${request.status}`)}
          />
        </div>
        {request.status === 'PENDING' && (
          <button
            type="button"
            disabled={cancelMutation.isPending}
            onClick={() => {
              if (window.confirm(t('hrm:leaveRequestsPage.myRequests.confirmCancel'))) {
                cancelMutation.mutate(request.id);
              }
            }}
            className="text-[12px] font-medium text-danger hover:underline disabled:opacity-50 cursor-pointer transition-colors"
          >
            {cancelMutation.isPending ? t('common:canceling') : t('hrm:leaveRequestsPage.myRequests.cancelButton')}
          </button>
        )}
      </div>

      {/* Dòng 3: lý do 12/400 text-secondary italic */}
      {cleanReason && (
        <p className="text-[12px] font-normal text-text-secondary italic line-clamp-2" title={cleanReason}>
          {cleanReason}
        </p>
      )}
      {request.decisionNote && (
        <p className="text-[11px] italic text-text-tertiary">
          {t('hrm:leaveRequestsPage.myRequests.decisionNote', { note: request.decisionNote })}
        </p>
      )}
    </div>
  );
});

export interface MyLeaveRequestsListProps {
  allMyRequests: LeaveRequest[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onOpenNew: () => void;
}

export function MyLeaveRequestsList({
  allMyRequests,
  isLoading,
  isError,
  onRetry,
  onOpenNew,
}: MyLeaveRequestsListProps) {
  const { t } = useTranslation();
  // Khối 3: Yêu cầu của tôi. Logic: visibleCount = 3 ban đầu, slice(0, visibleCount), nút Xem thêm (+5 đơn)
  const [visibleCount, setVisibleCount] = useState(3);

  const displayedMyRequests = useMemo(
    () => allMyRequests.slice(0, visibleCount),
    [allMyRequests, visibleCount],
  );
  const hasMoreMyRequests = allMyRequests.length > visibleCount;

  return (
    <div className="rounded-radius-md border border-border-subtle bg-white p-4 space-y-3">
      <h2 className="text-[14px] font-semibold text-text-primary">
        {t('hrm:leaveRequestsPage.myRequests.cardTitle')}
      </h2>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        loadingFallback={<FullPageSpinner label={t('hrm:leaveRequestsPage.myRequests.loading')} />}
        errorTitle={t('hrm:leaveRequestsPage.myRequests.errorTitle')}
        errorDescription={t('hrm:leaveRequestsPage.myRequests.errorDescription')}
      >
        {allMyRequests.length === 0 ? (
          <EmptyState
            title={t('hrm:leaveRequestsPage.myRequests.emptyTitle')}
            description={t('hrm:leaveRequestsPage.myRequests.emptyDescription')}
            action={
              <button
                type="button"
                onClick={onOpenNew}
                className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-radius-sm bg-text-primary text-white text-[12px] font-medium hover:bg-black transition-colors cursor-pointer"
              >
                {t('hrm:leaveRequestsPage.myRequests.createFirstButton')}
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {displayedMyRequests.map((request) => (
              <MyLeaveRequestItem key={request.id} request={request} />
            ))}

            {/* Nút Xem thêm: hiện nếu tổng đơn > visibleCount, bấm tăng +5, hết tự ẩn */}
            {hasMoreMyRequests && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 5)}
                  className="w-full inline-flex items-center justify-center h-8 px-3 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer"
                >
                  {t('hrm:leaveRequestsPage.myRequests.loadMore')}
                </button>
              </div>
            )}
          </div>
        )}
      </QueryState>
    </div>
  );
}

