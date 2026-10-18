// 16/10/2026: Khối "Sản phẩm đã mua" mới trên trang Chi tiết khách hàng - lịch sử các
// CustomerPurchase ("gán mặt hàng cho khách hàng", Danh mục sản phẩm + Kho, Technical_Spec.md mục
// 22), đặt NGAY DƯỚI khối Kanban deal hiện có (panel riêng, không chèn tab mới - trang này chưa
// từng dùng Tabs.tsx, thêm 1 panel là thay đổi tối thiểu nhất theo đúng bố cục đang có). Mirror
// cách CustomerCard.tsx tách Edit/Delete thành 2 hành động độc lập (dropdown + ConfirmDialog
// riêng) để gate đúng CUSTOMER_PURCHASE_UPDATE/CUSTOMER_PURCHASE_DELETE theo từng quyền.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EditIcon, MoreVerticalIcon, PlusIcon, TrashIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import { formatDealValue } from '../utils';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { useCustomerPurchasesQuery, useDeleteCustomerPurchase } from '@/features/inventory/hooks';
import type { CustomerPurchase } from '@/types';
import { NewCustomerPurchaseModal } from './NewCustomerPurchaseModal';
import { EditCustomerPurchaseModal } from './EditCustomerPurchaseModal';

const PAGE_SIZE = 10;

export function CustomerPurchaseHistory({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomerPurchase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerPurchase | null>(null);

  const permissions = usePermissions();
  const canCreate = permissions.includes(PERMISSIONS.CUSTOMER_PURCHASE_CREATE);
  const canUpdate = permissions.includes(PERMISSIONS.CUSTOMER_PURCHASE_UPDATE);
  const canDelete = permissions.includes(PERMISSIONS.CUSTOMER_PURCHASE_DELETE);
  const showActionsColumn = canUpdate || canDelete;

  const purchasesQuery = useCustomerPurchasesQuery({ customerId, page, limit: PAGE_SIZE });
  const deletePurchase = useDeleteCustomerPurchase();

  const purchases = purchasesQuery.data?.data ?? [];
  const total = purchasesQuery.data?.meta?.total ?? 0;

  return (
    <div className="rounded-radius-lg border border-border-subtle bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] leading-[24px] font-semibold text-text-primary">{t('crm:customerPurchases.title')}</h2>
        {canCreate && (
          <button
            type="button"
            onClick={() => setIsNewOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>{t('crm:customerPurchases.recordButton')}</span>
          </button>
        )}
      </div>

      <div className="mt-4">
        <QueryState
          isLoading={purchasesQuery.isLoading}
          isError={purchasesQuery.isError}
          onRetry={() => purchasesQuery.refetch()}
          errorTitle={t('crm:customerPurchases.errorTitle')}
          errorDescription={t('crm:customerPurchases.errorDescription')}
        >
          {purchases.length === 0 ? (
            <EmptyState
              plain
              title={t('crm:customerPurchases.emptyTitle')}
              description={t('crm:customerPurchases.emptyDescription')}
            />
          ) : (
            <>
              <Table>
                <TableHead>
                  <tr className="h-10 bg-bg-subtle">
                    <TableHeadCell>{t('crm:customerPurchases.columns.product')}</TableHeadCell>
                    <TableHeadCell className="text-right">{t('crm:customerPurchases.columns.quantity')}</TableHeadCell>
                    <TableHeadCell className="text-right">{t('crm:customerPurchases.columns.unitPrice')}</TableHeadCell>
                    <TableHeadCell className="text-right">{t('crm:customerPurchases.columns.lineTotal')}</TableHeadCell>
                    <TableHeadCell>{t('crm:customerPurchases.columns.date')}</TableHeadCell>
                    <TableHeadCell>{t('crm:customerPurchases.columns.note')}</TableHeadCell>
                    {showActionsColumn && <TableHeadCell aria-hidden="true" />}
                  </tr>
                </TableHead>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell label={t('crm:customerPurchases.columns.product')}>
                        <span className="font-medium text-text-primary">
                          {purchase.product?.name ?? t('crm:customerPurchases.unknownProduct')}
                        </span>
                      </TableCell>
                      <TableCell label={t('crm:customerPurchases.columns.quantity')} className="text-right">
                        <span className="font-mono text-[13px] tabular-nums">{purchase.quantity}</span>
                      </TableCell>
                      <TableCell label={t('crm:customerPurchases.columns.unitPrice')} className="text-right">
                        <span className="font-mono text-[13px] tabular-nums">{formatDealValue(purchase.unitPriceAtPurchase)}</span>
                      </TableCell>
                      <TableCell label={t('crm:customerPurchases.columns.lineTotal')} className="text-right">
                        <span className="font-mono text-[13px] font-medium text-accent tabular-nums">
                          {formatDealValue(purchase.quantity * purchase.unitPriceAtPurchase)}
                        </span>
                      </TableCell>
                      <TableCell label={t('crm:customerPurchases.columns.date')}>
                        <span className="font-mono text-[13px] tabular-nums">{formatDate(purchase.purchasedAt)}</span>
                      </TableCell>
                      <TableCell label={t('crm:customerPurchases.columns.note')}>
                        <span className="text-[13px] text-text-tertiary truncate" title={purchase.note ?? undefined}>
                          {purchase.note || '—'}
                        </span>
                      </TableCell>
                      {showActionsColumn && (
                        <TableCell label="">
                          <Dropdown
                            align="right"
                            trigger={({ toggle }) => (
                              <button
                                type="button"
                                onClick={toggle}
                                className="flex h-7 w-7 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                                aria-label={t('crm:customerPurchases.optionsAriaLabel')}
                              >
                                <MoreVerticalIcon className="h-4 w-4" />
                              </button>
                            )}
                          >
                            {({ close }) => (
                              <div className="min-w-[160px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md">
                                {canUpdate && (
                                  <DropdownItem
                                    className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                                    onClick={() => {
                                      setEditTarget(purchase);
                                      close();
                                    }}
                                  >
                                    <EditIcon className="h-4 w-4 text-text-secondary" /> {t('crm:customerPurchases.editAction')}
                                  </DropdownItem>
                                )}
                                {canDelete && (
                                  <DropdownItem
                                    className="h-9 px-2.5 rounded-radius-sm text-[13px] text-[#B3261E] hover:bg-[#F8E5E3]"
                                    onClick={() => {
                                      setDeleteTarget(purchase);
                                      close();
                                    }}
                                  >
                                    <TrashIcon className="h-4 w-4 text-[#B3261E]" /> {t('crm:customerPurchases.deleteAction')}
                                  </DropdownItem>
                                )}
                              </div>
                            )}
                          </Dropdown>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
            </>
          )}
        </QueryState>
      </div>

      <NewCustomerPurchaseModal customerId={customerId} open={isNewOpen} onClose={() => setIsNewOpen(false)} />
      <EditCustomerPurchaseModal purchase={editTarget} onClose={() => setEditTarget(null)} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePurchase.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title={t('crm:customerPurchases.deleteConfirmTitle')}
        description={t('crm:customerPurchases.deleteConfirmDescription', {
          productName: deleteTarget?.product?.name ?? t('crm:customerPurchases.unknownProduct'),
        })}
        confirmLabel={t('crm:customerPurchases.deleteAction')}
        danger
      />
    </div>
  );
}
