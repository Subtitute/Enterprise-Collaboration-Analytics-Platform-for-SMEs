import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlusIcon } from '@/components/ui/Icons';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { NewLeaveRequestModal } from './components/NewLeaveRequestModal';
import { LeavePolicyModal } from './components/LeavePolicyModal';
import { CompanyCalendar } from './components/CompanyCalendar';
import { LeaveBalanceCard } from './components/LeaveBalanceCard';
import { PendingLeaveRequestsList } from './components/PendingLeaveRequestsList';
import { MyLeaveRequestsList } from './components/MyLeaveRequestsList';
import {
  LeaveTypeBadge,
  LeaveStatusBadge,
  parseLeaveReason,
} from './components/leave-shared';
import {
  useApproveLeaveRequest,
  useMyLeaveBalanceQuery,
  useMyLeaveRequestsQuery,
  usePendingLeaveRequestsQuery,
  useRejectLeaveRequest,
} from './hooks';

/**
 * 03/10/2026: export de LeaveRequestDetailPage.tsx tai su dung (tranh chep lai y het logic nay).
 */
export {
  LeaveTypeBadge,
  LeaveStatusBadge,
  parseLeaveReason,
};

/** Trang Nghỉ phép (HRM-lite) - Final Spec v1.1 */
export function LeaveRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

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

  const pendingQuery = usePendingLeaveRequestsQuery();
  const balanceQuery = useMyLeaveBalanceQuery();
  const { map: userNameMap, users: orgUsers } = useUserNameMap();
  const currentUser = useAuthStore((s) => s.user);
  const approve = useApproveLeaveRequest();
  const reject = useRejectLeaveRequest();

  const leaveBalance = useMemo(() => {
    if (!balanceQuery.data) return null;
    const { usedDays, baseDaysPerYear, seniorityYearsPerBonusDay, year } = balanceQuery.data;
    const selfRecord = orgUsers.find((u) => u.id === currentUser?.id);
    const joinDate = selfRecord?.createdAt ? new Date(selfRecord.createdAt) : null;
    const yearsOfService = joinDate ? Math.max(0, Math.floor((Date.now() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : 0;
    const seniorityBonusDays = seniorityYearsPerBonusDay > 0 ? Math.floor(yearsOfService / seniorityYearsPerBonusDay) : 0;
    const entitledDays = baseDaysPerYear + seniorityBonusDays;
    return { year, usedDays, entitledDays, seniorityBonusDays, remainingDays: entitledDays - usedDays };
  }, [balanceQuery.data, orgUsers, currentUser?.id]);

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

  const handleApprove = useCallback((id: string) => {
    setPendingActions((prev) => ({ ...prev, [id]: 'approve' }));
    approve.mutate(id, { onSettled: () => clearPendingAction(id) });
  }, [approve]);

  const handleReject = useCallback((id: string) => {
    setPendingActions((prev) => ({ ...prev, [id]: 'reject' }));
    reject.mutate(id, { onSettled: () => clearPendingAction(id) });
  }, [reject]);

  const handleSelectEmployee = useCallback((userId: string) => {
    navigate(`/leave-requests/${userId}`);
  }, [navigate]);

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
              {t('hrm:companyCalendar.title')}
            </h2>
            <CompanyCalendar />
          </div>
        </div>

        {/* CỘT PHẢI (35-40%): Xếp dọc 3 khối */}
        <div className="w-full space-y-5 lg:w-[38%] min-w-0">
          {/* Khối 1: Số dư phép năm. Thu nhỏ gọn gàng (h-auto, padding vừa, số mono ~20-24px) */}
          <LeaveBalanceCard
            leaveBalance={leaveBalance}
            canManagePolicy={canManagePolicy}
            onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
            seniorityYearsPerBonusDay={balanceQuery.data?.seniorityYearsPerBonusDay}
          />

          {/* Khối 2: Gộp chung 1 Card: Header/Top là Tra cứu lịch sử, phần dưới là Danh sách Chờ duyệt */}
          <PendingLeaveRequestsList
            canViewEmployeeHistory={canViewEmployeeHistory}
            canApprove={canApprove}
            orgUsers={orgUsers}
            onSelectEmployee={handleSelectEmployee}
            pendingRequests={pendingQuery.data?.data ?? []}
            userNameMap={userNameMap}
            pendingActions={pendingActions}
            onApprove={handleApprove}
            onReject={handleReject}
          />

          {/* Khối 3: Yêu cầu của tôi. Logic: visibleCount = 3 ban đầu, slice(0, visibleCount), nút Xem thêm (+5 đơn) */}
          <MyLeaveRequestsList
            allMyRequests={allMyRequests}
            isLoading={myRequestsQuery.isLoading}
            isError={myRequestsQuery.isError}
            onRetry={() => myRequestsQuery.refetch()}
            onOpenNew={() => setIsNewOpen(true)}
          />
        </div>
      </div>

      <NewLeaveRequestModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
      {canManagePolicy && <LeavePolicyModal open={isPolicyModalOpen} onClose={() => setIsPolicyModalOpen(false)} />}
    </div>
  );
}
