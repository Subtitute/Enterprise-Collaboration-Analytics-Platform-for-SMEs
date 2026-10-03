import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusIcon, CheckIcon, XIcon, EditIcon, SearchIcon, ChevronDownIcon } from '@/components/ui/Icons';
import { formatDate, calculateWorkingDays } from '@/lib/utils';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import type { LeaveRequestStatus, User } from '@/types';
import { NewLeaveRequestModal } from './components/NewLeaveRequestModal';
import { LeavePolicyModal } from './components/LeavePolicyModal';
import { CompanyCalendar } from './components/CompanyCalendar';
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

/** Tách loại nghỉ phép và lý do thực tế từ chuỗi reason đã lưu (hỗ trợ cả key enum ANNUAL/SICK/UNPAID và text cũ).
 *  03/10/2026: export de LeaveRequestDetailPage.tsx tai su dung (tranh chep lai y het logic nay). */
export function parseLeaveReason(rawReason: string | undefined | null, t: (key: string, options?: any) => string) {
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

/**
 * 03/10/2026: muc chon nhanh "xem lich su theo nhan vien" (chi hien voi nguoi co
 * PERMISSIONS.LEAVE_REQUEST_VIEW, xem canViewEmployeeHistory tai LeaveRequestsPage) - mirror dung
 * pattern Dropdown + danh sach loc truc tiep cua nut "Doi nguoi phu trach" (canReassignOwner) tai
 * CustomerDetailPage.tsx, chi them 1 o tim kiem loc theo ten/email vi danh sach nhan vien co the
 * dai hon danh sach chu so huu khach hang.
 */
function EmployeeHistoryPicker({ users, onSelect }: { users: User[]; onSelect: (userId: string) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardContent className="py-3.5">
        <Dropdown
          align="left"
          panelClassName="w-72 p-2 rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:border-slate-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <SearchIcon className="h-4 w-4 text-slate-400" />
                {t('hrm:employeePicker.label')}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-slate-400" />
            </button>
          )}
        >
          {({ close }) => (
            <div className="space-y-2">
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('hrm:employeePicker.searchPlaceholder')}
              />
              <div className="max-h-60 space-y-0.5 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-slate-400">{t('hrm:employeePicker.emptyResult')}</p>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onSelect(u.id);
                        close();
                      }}
                      className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors duration-150 hover:bg-slate-50 cursor-pointer"
                    >
                      <Avatar name={u.fullName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-800 transition-colors group-hover:text-primary-600">{u.fullName}</p>
                        <p className="truncate text-[11px] text-slate-400">{u.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </Dropdown>
      </CardContent>
    </Card>
  );
}

