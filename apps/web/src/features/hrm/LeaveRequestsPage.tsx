import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlusIcon, CheckIcon, XIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
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

/** Trang Nghỉ phép (HRM-lite) - Technical_Spec.md muc 17, Wireframe.md muc 13. */
export function LeaveRequestsPage() {
  const { t } = useTranslation();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const myRequestsQuery = useMyLeaveRequestsQuery({ limit: 20 });
  const pendingQuery = usePendingLeaveRequestsQuery();
  const approve = useApproveLeaveRequest();
  const reject = useRejectLeaveRequest();

  // 403 (khong co PERMISSIONS.LEAVE_REQUEST_VIEW) la ket qua BINH THUONG cho Employee thuong -
  // coi nhu "khong ap dung", KHONG hien banner loi (xem ghi chu tai usePendingLeaveRequestsQuery).
  const canApprove = !pendingQuery.isError && (pendingQuery.data?.data.length ?? 0) >= 0 && pendingQuery.isSuccess;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Nghỉ phép</h1>
          <p className="text-sm text-slate-500">Tạo và theo dõi yêu cầu nghỉ phép của bạn.</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)}>
          <PlusIcon className="h-4 w-4" /> Yêu cầu mới
        </Button>
      </div>

      {canApprove && (pendingQuery.data?.data.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chờ duyệt ({pendingQuery.data?.data.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingQuery.data?.data.map((request) => (
              <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {formatDate(request.startDate)} — {formatDate(request.endDate)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{request.reason}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => reject.mutate(request.id)} isLoading={reject.isPending}>
                    <XIcon className="h-4 w-4" /> Từ chối
                  </Button>
                  <Button size="sm" onClick={() => approve.mutate(request.id)} isLoading={approve.isPending}>
                    <CheckIcon className="h-4 w-4" /> Duyệt
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu của tôi</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={myRequestsQuery.isLoading}
            isError={myRequestsQuery.isError}
            onRetry={() => myRequestsQuery.refetch()}
            loadingFallback={<FullPageSpinner label="Đang tải yêu cầu nghỉ phép…" />}
            errorTitle="Không thể tải yêu cầu nghỉ phép"
            errorDescription="Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại."
          >
            {(myRequestsQuery.data?.data.length ?? 0) === 0 ? (
              <EmptyState
                title="Chưa có yêu cầu nghỉ phép nào"
                description="Tạo yêu cầu đầu tiên khi bạn cần nghỉ phép."
                action={<Button onClick={() => setIsNewOpen(true)}>Tạo yêu cầu mới</Button>}
              />
            ) : (
              <div className="space-y-3">
                {myRequestsQuery.data?.data.map((request) => (
                  <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {formatDate(request.startDate)} — {formatDate(request.endDate)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{request.reason}</p>
                      {request.decisionNote && (
                        <p className="mt-1 text-xs italic text-slate-400">Ghi chú: {request.decisionNote}</p>
                      )}
                    </div>
                    <Badge variant={STATUS_BADGE_VARIANT[request.status]}>{t(`hrm:enums.leaveRequestStatus.${request.status}`)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        </CardContent>
      </Card>

      <NewLeaveRequestModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
