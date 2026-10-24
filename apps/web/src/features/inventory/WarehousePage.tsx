// 16/10/2026: Trang "Kho" (Inventory Service) - danh sach kho (toi da 100, khong phan trang rieng
// vi quy mo SME thuong nho - mirror DepartmentsPage.tsx, khong Pagination) + 2 tab "Tồn kho"/"Lịch
// sử biến động" (StockTable.tsx/StockMovementsTable.tsx, co phan trang rieng). Tao/sua/xoa kho va
// ghi nhan bien dong deu CHI hien khi co WAREHOUSE_MANAGE (WAREHOUSE_VIEW da du de vao trang, xem
// App.tsx - route nay khong gan requiredPermission vi ca 3 vai tro deu co WAREHOUSE_VIEW).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';
import { EditIcon, MoreVerticalIcon, PlusIcon, TrashIcon, WarehouseIcon } from '@/components/ui/Icons';
import { useDeleteWarehouse, useProductsQuery, useWarehousesQuery } from './hooks';
import { WarehouseModal } from './components/WarehouseModal';
import { RecordStockMovementModal } from './components/RecordStockMovementModal';
import { StockTable } from './components/StockTable';
import { StockMovementsTable } from './components/StockMovementsTable';
import type { Warehouse } from '@/types';

export function WarehousePage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const canManage = permissions.includes(PERMISSIONS.WAREHOUSE_MANAGE);

  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isRecordMovementOpen, setIsRecordMovementOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);

  const warehousesQuery = useWarehousesQuery({ page: 1, limit: 100 });
  const productsQuery = useProductsQuery({ page: 1, limit: 100 });
  const warehouses = warehousesQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const deleteWarehouse = useDeleteWarehouse();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-[36px] font-semibold tracking-tight text-text-primary">{t('inventory:warehousePage.title')}</h1>
          <p className="mt-1 text-[14px] leading-[22px] text-text-secondary">{t('inventory:warehousePage.subtitle')}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsRecordMovementOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-text-primary text-[13px] font-medium transition-colors cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>{t('inventory:warehousePage.recordMovement')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNewOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>{t('inventory:warehousePage.newWarehouse')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="rounded-radius-md border border-[#E5E4E0] bg-white overflow-hidden mb-8">
        <QueryState
          isLoading={warehousesQuery.isLoading}
          isError={warehousesQuery.isError}
          onRetry={() => warehousesQuery.refetch()}
          loadingFallback={<FullPageSpinner label={t('inventory:warehousePage.loading')} />}
          errorTitle={t('inventory:warehousePage.errorTitle')}
        >
          {warehouses.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<WarehouseIcon className="h-8 w-8 text-text-tertiary stroke-1.5" />} title={t('inventory:warehousePage.emptyTitle')} />
            </div>
          ) : (
            <Table className="border-0">
              <TableHead className="bg-bg-subtle border-b border-border-subtle">
                <tr>
                  <TableHeadCell>{t('inventory:warehousePage.columns.name')}</TableHeadCell>
                  <TableHeadCell>{t('inventory:warehousePage.columns.address')}</TableHeadCell>
                  <TableHeadCell className="text-right">{t('inventory:warehousePage.columns.totalStock')}</TableHeadCell>
                  {canManage && <TableHeadCell className="text-right">{t('inventory:warehousePage.columns.actions')}</TableHeadCell>}
                </tr>
              </TableHead>
              <TableBody>
                {warehouses.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell label={t('inventory:warehousePage.columns.name')} className="font-medium text-text-primary">
                      {w.name}
                    </TableCell>
                    <TableCell label={t('inventory:warehousePage.columns.address')} className="text-slate-500">
                      {w.address || '—'}
                    </TableCell>
                    <TableCell label={t('inventory:warehousePage.columns.totalStock')} className="text-right font-mono tabular-nums font-medium">
                      {w.totalStockQuantity ?? 0}
                    </TableCell>
                    {canManage && (
                      <TableCell label={t('inventory:warehousePage.columns.actions')} className="text-right">
                        <Dropdown
                          align="right"
                          trigger={({ toggle }) => (
                            <button
                              type="button"
                              onClick={toggle}
                              className="rounded-radius-sm p-1.5 text-text-tertiary hover:bg-bg-subtle hover:text-text-primary cursor-pointer transition-colors"
                              aria-label={t('inventory:warehousePage.optionsAriaLabel')}
                            >
                              <MoreVerticalIcon className="h-4 w-4" />
                            </button>
                          )}
                        >
                          {({ close }) => (
                            <div className="w-40 py-1.5">
                              <DropdownItem
                                onClick={() => {
                                  setEditingWarehouse(w);
                                  close();
                                }}
                              >
                                <EditIcon className="h-4 w-4" /> {t('inventory:warehousePage.editWarehouse')}
                              </DropdownItem>
                              <DropdownItem
                                className="text-[#B3261E] hover:bg-[#F8E5E3]"
                                onClick={() => {
                                  setDeletingWarehouse(w);
                                  close();
                                }}
                              >
                                <TrashIcon className="h-4 w-4" /> {t('inventory:warehousePage.deleteWarehouse')}
                              </DropdownItem>
                            </div>
                          )}
                        </Dropdown>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </QueryState>
      </div>

      <div className="space-y-3">
        <Tabs
          tabs={[
            { value: 'stock', label: t('inventory:warehousePage.tabs.stock') },
            { value: 'movements', label: t('inventory:warehousePage.tabs.movements') },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'stock' | 'movements')}
        />
        {tab === 'stock' ? (
          <StockTable warehouses={warehouses} products={products} />
        ) : (
          <StockMovementsTable warehouses={warehouses} products={products} />
        )}
      </div>

      {canManage && (
        <>
          <WarehouseModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
          <WarehouseModal open={Boolean(editingWarehouse)} onClose={() => setEditingWarehouse(null)} warehouse={editingWarehouse} />
          <RecordStockMovementModal open={isRecordMovementOpen} onClose={() => setIsRecordMovementOpen(false)} />
          <ConfirmDialog
            open={Boolean(deletingWarehouse)}
            onClose={() => setDeletingWarehouse(null)}
            onConfirm={() => {
              if (deletingWarehouse) deleteWarehouse.mutate(deletingWarehouse.id);
              setDeletingWarehouse(null);
            }}
            title={t('inventory:warehousePage.deleteConfirmTitle')}
            description={deletingWarehouse ? t('inventory:warehousePage.deleteConfirmDescription', { name: deletingWarehouse.name }) : undefined}
            confirmLabel={t('inventory:warehousePage.deleteWarehouse')}
            danger
          />
        </>
      )}
    </div>
  );
}