/** Trang Nghỉ phép (HRM-lite) - Technical_Spec.md muc 17, Wireframe.md muc 13. */
export function LeaveRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  // 22/09/2026: chi Org Admin (PERMISSIONS.ORG_MANAGE) duoc cau hinh chinh sach nghi phep - xem
  // LeavePolicyController.update() (apps/hrm-service).
  const permissions = usePermissions();
  const canManagePolicy = permissions.includes('organization:manage');
  // 03/10/2026: chi Manager/Org Admin (PERMISSIONS.LEAVE_REQUEST_VIEW) duoc xem lich su nghi phep
  // cua NGUOI KHAC (/leave-requests/:userId) - dung de an/hien muc chon nhan vien + lien ket ten
  // nhan vien trong danh sach cho duyet ben duoi.
  const canViewEmployeeHistory = permissions.includes(PERMISSIONS.LEAVE_REQUEST_VIEW);

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
    // 03/10/2026: phat hien qua rieng soat - chia cho seniorityYearsPerBonusDay=0 (khong co validate
    // nao chan gia tri nay o UpdateLeavePolicyDto, xem fix cung ngay o do) se ra Infinity/NaN, lam
    // hong hien thi entitledDays/remainingDays cho MOI nhan vien. Gia tri 0 vo nghia nghiep vu (0 nam
    // de duoc +1 ngay thuong nien khong phai 1 chinh sach hop le) nen coi nhu "khong cong thuong nien".
    const seniorityBonusDays = seniorityYearsPerBonusDay > 0 ? Math.floor(yearsOfService / seniorityYearsPerBonusDay) : 0;
    const entitledDays = baseDaysPerYear + seniorityBonusDays;
    return { year, usedDays, entitledDays, seniorityBonusDays, remainingDays: entitledDays - usedDays };
  })();
  // 26/08/2026: sua loi thuc te - `approve`/`reject` chi duoc goi 1 LAN cho ca trang va dung chung
  // cho MOI dong trong danh sach cho duyet, nen `approve.isPending`/`reject.isPending` la trang thai
  // DUNG CHUNG: duyet 1 don se lam nut Duyet/Tu choi cua TAT CA cac dong khac cung disable/quay spin
  // theo, du chung khong lien quan gi den request dang xu ly.
  //
  // 03/10/2026: sua tiep 1 race condition phat hien qua rieng soat - ban truoc dung 1 bien
  // `pendingRequestId` DUY NHAT cho ca danh sach. Bam Duyet don A (pendingRequestId='A') roi bam
  // Tu choi don B TRUOC KHI A hoan tat (pendingRequestId doi thanh 'B') khien dong A tuc thi hien
  // het "dang xu ly" (so sanh pendingRequestId==='A' nay la false) du mutation cua A VAN dang
  // chay - cho phep bam Duyet A lan 2, goi trung 2 lan approveLeaveRequest('A') chong cheo nhau.
  // Sua bang 1 Record<id, 'approve'|'reject'> ghi nhan MOI id dang co mutation rieng, khong con
  // phu thuoc vao 1 bien dung chung duy nhat nua - moi dong tu quan ly trang thai cua chinh no.
  const [pendingActions, setPendingActions] = useState<Record<string, 'approve' | 'reject'>>({});

  // 403 (khong co PERMISSIONS.LEAVE_REQUEST_VIEW) la ket qua BINH THUONG cho Employee thuong -
  // coi nhu "khong ap dung", KHONG hien banner loi (xem ghi chu tai usePendingLeaveRequestsQuery).
  const canApprove = !pendingQuery.isError && pendingQuery.isSuccess;

  function clearPendingAction(id: string) {
    setPendingActions((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleApprove(id: string) {
    setPendingActions((prev) => ({ ...prev, [id]: 'approve' }));
    approve.mutate(id, { onSettled: () => clearPendingAction(id) });
  }

  function handleReject(id: string) {
    setPendingActions((prev) => ({ ...prev, [id]: 'reject' }));
    reject.mutate(id, { onSettled: () => clearPendingAction(id) });
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

      {/* 03/10/2026: bo cuc 2 cot - Lich cong ty (CompanyCalendar, 60% rong) ben trai, 3 the da co
          san (so du phep/cho duyet/yeu cau cua toi, GIU NGUYEN logic) xep chong ben phai (40% rong).
          Gap 1 cot tren mobile (flex-col), 2 cot tu lg tro len. */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="w-full lg:w-[60%]">
          <CompanyCalendar />
        </div>

        <div className="w-full space-y-5 lg:w-[40%]">
          {canViewEmployeeHistory && (
            <EmployeeHistoryPicker users={orgUsers} onSelect={(userId) => navigate(`/leave-requests/${userId}`)} />
          )}

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
                    // 26/08/2026 (sua lai 03/10/2026): xem chu thich tai khai bao `pendingActions` o
                    // dau component - moi dong tu tra cuu dung trang thai cua CHINH NO trong map, khong
                    // con phu thuoc vao 1 bien id dung chung dang gay race condition.
                    const rowAction = pendingActions[request.id];
                    const isRowBusy = rowAction !== undefined;
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
                            {/* 03/10/2026: ten nhan vien lien ket toi lich su chi tiet cua ho - chi khi
                                the nay dang hien thi thi nguoi xem CHAC CHAN da co LEAVE_REQUEST_VIEW
                                (xem canApprove o tren, dua tren GET /leave-requests thanh cong). */}
                            <Link
                              to={`/leave-requests/${request.userId}`}
                              className="font-sans font-semibold text-slate-800 text-sm truncate hover:text-primary-600 hover:underline"
                            >
                              {employeeName}
                            </Link>
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
                            isLoading={rowAction === 'approve'}
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
        </div>
      </div>

      <NewLeaveRequestModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
      {canManagePolicy && <LeavePolicyModal open={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />}
    </div>
  );
}
