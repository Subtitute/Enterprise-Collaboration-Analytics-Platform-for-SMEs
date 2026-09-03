import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusIcon, CheckIcon, XIcon } from '@/components/ui/Icons';
import { formatDate, calculateWorkingDays } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import type { LeaveRequestStatus } from '@/types';
import { NewLeaveRequestModal } from './components/NewLeaveRequestModal';
import {
  useApproveLeaveRequest,
  useMyLeaveRequestsQuery,
  usePendingLeaveRequestsQuery,
  useRejectLeaveRequest,
} from './hooks';

const STATUS_BADGE_VARIANT: Record<LeaveRequestStatus, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** Tách loại nghỉ phép và lý do thực tế từ chuỗi reason đã lưu (VD: "[Nghỉ phép năm (Có lương)] Lý do...") */
function parseLeaveReason(rawReason?: string | null) {
  if (!rawReason) return { leaveType: null, cleanReason: '' };
  const match = rawReason.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    return {
      leaveType: match[1],
      cleanReason: match[2],
    };
  }
  return {
    leaveType: null,
    cleanReason: rawReason,
  };
}

/** Trang Nghỉ phép (HRM-lite) - Technical_Spec.md muc 17, Wireframe.md muc 13. */
export function LeaveRequestsPage() {
  const { t } = useTranslation();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const myRequestsQuery = useMyLeaveRequestsQuery({ limit: 20 });
  const pendingQuery = usePendingLeaveRequestsQuery();
  const { map: userNameMap } = useUserNameMap();
  const approve = useApproveLeaveRequest();
  const reject = useRejectLeaveRequest();
  // 26/08/2026: sua loi thuc te - `approve`/`reject` chi duoc goi 1 LAN cho ca trang va dung chung
  // cho MOI dong trong danh sach cho duyet, nen `approve.isPending`/`reject.isPending` la trang thai
  // DUNG CHUNG: duyet 1 don se lam nut Duyet/Tu choi cua TAT CA cac dong khac cung disable/quay spin
  // theo, du chung khong lien quan gi den request dang xu ly. Theo doi rieng id cua request dang
  // duoc mutate (`pendingRequestId`) va chi doi chieu isPending voi dong co id trung khop, de moi
  // dong con lai khong bi anh huong.
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  // 403 (khong co PERMISSIONS.LEAVE_REQUEST_VIEW) la ket qua BINH THUONG cho Employee thuong -
  // coi nhu "khong ap dung", KHONG hien banner loi (xem ghi chu tai usePendingLeaveRequestsQuery).
  const canApprove = !pendingQuery.isError && pendingQuery.isSuccess;

  function handleApprove(id: string) {
    setPendingRequestId(id);
    approve.mutate(id, { onSettled: () => setPendingRequestId(null) });
  }

  function handleReject(id: string) {
    setPendingRequestId(id);
    reject.mutate(id, { onSettled: () => setPendingRequestId(null) });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('hrm:leaveRequestsPage.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('hrm:leaveRequestsPage.subtitle')}</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)}>
          <PlusIcon className="h-4 w-4" /> {t('hrm:leaveRequestsPage.newRequestButton')}
        </Button>
      </div>

      {canApprove && (
        <Card>
          <CardHeader>
            <CardTitle>{t('hrm:leaveRequestsPage.pending.cardTitle', { count: pendingQuery.data?.data.length ?? 0 })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(pendingQuery.data?.data.length ?? 0) === 0 ? (
              <div className="border-dashed border-2 border-slate-200 py-6 text-center text-slate-400 text-sm rounded-lg">
                Không có yêu cầu chờ duyệt
              </div>
            ) : (
              pendingQuery.data?.data.map((request) => {
                // 26/08/2026: sua loi thuc te - xem chu thich tai khai bao `pendingRequestId` o dau
                // component: chi coi dong nay la "dang xu ly" khi no la dong dang duoc mutate, khong
                // phai bat cu khi nao approve/reject dang isPending (vi 2 mutation nay dung chung cho
                // toan bo danh sach).
                const isRowBusy = pendingRequestId === request.id && (approve.isPending || reject.isPending);
                const days = calculateWorkingDays(request.startDate, request.endDate);
                const employeeName = userNameMap[request.userId] || 'Nhân viên';
                const { leaveType, cleanReason } = parseLeaveReason(request.reason);

                return (
                  <div key={request.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-white shadow-2xs hover:border-slate-300 transition-colors">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Dòng 1: Định danh nhân sự (Avatar + Tên font-sans font-semibold text-slate-800 text-sm) */}
                      <div className="flex items-center gap-2">
                        <Avatar name={employeeName} size="sm" />
                        <span className="font-sans font-semibold text-slate-800 text-sm truncate">{employeeName}</span>
                      </div>

                      {/* Dòng 2: Khoảng ngày + Tổng số ngày */}
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {formatDate(request.startDate)} — {formatDate(request.endDate)}
                          {days > 0 && (
                            <span className="ml-1.5 text-slate-500 font-semibold text-xs sm:text-sm">
                              • {days} ngày
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Dòng 3: Loại nghỉ phép (Dòng riêng biệt) */}
                      {leaveType && (
                        <div className="flex items-center">
                          <span className="inline-flex items-center rounded-md bg-indigo-50/90 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                            {leaveType}
                          </span>
                        </div>
                      )}

                      {/* Dòng 4: Lý do (text-sm text-slate-500 italic) - bỏ dấu * */}
                      <p className="text-sm text-slate-500 italic truncate max-w-xl pt-0.5" title={cleanReason}>
                        {cleanReason || '—'}
                      </p>
                    </div>

                    {/* Cụm nút thao tác: Nút Từ chối border-rose-300 text-rose-700 hover:bg-rose-50 + Nút Duyệt bg-indigo-600 text-white */}
                    <div className="flex shrink-0 gap-2 items-center justify-end pt-2 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleReject(request.id)}
                        disabled={isRowBusy}
                        className="inline-flex w-28 h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 px-3 text-sm font-medium transition-colors shadow-2xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                      >
                        <XIcon className="h-4 w-4 shrink-0" /> {t('hrm:leaveRequestsPage.pending.reject')}
                      </button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        isLoading={isRowBusy && approve.isPending}
                        disabled={isRowBusy}
                        className="w-28 h-8 justify-center bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        <CheckIcon className="h-4 w-4 shrink-0" /> {t('hrm:leaveRequestsPage.pending.approve')}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('hrm:leaveRequestsPage.myRequests.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={myRequestsQuery.isLoading}
            isError={myRequestsQuery.isError}
            onRetry={() => myRequestsQuery.refetch()}
            loadingFallback={<FullPageSpinner label={t('hrm:leaveRequestsPage.myRequests.loading')} />}
            errorTitle={t('hrm:leaveRequestsPage.myRequests.errorTitle')}
            errorDescription={t('hrm:leaveRequestsPage.myRequests.errorDescription')}
          >
            {(myRequestsQuery.data?.data.length ?? 0) === 0 ? (
              <EmptyState
                title={t('hrm:leaveRequestsPage.myRequests.emptyTitle')}
                description={t('hrm:leaveRequestsPage.myRequests.emptyDescription')}
                action={<Button onClick={() => setIsNewOpen(true)}>{t('hrm:leaveRequestsPage.myRequests.createFirstButton')}</Button>}
              />
            ) : (
              <div className="space-y-4">
                {myRequestsQuery.data?.data.map((request) => {
                  const days = calculateWorkingDays(request.startDate, request.endDate);
                  const { leaveType, cleanReason } = parseLeaveReason(request.reason);
                  return (
                    <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-white shadow-2xs hover:border-slate-300 transition-colors">
                      <div className="min-w-0 space-y-1.5">
                        {/* Dòng 1: Khoảng ngày + Tổng số ngày */}
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {formatDate(request.startDate)} — {formatDate(request.endDate)}
                            {days > 0 && (
                              <span className="ml-1.5 text-slate-500 font-semibold text-xs sm:text-sm">
                                • {days} ngày
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Dòng 2: Loại nghỉ phép (Dòng riêng biệt) */}
                        {leaveType && (
                          <div className="flex items-center">
                            <span className="inline-flex items-center rounded-md bg-indigo-50/90 px-2 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                              {leaveType}
                            </span>
                          </div>
                        )}

                        {/* Dòng 3: Lý do (text-sm text-slate-500 italic) - bỏ dấu * */}
                        <p className="text-sm text-slate-500 italic truncate max-w-xl pt-0.5" title={cleanReason}>
                          {cleanReason || '—'}
                        </p>
                        {request.decisionNote && (
                          <p className="mt-1 text-xs italic text-slate-400">
                            {t('hrm:leaveRequestsPage.myRequests.decisionNote', { note: request.decisionNote })}
                          </p>
                        )}
                      </div>
                      {/* Căn chỉnh badge: flex gap-2, căn phải */}
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

      <NewLeaveRequestModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
