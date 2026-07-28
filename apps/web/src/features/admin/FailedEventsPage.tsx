// 28/07/2026: trang moi "Sự kiện lỗi hệ thống" (Dead Letter Queue) - chi doc, khong co hanh dong
// "thu lai/replay" (ngoai pham vi tinh nang nay theo thong nhat voi backend). Cau truc mo phong
// sat MembersPage.tsx/DepartmentsPage.tsx (Card + QueryState + EmptyState + Table + Pagination)
// de dong bo voi cac trang Quan tri khac.
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { AlertCircleIcon } from '@/components/ui/Icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { formatDateTime } from '@/lib/utils';
import { useFailedEventsQuery } from './hooks';
import type { FailedEvent, FailedEventErrorType } from '@/types';

const LIMIT = 15;

// 28/07/2026: nhan + mau Badge tieng Viet cho tung errorType do backend dinh nghia (contract Dead
// Letter Queue) - MALFORMED_JSON/INVALID_ENVELOPE la loi du lieu dau vao (warning/amber),
// PERMANENT_DATA_ERROR/RETRY_EXHAUSTED la loi nghiem trong hon, khong the tu phuc hoi (danger/rose).
const ERROR_TYPE_META: Record<FailedEventErrorType, { label: string; variant: BadgeVariant }> = {
  MALFORMED_JSON: { label: 'Dữ liệu không hợp lệ', variant: 'warning' },
  INVALID_ENVELOPE: { label: 'Dữ liệu không hợp lệ', variant: 'warning' },
  PERMANENT_DATA_ERROR: { label: 'Lỗi dữ liệu', variant: 'danger' },
  RETRY_EXHAUSTED: { label: 'Hết lượt thử lại', variant: 'danger' },
};

// 28/07/2026: backend CHUA XAC NHAN tra ve "_id" hay "id" cho khoa chinh - uu tien _id (quy uoc
// Mongo pho bien cho collection luu DLQ), fallback sang id, roi eventId de key React luon co gia
// tri on dinh du backend chon ten truong nao. Can doi chieu lai voi response that khi backend
// hoan tat (xem ghi chu tuong tu tai types/index.ts va admin/api.ts).
function getRowKey(event: FailedEvent, index: number): string {
  return event._id ?? event.id ?? event.eventId ?? `failed-event-${index}`;
}

export function FailedEventsPage() {
  const [page, setPage] = useState(1);

  const failedEventsQuery = useFailedEventsQuery({ page, limit: LIMIT });
  const events = failedEventsQuery.data?.data ?? [];
  const meta = failedEventsQuery.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Danh sách các sự kiện xử lý nội bộ (Kafka) đã thất bại vĩnh viễn hoặc hết lượt thử lại tự động - đây không phải lỗi do người
        dùng gây ra, mà là dữ liệu phục vụ chẩn đoán sự cố hệ thống. Danh sách chỉ để xem, không có thao tác thử lại từ giao diện này.
      </p>

      <Card>
        <QueryState
          isLoading={failedEventsQuery.isLoading}
          isError={failedEventsQuery.isError}
          onRetry={() => failedEventsQuery.refetch()}
          loadingFallback={<FullPageSpinner label="Đang tải danh sách sự kiện lỗi…" />}
          errorTitle="Không thể tải danh sách sự kiện lỗi"
        >
          {events.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<AlertCircleIcon className="h-8 w-8" />}
                title="Chưa có sự kiện lỗi nào"
                description="Hiện chưa ghi nhận sự kiện xử lý nội bộ nào thất bại."
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeadCell>Thời điểm</TableHeadCell>
                    <TableHeadCell>Loại lỗi</TableHeadCell>
                    <TableHeadCell>Nguồn</TableHeadCell>
                    <TableHeadCell>Loại sự kiện</TableHeadCell>
                    <TableHeadCell>Thông báo lỗi</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {events.map((e, index) => {
                    const errorMeta = ERROR_TYPE_META[e.errorType] ?? { label: e.errorType, variant: 'default' as BadgeVariant };
                    return (
                      <TableRow key={getRowKey(e, index)}>
                        <TableCell label="Thời điểm" className="text-sm text-slate-600 whitespace-nowrap">
                          {formatDateTime(e.failedAt)}
                        </TableCell>
                        <TableCell label="Loại lỗi">
                          <Badge variant={errorMeta.variant}>{errorMeta.label}</Badge>
                        </TableCell>
                        <TableCell label="Nguồn" className="text-sm text-slate-600">
                          {e.sourceService} · {e.sourceTopic}
                        </TableCell>
                        <TableCell label="Loại sự kiện" className="text-sm text-slate-600">
                          {e.eventType ?? '—'}
                        </TableCell>
                        <TableCell label="Thông báo lỗi" className="max-w-xs truncate text-sm text-slate-600" title={e.errorMessage}>
                          {e.errorMessage}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination page={meta.page} limit={meta.limit} total={meta.total} onPageChange={setPage} />
            </>
          )}
        </QueryState>
      </Card>
    </div>
  );
}
