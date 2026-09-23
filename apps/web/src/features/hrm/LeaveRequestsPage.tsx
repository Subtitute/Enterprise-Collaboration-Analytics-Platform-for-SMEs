import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusIcon, CheckIcon, XIcon, EditIcon } from '@/components/ui/Icons';
import { formatDate, calculateWorkingDays } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import type { LeaveRequestStatus } from '@/types';
import { NewLeaveRequestModal } from './components/NewLeaveRequestModal';
import { LeavePolicyModal } from './components/LeavePolicyModal';
import {
  useApproveLeaveRequest,
  useMyLeaveBalanceQuery,
  useMyLeaveRequestsQuery,
  usePendingLeaveRequestsQuery,
  useRejectLeaveRequest,
} from './hooks';

const STATUS_BADGE_VARIANT: Record<LeaveRequestStatus, BadgeVariant> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** Tách loại nghỉ phép và lý do thực tế từ chuỗi reason đã lưu (hỗ trợ cả key enum ANNUAL/SICK/UNPAID và text cũ) */
function parseLeaveReason(rawReason: string | undefined | null, t: (key: string, options?: any) => string) {
  if (!rawReason) return { leaveType: null, cleanReason: '' };
  const match = rawReason.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    const rawType = match[1];
    // Nếu là mã type (ANNUAL, SICK, UNPAID)
    if (rawType === 'ANNUAL' || rawType === 'SICK' || rawType === 'UNPAID') {
      return {
        leaveType: t(`hrm:newLeaveRequestModal.types.${rawType}`),
        cleanReason: match[2],
      };
    }
    // Đối với các đơn cũ đã lưu text tiếng Việt hoặc ngôn ngữ khác
    // 16/09/2026: cac chuoi trong .includes(...) o 3 dong duoi la HANG SO de doi chieu voi rawType
    // DA LUU SAN trong DB tu truoc khi co quy uoc prefix enum [ANNUAL]/[SICK]/[UNPAID] (xem
    // typePrefix trong NewLeaveRequestModal.tsx) - voi du lieu cu do, rawType chinh la text da dich
    // san theo ngon ngu UI dang chon TAI THOI DIEM tao don (Viet/Anh/Nhat), khong phai chuoi UI
    // tinh dang hien thi nen khong dua qua t(). Du lieu MOI da di theo nhanh enum o tren (dong
    // rawType === 'ANNUAL' ...) nen khong can/khong the doi ve so sanh enum o day.
    let translatedType = rawType;
    if (rawType.includes('Nghỉ phép năm') || rawType.includes('Annual leave') || rawType.includes('年次有給休暇')) { // i18n-lint-ignore: khop rawType da luu tu truoc, khong phai chuoi UI
      translatedType = t('hrm:newLeaveRequestModal.types.ANNUAL');
    } else if (rawType.includes('Nghỉ ốm') || rawType.includes('Sick leave') || rawType.includes('病気休暇')) { // i18n-lint-ignore: khop rawType da luu tu truoc, khong phai chuoi UI
      translatedType = t('hrm:newLeaveRequestModal.types.SICK');
    } else if (rawType.includes('Nghỉ việc riêng') || rawType.includes('Personal leave') || rawType.includes('私用休暇')) { // i18n-lint-ignore: khop rawType da luu tu truoc, khong phai chuoi UI
      translatedType = t('hrm:newLeaveRequestModal.types.UNPAID');
    }
    return {
      leaveType: translatedType,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  // 22/09/2026: chi Org Admin (PERMISSIONS.ORG_MANAGE) duoc cau hinh chinh sach nghi phep - xem
  // LeavePolicyController.update() (apps/hrm-service).
  const permissions = usePermissions();
  const canManagePolicy = permissions.includes('organization:manage');

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsNewOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const myRequestsQuery = useMyLeaveRequestsQuery({ limit: 20 });
  const pendingQuery = usePendingLeaveRequestsQuery();
  const balanceQuery = useMyLeaveBalanceQuery();
  const { map: userNameMap, users: orgUsers } = useUserNameMap();
  const currentUser = useAuthStore((s) => s.user);
  const approve = useApproveLeaveRequest();
  const reject = useRejectLeaveRequest();

  // 22/09/2026: so du phep theo Luat LD VN (de xuat cua Tien) - entitledDays ghep tu 2 nguon: chinh
  // sach + usedDays THAT tu server (balanceQuery), va ngay vao lam (User.createdAt) CHI co san o
  // day (qua useOrgUsersQuery(), goi API IAM that qua Gateway) - hrm-service khong duoc phep truy
  // van truc tiep DB cua IAM Service (database-per-service), xem chu thich chi tiet tai
  // LeaveRequestsService.getMyBalance() (apps/hrm-service).
  const leaveBalance = (() => {
    if (!balanceQuery.data) return null;
    const { usedDays, baseDaysPerYear, seniorityYearsPerBonusDay, year } = balanceQuery.data;
    const selfRecord = orgUsers.find((u) => u.id === currentUser?.id);
    const joinDate = selfRecord?.createdAt ? new Date(selfRecord.createdAt) : null;
    const yearsOfService = joinDate ? Math.max(0, Math.floor((Date.now() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : 0;
    const seniorityBonusDays = Math.floor(yearsOfService / seniorityYearsPerBonusDay);
    const entitledDays = baseDaysPerYear + seniorityBonusDays;
    return { year, usedDays, entitledDays, seniorityBonusDays, remainingDays: entitledDays - usedDays };
  })();
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

      {leaveBalance && (
        <Card>
          <CardHeader>
            <CardTitle>{t('hrm:leaveRequestsPage.balance.cardTitle', { year: leaveBalance.year })}</CardTitle>
            {canManagePolicy && (
              <Button variant="outline" size="sm" onClick={() => setIsPolicyModalOpen(true)}>
                <EditIcon className="h-3.5 w-3.5" /> {t('hrm:leaveRequestsPage.balance.editPolicyButton')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-slate-900">{leaveBalance.entitledDays}</p>
                <p className="text-xs font-medium text-slate-500">{t('hrm:leaveRequestsPage.balance.entitledLabel')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{leaveBalance.usedDays}</p>
                <p className="text-xs font-medium text-slate-500">{t('hrm:leaveRequestsPage.balance.usedLabel')}</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${leaveBalance.remainingDays < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {leaveBalance.remainingDays}
                </p>
                <p className="text-xs font-medium text-slate-500">{t('hrm:leaveRequestsPage.balance.remainingLabel')}</p>
              </div>
            </div>
            {leaveBalance.seniorityBonusDays > 0 && (
              <p className="mt-3 text-center text-xs text-slate-400">
                {t('hrm:leaveRequestsPage.balance.seniorityNote', {
                  bonusDays: leaveBalance.seniorityBonusDays,
                  yearsPerBonus: balanceQuery.data?.seniorityYearsPerBonusDay,
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {canApprove && (
        <Card>
          <CardHeader>
            <CardTitle>{t('hrm:leaveRequestsPage.pending.cardTitle', { count: pendingQuery.data?.data.length ?? 0 })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(pendingQuery.data?.data.length ?? 0) === 0 ? (
              <div className="border-dashed border-2 border-slate-200 py-6 text-center text-slate-400 text-sm rounded-lg">
                {t('hrm:leaveRequestsPage.pending.emptyMessage')}
              </div>
            ) : (
              pendingQuery.data?.data.map((request) => {
                // 26/08/2026: sua loi thuc te - xem chu thich tai khai bao `pendingRequestId` o dau
                // component: chi coi dong nay la "dang xu ly" khi no la dong dang duoc mutate, khong
                // phai bat cu khi nao approve/reject dang isPending (vi 2 mutation nay dung chung cho
                // toan bo danh sach).
                const isRowBusy = pendingRequestId === request.id && (approve.isPending || reject.isPending);
                const days = calculateWorkingDays(request.startDate, request.endDate);
                // 16/09/2026: gop merge - giu nhanh dung key i18n cho employeeName (hardcode 'Nhân
                // viên' cua nhanh Tien se khong dich duoc sang en/ja), nhung lay tham so `t` cua
                // nhanh Tien khi goi parseLeaveReason vi ham nay bat buoc tham so thu 2 la `t`
                // (xem khai bao parseLeaveReason o tren) - nhanh HEAD thieu tham so nay se gay loi
                // "t is not a function" ngay khi request.reason co dang "[ANNUAL] ...".
                const employeeName = userNameMap[request.userId] || t('hrm:leaveRequestsPage.pending.unknownEmployee');
                const { leaveType, cleanReason } = parseLeaveReason(request.reason, t);

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
                              • {t('hrm:leaveRequestsPage.daysCount', { count: days })}
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
                  const { leaveType, cleanReason } = parseLeaveReason(request.reason, t);
                  return (
                    <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between bg-white shadow-2xs hover:border-slate-300 transition-colors">
                      <div className="min-w-0 space-y-1.5">
                        {/* Dòng 1: Khoảng ngày + Tổng số ngày */}
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {formatDate(request.startDate)} — {formatDate(request.endDate)}
                            {days > 0 && (
                              <span className="ml-1.5 text-slate-500 font-semibold text-xs sm:text-sm">
                                • {t('hrm:leaveRequestsPage.daysCount', { count: days })}
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
      {canManagePolicy && <LeavePolicyModal open={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />}
    </div>
  );
}
