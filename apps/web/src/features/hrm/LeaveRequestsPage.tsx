import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown } from '@/components/ui/Dropdown';
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

export function LeaveTypeBadge({ rawType, label }: { rawType: string | null; label: string | null }) {
  if (!label) return null;
  // §4 Badge loại nghỉ: h22, padding 2x8, radius 2 (rounded-[2px]), font 11/600, dot 4px cùng màu chữ
  // ANNUAL: accent-soft #E4EFEE, accent #0E5E5E
  // SICK: warning-soft #FBEEE0, warning #B45309
  // UNPAID: bg-subtle #FAF9F6, text-secondary #5C5A55
  let bgClass = 'bg-[#FAF9F6] text-[#5C5A55]';
  let dotClass = 'bg-[#5C5A55]';

  const typeUpper = (rawType || '').toUpperCase();
  if (typeUpper === 'ANNUAL' || label.includes('năm') || label.includes('Annual') || label.includes('有給')) {
    bgClass = 'bg-[#E4EFEE] text-[#0E5E5E]';
    dotClass = 'bg-[#0E5E5E]';
  } else if (typeUpper === 'SICK' || label.includes('ốm') || label.includes('Sick') || label.includes('病気')) {
    bgClass = 'bg-[#FBEEE0] text-[#B45309]';
    dotClass = 'bg-[#B45309]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold shrink-0 ${bgClass}`}>
      <span className={`h-1 w-1 rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
}

export function LeaveStatusBadge({ status, label }: { status: LeaveRequestStatus; label: string }) {
  // §5 Badge trạng thái: h22, padding 2x8, radius 2, font 11/600
  // APPROVED: success-soft #E6F1E9, success #2F6F44
  // REJECTED: error-soft #F8E5E3, error #B3261E
  // PENDING: info-soft #E4EEF5, info #1E5A8A
  let styleClass = 'bg-[#E4EEF5] text-[#1E5A8A]';
  if (status === 'APPROVED') {
    styleClass = 'bg-[#E6F1E9] text-[#2F6F44]';
  } else if (status === 'REJECTED') {
    styleClass = 'bg-[#F8E5E3] text-[#B3261E]';
  }

  return (
    <span className={`inline-flex items-center justify-center h-[22px] px-2 rounded-[2px] text-[11px] font-semibold shrink-0 ${styleClass}`}>
      {label}
    </span>
  );
}

/** Tách loại nghỉ phép và lý do thực tế từ chuỗi reason đã lưu (hỗ trợ cả key enum ANNUAL/SICK/UNPAID và text cũ).
 *  03/10/2026: export de LeaveRequestDetailPage.tsx tai su dung (tranh chep lai y het logic nay). */
export function parseLeaveReason(rawReason: string | undefined | null, t: (key: string, options?: any) => string) {
  if (!rawReason) return { rawType: null, leaveType: null, cleanReason: '' };
  const match = rawReason.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    const rawType = match[1];
    // Nếu là mã type (ANNUAL, SICK, UNPAID)
    if (rawType === 'ANNUAL' || rawType === 'SICK' || rawType === 'UNPAID') {
      return {
        rawType,
        leaveType: t(`hrm:newLeaveRequestModal.types.${rawType}`),
        cleanReason: match[2],
      };
    }
    let translatedType = rawType;
    if (rawType.includes('Nghỉ phép năm') || rawType.includes('Annual leave') || rawType.includes('年次有給休暇')) {
      translatedType = t('hrm:newLeaveRequestModal.types.ANNUAL');
    } else if (rawType.includes('Nghỉ ốm') || rawType.includes('Sick leave') || rawType.includes('病気休暇')) {
      translatedType = t('hrm:newLeaveRequestModal.types.SICK');
    } else if (rawType.includes('Nghỉ việc riêng') || rawType.includes('Personal leave') || rawType.includes('私用休暇')) {
      translatedType = t('hrm:newLeaveRequestModal.types.UNPAID');
    }
    return {
      rawType,
      leaveType: translatedType,
      cleanReason: match[2],
    };
  }
  return {
    rawType: null,
    leaveType: null,
    cleanReason: rawReason,
  };
}

/**
 * 2.7 Employee picker dropdown
 * Trigger: input icon search trái, label 'Xem lịch sử theo nhân viên' 13/400 text-secondary, chevron-down 12px right. Border 1 border-strong, radius 6 (radius-sm), h36.
 * Panel: shadow-sm, radius 6, padding 4, min-w 280.
 * Item: h44, padding 8x10, radius 4, hover bg-subtle, Avatar 28x28 #E4EFEE + #0E5E5E, Tên 13/500 text-primary, email 12/400 text-tertiary.
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
    <div className="w-full">
      <Dropdown
        align="left"
        panelClassName="min-w-[280px] p-1 rounded-radius-sm border border-border-subtle bg-white shadow-sm"
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-full items-center justify-between gap-2 rounded-radius-sm border border-border-strong px-3 text-left text-[13px] font-normal text-text-secondary hover:border-text-primary hover:bg-bg-subtle transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <SearchIcon className="h-4 w-4 text-text-tertiary shrink-0" />
              <span className="truncate">{t('hrm:employeePicker.label')}</span>
            </span>
            <ChevronDownIcon className="h-3 w-3 text-text-tertiary shrink-0" />
          </button>
        )}
      >
        {({ close }) => (
          <div className="space-y-1.5 p-1">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('hrm:employeePicker.searchPlaceholder')}
              className="h-8 w-full rounded-radius-sm border border-border-strong bg-white px-2.5 text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
            <div className="max-h-60 space-y-0.5 overflow-y-auto popover-scrollbar">
              {filteredUsers.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-text-tertiary">{t('hrm:employeePicker.emptyResult')}</p>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onSelect(u.id);
                      close();
                    }}
                    className="flex h-11 w-full items-center gap-2.5 rounded-radius-xs px-2.5 py-2 text-left transition-colors duration-150 hover:bg-bg-subtle cursor-pointer"
                  >
                    <Avatar name={u.fullName} className="h-7 w-7 text-[11px] bg-[#E4EFEE] text-[#0E5E5E] shrink-0 font-semibold" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-text-primary">{u.fullName}</p>
                      <p className="truncate text-[12px] text-text-tertiary">{u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </Dropdown>
    </div>
  );
}

/** Trang Nghỉ phép (HRM-lite) - Final Spec v1.1 */
export function LeaveRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);

  const permissions = usePermissions();
  const canManagePolicy = permissions.includes('organization:manage');
  const canViewEmployeeHistory = permissions.includes(PERMISSIONS.LEAVE_REQUEST_VIEW);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsNewOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const myRequestsQuery = useMyLeaveRequestsQuery({ limit: 50 });
  const allMyRequests = useMemo(() => myRequestsQuery.data?.data ?? [], [myRequestsQuery.data?.data]);
  const displayedMyRequests = useMemo(() => allMyRequests.slice(0, visibleCount), [allMyRequests, visibleCount]);
  const hasMoreMyRequests = allMyRequests.length > visibleCount;

  const pendingQuery = usePendingLeaveRequestsQuery();
  const balanceQuery = useMyLeaveBalanceQuery();
  const { map: userNameMap, users: orgUsers } = useUserNameMap();
  const currentUser = useAuthStore((s) => s.user);
  const approve = useApproveLeaveRequest();
  const reject = useRejectLeaveRequest();

  const leaveBalance = (() => {
    if (!balanceQuery.data) return null;
    const { usedDays, baseDaysPerYear, seniorityYearsPerBonusDay, year } = balanceQuery.data;
    const selfRecord = orgUsers.find((u) => u.id === currentUser?.id);
    const joinDate = selfRecord?.createdAt ? new Date(selfRecord.createdAt) : null;
    const yearsOfService = joinDate ? Math.max(0, Math.floor((Date.now() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : 0;
    const seniorityBonusDays = seniorityYearsPerBonusDay > 0 ? Math.floor(yearsOfService / seniorityYearsPerBonusDay) : 0;
    const entitledDays = baseDaysPerYear + seniorityBonusDays;
    return { year, usedDays, entitledDays, seniorityBonusDays, remainingDays: entitledDays - usedDays };
  })();

  const [pendingActions, setPendingActions] = useState<Record<string, 'approve' | 'reject'>>({});
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
      {/* 2.1 Header: Title 28/36 w600. Subtitle 14/22 text-secondary. Nút + Yêu cầu mới = Primary ink + icon plus */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-[36px] font-semibold tracking-tight text-text-primary">
            {t('hrm:leaveRequestsPage.title')}
          </h1>
          <p className="mt-1 text-[14px] leading-[22px] text-text-secondary">
            {t('hrm:leaveRequestsPage.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer shrink-0"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          <span>{t('hrm:leaveRequestsPage.newRequestButton')}</span>
        </button>
      </div>

      {/* BỐ CỤC TỔNG THỂ 2 CỘT (Cột trái 60-65% Lịch phóng to, Cột phải 35-40% 3 khối xếp dọc) */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* CỘT TRÁI (60-65%): Khối Lịch công ty phóng to */}
        <div className="w-full lg:w-[62%] min-w-0">
          <div className="rounded-radius-md border border-border-subtle bg-white p-4 sm:p-5 space-y-3.5">
            <h2 className="text-[16px] font-semibold text-text-primary">
              {t('hrm:companyCalendar.title', 'Lịch công ty')}
            </h2>
            <CompanyCalendar />
          </div>
        </div>

        {/* CỘT PHẢI (35-40%): Xếp dọc 3 khối */}
        <div className="w-full space-y-5 lg:w-[38%] min-w-0">
          {/* Khối 1: Số dư phép năm. Thu nhỏ gọn gàng (h-auto, padding vừa, số mono ~20-24px) */}
          {leaveBalance && (
            <div className="rounded-radius-md border border-border-subtle bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border-subtle">
                <h2 className="text-[14px] font-semibold text-text-primary">
                  {t('hrm:leaveRequestsPage.balance.cardTitle', { year: leaveBalance.year })}
                </h2>
                {canManagePolicy && (
                  <button
                    type="button"
                    onClick={() => setIsPolicyModalOpen(true)}
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
                    yearsPerBonus: balanceQuery.data?.seniorityYearsPerBonusDay,
                  })}
                </p>
              )}
            </div>
          )}

          {/* Khối 2: Gộp chung 1 Card: Header/Top là Tra cứu lịch sử, phần dưới là Danh sách Chờ duyệt */}
          {(canViewEmployeeHistory || canApprove) && (
            <div className="rounded-radius-md border border-border-subtle bg-white p-4 space-y-4">
              {/* Header/Top: Tra cứu lịch sử theo nhân viên */}
              {canViewEmployeeHistory && (
                <div className="space-y-2">
                  <h2 className="text-[14px] font-semibold text-text-primary">
                    {t('hrm:employeePicker.label')}
                  </h2>
                  <EmployeeHistoryPicker users={orgUsers} onSelect={(userId) => navigate(`/leave-requests/${userId}`)} />
                </div>
              )}

              {/* Phần dưới: Danh sách Chờ duyệt */}
              {canApprove && (
                <div className={`space-y-3 ${canViewEmployeeHistory ? 'pt-3 border-t border-border-subtle' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-[14px] font-semibold text-text-primary">
                      {t('hrm:leaveRequestsPage.pending.cardTitle', { count: pendingQuery.data?.data.length ?? 0 })}
                    </h2>
                  </div>

                  {(pendingQuery.data?.data.length ?? 0) === 0 ? (
                    <div className="rounded-radius-sm border border-dashed border-border-subtle p-5 text-center text-[12px] font-normal text-text-tertiary">
                      {t('hrm:leaveRequestsPage.pending.emptyMessage')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingQuery.data?.data.map((request) => {
                        const rowAction = pendingActions[request.id];
                        const isRowBusy = rowAction !== undefined;
                        const days = calculateWorkingDays(request.startDate, request.endDate);
                        const employeeName = userNameMap[request.userId] || t('hrm:leaveRequestsPage.pending.unknownEmployee');
                        const { rawType, leaveType, cleanReason } = parseLeaveReason(request.reason, t);

                        return (
                          <div
                            key={request.id}
                            className="rounded-radius-md border border-border-subtle bg-bg-surface p-3.5 transition-colors hover:border-border-strong space-y-2"
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

                            {/* Dòng 2: Badge loại nghỉ (§4) + badge trạng thái (§5) */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <LeaveTypeBadge rawType={rawType} label={leaveType} />
                              <LeaveStatusBadge
                                status={request.status}
                                label={t(`hrm:enums.leaveRequestStatus.${request.status}`)}
                              />
                            </div>

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
                                onClick={() => handleReject(request.id)}
                                disabled={isRowBusy}
                                className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-radius-sm text-[12px] font-medium text-[#B3261E] hover:bg-[#F8E5E3] transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                              >
                                <XIcon className="h-3 w-3" />
                                <span>{t('hrm:leaveRequestsPage.pending.reject')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApprove(request.id)}
                                disabled={isRowBusy}
                                className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                              >
                                <CheckIcon className="h-3 w-3" />
                                <span>{t('hrm:leaveRequestsPage.pending.approve')}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Khối 3: Yêu cầu của tôi. Logic: visibleCount = 3 ban đầu, slice(0, visibleCount), nút Xem thêm (+5 đơn) */}
          <div className="rounded-radius-md border border-border-subtle bg-white p-4 space-y-3">
            <h2 className="text-[14px] font-semibold text-text-primary">
              {t('hrm:leaveRequestsPage.myRequests.cardTitle')}
            </h2>

            <QueryState
              isLoading={myRequestsQuery.isLoading}
              isError={myRequestsQuery.isError}
              onRetry={() => myRequestsQuery.refetch()}
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
                      onClick={() => setIsNewOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-radius-sm bg-text-primary text-white text-[12px] font-medium hover:bg-black transition-colors cursor-pointer"
                    >
                      {t('hrm:leaveRequestsPage.myRequests.createFirstButton')}
                    </button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {displayedMyRequests.map((request) => {
                    const days = calculateWorkingDays(request.startDate, request.endDate);
                    const { rawType, leaveType, cleanReason } = parseLeaveReason(request.reason, t);

                    return (
                      <div
                        key={request.id}
                        className="rounded-radius-md border border-border-subtle bg-bg-surface p-3.5 transition-colors hover:border-border-strong space-y-2"
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

                        {/* Dòng 2: Badge loại nghỉ (§4) + badge trạng thái (§5) */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <LeaveTypeBadge rawType={rawType} label={leaveType} />
                          <LeaveStatusBadge
                            status={request.status}
                            label={t(`hrm:enums.leaveRequestStatus.${request.status}`)}
                          />
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
                  })}

                  {/* Nút Xem thêm: hiện nếu tổng đơn > visibleCount, bấm tăng +5, hết tự ẩn */}
                  {hasMoreMyRequests && (
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 5)}
                        className="w-full inline-flex items-center justify-center h-8 px-3 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer"
                      >
                        {t('hrm:leaveRequestsPage.myRequests.loadMore', { defaultValue: 'Xem thêm' })}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </QueryState>
          </div>
        </div>
      </div>

      <NewLeaveRequestModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
      {canManagePolicy && <LeavePolicyModal open={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />}
    </div>
  );
}
