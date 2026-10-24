// 28/07/2026: trang moi "Sự kiện lỗi hệ thống" (Dead Letter Queue) - chi doc, khong co hanh dong
// "thu lai/replay" (ngoai pham vi tinh nang nay theo thong nhat voi backend). Cau truc mo phong
// sat MembersPage.tsx/DepartmentsPage.tsx (Card + QueryState + EmptyState + Table + Pagination)
// de dong bo voi cac trang Quan tri khac.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
      {/* Banner mô tả đầu trang (như tab Roles) */}
      <div className="rounded-radius-md border border-border-subtle bg-bg-subtle p-3 text-[13px] leading-5 text-text-secondary">
        {t('admin:failedEventsPage.description')}{' '}{t('admin:failedEventsPage.descriptionOrgNote')}
      </div>

      <div className="rounded-radius-md border border-border-subtle bg-white overflow-hidden">
        <QueryState
          isLoading={failedEventsQuery.isLoading}
          isError={failedEventsQuery.isError}
          onRetry={() => failedEventsQuery.refetch()}
          loadingFallback={<FullPageSpinner label={t('admin:failedEventsPage.loading')} />}
          errorTitle={t('admin:failedEventsPage.errorTitle')}
        >
          {events.length === 0 ? (
            /* Empty: khung dashed border-subtle, radius 8, padding 40, căn giữa. Icon alert-circle 40px text-tertiary. Title 15/500 + body 13/400 text-secondary. */
            <div className="p-6">
              <div className="flex flex-col items-center justify-center rounded-radius-md border border-dashed border-border-subtle p-10 text-center">
                <AlertCircleIcon className="h-10 w-10 text-text-tertiary stroke-1" />
                <h3 className="mt-3 text-[15px] leading-6 font-medium text-text-primary">
                  {t('admin:failedEventsPage.emptyTitle')}
                </h3>
                <p className="mt-1 text-[13px] leading-5 text-text-secondary">
                  {t('admin:failedEventsPage.emptyDescription')}
                </p>
              </div>
            </div>
          ) : (
            <>
              <Table className="border-0">
                <TableHead className="bg-bg-subtle border-b border-border-subtle">
                  <tr className="h-10">
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:failedEventsPage.columns.time')}</TableHeadCell>
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:failedEventsPage.columns.errorType')}</TableHeadCell>
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:failedEventsPage.columns.scope')}</TableHeadCell>
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:failedEventsPage.columns.source')}</TableHeadCell>
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:failedEventsPage.columns.eventType')}</TableHeadCell>
                    <TableHeadCell className="text-[12px] font-medium uppercase tracking-wider text-text-tertiary px-4 py-2">{t('admin:failedEventsPage.columns.errorMessage')}</TableHeadCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {events.map((e, index) => {
                    const errorMeta = ERROR_TYPE_META[e.errorType];
                    const errorLabel = errorMeta ? t(errorMeta.labelKey) : e.errorType;
                    const errorVariant = errorMeta?.variant ?? ('default' as BadgeVariant);
                    return (
                      <TableRow key={getRowKey(e, index)} className="h-14 border-b border-border-subtle hover:bg-bg-subtle transition-colors">
                        <TableCell label={t('admin:failedEventsPage.columns.time')} className="px-4 py-2.5 text-[13px] font-mono tabular-nums text-text-secondary whitespace-nowrap">
                          {formatDateTime(e.failedAt)}
                        </TableCell>
                        <TableCell label={t('admin:failedEventsPage.columns.errorType')} className="px-4 py-2.5">
                          <Badge variant={errorVariant} className="rounded-radius-sm text-[12px] px-2 py-0.5">{errorLabel}</Badge>
                        </TableCell>
                        <TableCell label={t('admin:failedEventsPage.columns.scope')} className="px-4 py-2.5">
                          {e.organizationId === null ? (
                            <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-bg-muted text-text-secondary border border-border-subtle">
                              {t('admin:failedEventsPage.scopeUnknownOrg')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-radius-sm px-2 py-0.5 text-[12px] font-medium bg-success-soft text-success border border-success/20">
                              {t('admin:failedEventsPage.scopeOwnOrg')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell label={t('admin:failedEventsPage.columns.source')} className="px-4 py-2.5 text-[13px] text-text-secondary">
                          {e.sourceService} · {e.sourceTopic}
                        </TableCell>
                        <TableCell label={t('admin:failedEventsPage.columns.eventType')} className="px-4 py-2.5 text-[13px] text-text-secondary">
                          {e.eventType ?? '—'}
                        </TableCell>
                        <TableCell
                          label={t('admin:failedEventsPage.columns.errorMessage')}
                          className="px-4 py-2.5 max-w-xs truncate text-[13px] text-text-secondary"
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
      </div>
    </div>
  );
}
