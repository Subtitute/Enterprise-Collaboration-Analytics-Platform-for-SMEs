import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeftIcon } from '@/components/ui/Icons';
import { formatDate, calculateWorkingDays } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import type { LeaveRequestStatus } from '@/types';
import { useEmployeeLeaveRequestsQuery } from './hooks';
import { parseLeaveReason } from './LeaveRequestsPage';

const STATUS_BADGE_VARIANT: Record<LeaveRequestStatus, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/**
 * 03/10/2026: trang chi tiet lich su nghi phep cua 1 nhan vien (/leave-requests/:userId) - CHI
 * Manager/Org Admin (PERMISSIONS.LEAVE_REQUEST_VIEW). Mirror AttendanceDetailPage.tsx (cung hop
 * dong moi: GET /leave-requests?userId=... - endpoint DA san co tham so loc nay tu truoc, xem
 * LeaveRequestQueryDto va fetchLeaveRequestsForUser() trong hrm/api.ts) va tai su dung
 * parseLeaveReason() cua LeaveRequestsPage.tsx thay vi chep lai logic tach loai/ly do nghi phep.
 */
export default function LeaveRequestDetailPage() {
  const { t } = useTranslation();
  const { userId = '' } = useParams<{ userId: string }>();
  const permissions = usePermissions();
  const canView = permissions.includes(PERMISSIONS.LEAVE_REQUEST_VIEW);

  const leaveRequestsQuery = useEmployeeLeaveRequestsQuery(userId, { enabled: canView });
  const { map: userNameMap } = useUserNameMap();

  // 03/10/2026: bao ve tang trang (bo sung, khong thay the lop ben ngoai) - mirror
  // AttendanceDetailPage.tsx (xem chu thich tai do ve ly do tu kiem tra o day thay vi chi dua vao
  // ProtectedRoute o App.tsx).
  if (!canView) return <Navigate to="/leave-requests" replace />;

  const requests = leaveRequestsQuery.data?.data ?? [];
  const employeeName = userNameMap[userId] ?? userId;

  return (
    <div className="space-y-5">
      <Link to="/leave-requests" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeftIcon className="h-4 w-4" /> {t('hrm:leaveRequestDetailPage.backLink')}
      </Link>

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
        <Avatar name={employeeName} size="md" />
        <h1 className="min-w-0 truncate text-lg font-semibold text-slate-900">
          {t('hrm:leaveRequestDetailPage.title', { name: employeeName })}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('hrm:leaveRequestDetailPage.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={leaveRequestsQuery.isLoading}
            isError={leaveRequestsQuery.isError}
            onRetry={() => leaveRequestsQuery.refetch()}
            loadingFallback={<FullPageSpinner label={t('hrm:leaveRequestDetailPage.loading')} />}
            errorTitle={t('hrm:leaveRequestDetailPage.errorTitle')}
            errorDescription={t('hrm:leaveRequestDetailPage.errorDescription')}
          >
            {requests.length === 0 ? (
              <EmptyState
                title={t('hrm:leaveRequestDetailPage.emptyTitle')}
                description={t('hrm:leaveRequestDetailPage.emptyDescription')}
              />
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const days = calculateWorkingDays(request.startDate, request.endDate);
                  const { leaveType, cleanReason } = parseLeaveReason(request.reason, t);
                  return (
                    <div
                      key={request.id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-white shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-sm font-semibold text-slate-800">
                          {formatDate(request.startDate)} — {formatDate(request.endDate)}
                          {days > 0 && (
                            <span className="ml-1.5 text-slate-500 font-semibold text-xs sm:text-sm">
                              • {t('hrm:leaveRequestsPage.daysCount', { count: days })}
                            </span>
                          )}
                        </p>
                        {leaveType && (
                          <div className="flex items-center">
                            <span className="inline-flex items-center rounded-md bg-indigo-50/90 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                              {leaveType}
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-slate-500 italic truncate max-w-xl pt-0.5" title={cleanReason}>
                          {cleanReason || '—'}
                        </p>
                        {request.decisionNote && (
                          <p className="mt-1 text-xs italic text-slate-400">
                            {t('hrm:leaveRequestsPage.myRequests.decisionNote', { note: request.decisionNote })}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-2 pt-2 sm:pt-0">
                        <Badge variant={STATUS_BADGE_VARIANT[request.status]} className="w-24 justify-center py-1 text-center font-semibold shrink-0">
                          {t(`hrm:enums.leaveRequestStatus.${request.status}`)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
