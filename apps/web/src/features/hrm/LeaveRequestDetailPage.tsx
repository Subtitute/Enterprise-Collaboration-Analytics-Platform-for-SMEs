import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { ChevronLeftIcon } from '@/components/ui/Icons';
import { formatDate, calculateWorkingDays } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { useEmployeeLeaveRequestsQuery } from './hooks';
import { parseLeaveReason, LeaveTypeBadge, LeaveStatusBadge } from './LeaveRequestsPage';

/**
 * 03/10/2026: trang chi tiet lich su nghi phep cua 1 nhan vien (/leave-requests/:userId) - CHI
 * Manager/Org Admin (PERMISSIONS.LEAVE_REQUEST_VIEW). Final Spec v1.1 §6.
 */
export default function LeaveRequestDetailPage() {
  const { t } = useTranslation();
  const { userId = '' } = useParams<{ userId: string }>();
  const permissions = usePermissions();
  const canView = permissions.includes(PERMISSIONS.LEAVE_REQUEST_VIEW);

  const leaveRequestsQuery = useEmployeeLeaveRequestsQuery(userId, { enabled: canView });
  const { map: userNameMap } = useUserNameMap();

  if (!canView) return <Navigate to="/leave-requests" replace />;

  const requests = leaveRequestsQuery.data?.data ?? [];
  const employeeName = userNameMap[userId] ?? userId;

  return (
    <div className="space-y-5">
      {/* Back link: chevron-left + Quay lại Nghỉ phép 13/400 text-secondary */}
      <Link
        to="/leave-requests"
        className="inline-flex items-center gap-1.5 text-[13px] font-normal text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        <span>{t('hrm:leaveRequestDetailPage.backLink')}</span>
      </Link>

      {/* Khung trắng: avatar 32 accent-soft + Lịch sử nghỉ phép của {name} 18/600 text-primary */}
      <div className="flex items-center gap-3 rounded-radius-md border border-border-subtle bg-white p-4">
        <Avatar name={employeeName} className="h-8 w-8 text-xs bg-[#E4EFEE] text-[#0E5E5E] font-semibold shrink-0" />
        <h1 className="min-w-0 truncate text-[18px] leading-[26px] font-semibold text-text-primary">
          {t('hrm:leaveRequestDetailPage.title', { name: employeeName })}
        </h1>
      </div>

      {/* Khung lớn: title Danh sách yêu cầu nghỉ phép 15/600 */}
      <div className="rounded-radius-md border border-border-subtle bg-white p-4 space-y-4">
        <h2 className="text-[15px] font-semibold text-text-primary">
          {t('hrm:leaveRequestDetailPage.listTitle')}
        </h2>

        <QueryState
          isLoading={leaveRequestsQuery.isLoading}
          isError={leaveRequestsQuery.isError}
          onRetry={() => leaveRequestsQuery.refetch()}
          loadingFallback={<FullPageSpinner label={t('hrm:leaveRequestDetailPage.loading')} />}
          errorTitle={t('hrm:leaveRequestDetailPage.errorTitle')}
          errorDescription={t('hrm:leaveRequestDetailPage.errorDescription')}
        >
          {requests.length === 0 ? (
            /* Empty: khung dashed border-subtle, padding 40, căn giữa. */
            <div className="rounded-radius-md border border-dashed border-border-subtle p-10 text-center space-y-1">
              <p className="text-[15px] font-medium text-text-primary">
                {t('hrm:leaveRequestDetailPage.emptyTitle')}
              </p>
              <p className="text-[13px] font-normal text-text-secondary">
                {t('hrm:leaveRequestDetailPage.emptyDescription')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const days = calculateWorkingDays(request.startDate, request.endDate);
                const { rawType, leaveType, cleanReason } = parseLeaveReason(request.reason, t);

                return (
                  <div
                    key={request.id}
                    className="rounded-radius-md border border-border-subtle bg-bg-surface p-4 transition-colors hover:border-border-strong space-y-2"
                  >
                    {/* Dòng 1: dải ngày mono 13/500 text-primary + • + {n} ngày mono 12/400 text-secondary */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[13px] font-medium text-text-primary tabular-nums">
                        {formatDate(request.startDate)} – {formatDate(request.endDate)}
                      </span>
                      {days > 0 && (
                        <>
                          <span className="text-text-secondary">•</span>
                          <span className="font-mono text-[12px] font-normal text-text-secondary tabular-nums">
                            {t('hrm:leaveRequestsPage.daysCount', { count: days })}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Dòng 2: Badge loại nghỉ (§4) + badge trạng thái (§5), gap 8 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <LeaveTypeBadge rawType={rawType} label={leaveType} />
                      <LeaveStatusBadge
                        status={request.status}
                        label={t(`hrm:enums.leaveRequestStatus.${request.status}`)}
                      />
                    </div>

                    {/* Dòng 3: lý do 13/400 text-secondary italic */}
                    {cleanReason && (
                      <p className="text-[13px] font-normal text-text-secondary italic line-clamp-2" title={cleanReason}>
                        {cleanReason}
                      </p>
                    )}
                    {request.decisionNote && (
                      <p className="text-[12px] italic text-text-tertiary">
                        {t('hrm:leaveRequestsPage.myRequests.decisionNote', { note: request.decisionNote })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </QueryState>
      </div>
    </div>
  );
}
