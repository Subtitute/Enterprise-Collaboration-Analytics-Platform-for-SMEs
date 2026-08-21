// 28/07/2026: trang moi "Sự kiện lỗi hệ thống" (Dead Letter Queue) - chi doc, khong co hanh dong
// "thu lai/replay" (ngoai pham vi tinh nang nay theo thong nhat voi backend). Cau truc mo phong
// sat MembersPage.tsx/DepartmentsPage.tsx (Card + QueryState + EmptyState + Table + Pagination)
// de dong bo voi cac trang Quan tri khac.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
const ERROR_TYPE_META: Record<FailedEventErrorType, { labelKey: string; variant: BadgeVariant }> = {
  MALFORMED_JSON: { labelKey: 'admin:failedEventsPage.errorTypeLabels.malformedJson', variant: 'warning' },
  INVALID_ENVELOPE: { labelKey: 'admin:failedEventsPage.errorTypeLabels.invalidEnvelope', variant: 'warning' },
  PERMANENT_DATA_ERROR: { labelKey: 'admin:failedEventsPage.errorTypeLabels.permanentDataError', variant: 'danger' },
  RETRY_EXHAUSTED: { labelKey: 'admin:failedEventsPage.errorTypeLabels.retryExhausted', variant: 'danger' },
};

// 28/07/2026: backend CHUA XAC NHAN tra ve "_id" hay "id" cho khoa chinh - uu tien _id (quy uoc
// Mongo pho bien cho collection luu DLQ), fallback sang id, roi eventId de key React luon co gia
// tri on dinh du backend chon ten truong nao. Can doi chieu lai voi response that khi backend
// hoan tat (xem ghi chu tuong tu tai types/index.ts va admin/api.ts).
function getRowKey(event: FailedEvent, index: number): string {
  return event._id ?? event.id ?? event.eventId ?? `failed-event-${index}`;
}

export function FailedEventsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const failedEventsQuery = useFailedEventsQuery({ page, limit: LIMIT });
  const events = failedEventsQuery.data?.data ?? [];
  const meta = failedEventsQuery.data?.meta ?? { page: 1, limit: LIMIT, total: 0 };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {t('admin:failedEventsPage.description')}
        {/* 28/07/2026: bo sung ghi chu ve cac ban ghi "Khong xac dinh to chuc" (xem
            failed-events.service.ts findForOrganization) - can giai thich vi sao Org Admin thay
            duoc du lieu KHONG thuoc rieng to chuc minh, neu khong se gay hieu nham ro ri du lieu. */}
        {' '}{t('admin:failedEventsPage.descriptionOrgNote')}
      </p>

      <Card>
        <QueryState
          isLoading={failedEventsQuery.isLoading}
          isError={failedEventsQuery.isError}
          onRetry={() => failedEventsQuery.refetch()}
          loadingFallback={<FullPageSpinner label={t('admin:failedEventsPage.loading')} />}
          errorTitle={t('admin:failedEventsPage.errorTitle')}
        >
          {events.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<AlertCircleIcon className="h-8 w-8" />}
                title={t('admin:failedEventsPage.emptyTitle')}
                description={t('admin:failedEventsPage.emptyDescription')}
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHead>
                  <tr>
                    <TableHeadCell>{t('admin:failedEventsPage.columns.time')}</TableHeadCell>
                    <TableHeadCell>{t('admin:failedEventsPage.columns.errorType')}</TableHeadCell>
                    <TableHeadCell>{t('admin:failedEventsPage.columns.scope')}</TableHeadCell>
                    <TableHeadCell>{t('admin:failedEventsPage.columns.source')}</TableHeadCell>
                    <TableHeadCell>{t('admin:failedEventsPage.columns.eventType')}</TableHeadCell>
                    <TableHeadCell>{t('admin:failedEventsPage.columns.errorMessage')}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {events.map((e, index) => {
                    const errorMeta = ERROR_TYPE_META[e.errorType];
                    const errorLabel = errorMeta ? t(errorMeta.labelKey) : e.errorType;
                    const errorVariant = errorMeta?.variant ?? ('default' as BadgeVariant);
                    return (
                      <TableRow key={getRowKey(e, index)}>
                        <TableCell label={t('admin:failedEventsPage.columns.time')} className="text-sm text-slate-600 whitespace-nowrap">
                          {formatDateTime(e.failedAt)}
                        </TableCell>
                        <TableCell label={t('admin:failedEventsPage.columns.errorType')}>
                          <Badge variant={errorVariant}>{errorLabel}</Badge>
                        </TableCell>
                        <TableCell label={t('admin:failedEventsPage.columns.scope')}>
                          {e.organizationId === null ? (
                            <Badge variant="default">{t('admin:failedEventsPage.scopeUnknownOrg')}</Badge>
                          ) : (
                            <Badge variant="success">{t('admin:failedEventsPage.scopeOwnOrg')}</Badge>
                          )}
                        </TableCell>
                        <TableCell label={t('admin:failedEventsPage.columns.source')} className="text-sm text-slate-600">
                          {e.sourceService} · {e.sourceTopic}
                        </TableCell>
                        <TableCell label={t('admin:failedEventsPage.columns.eventType')} className="text-sm text-slate-600">
                          {e.eventType ?? '—'}
                        </TableCell>
                        <TableCell
                          label={t('admin:failedEventsPage.columns.errorMessage')}
                          className="max-w-xs truncate text-sm text-slate-600"
                          title={e.errorMessage}
                        >
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
