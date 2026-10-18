// 16/10/2026: Bang lich su bien dong kho (GET /stock-movements), loc theo kho/san pham - dung
// trong tab "Lịch sử biến động" cua WarehousePage.tsx. Mirror StockTable.tsx ve cau truc filter +
// phan trang.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { QueryState } from '@/components/ui/QueryState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { Badge } from '@/components/ui/Badge';
import { ActivityIcon } from '@/components/ui/Icons';
import { formatDateTime } from '@/lib/utils';
import { useStockMovementsQuery } from '../hooks';
import { stockMovementTypeBadgeVariant } from '../utils';
import type { Product, Warehouse } from '@/types';

const LIMIT = 20;

export function StockMovementsTable({ warehouses, products }: { warehouses: Warehouse[]; products: Product[] }) {
  const { t } = useTranslation();
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [warehouseId, productId]);

  const movementsQuery = useStockMovementsQuery({ page, limit: LIMIT, warehouseId: warehouseId || undefined, productId: productId || undefined });
  const items = movementsQuery.data?.data ?? [];
  const total = movementsQuery.data?.meta.total ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="w-full sm:w-56">
          <CustomFilterSelect
            value={warehouseId}
            onChange={setWarehouseId}
            ariaLabel={t('inventory:warehousePage.filters.warehouseLabel')}
            options={[
              { value: '', label: t('inventory:warehousePage.filters.allWarehouses') },
              ...warehouses.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
        </div>
        <div className="w-full sm:w-56">
          <CustomFilterSelect
            value={productId}
            onChange={setProductId}
            ariaLabel={t('inventory:warehousePage.filters.productLabel')}
            options={[
              { value: '', label: t('inventory:warehousePage.filters.allProducts') },
              ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
            ]}
          />
        </div>
      </div>

      <QueryState isLoading={movementsQuery.isLoading} isError={movementsQuery.isError} onRetry={() => movementsQuery.refetch()}>
        {items.length === 0 ? (
          <EmptyState icon={<ActivityIcon className="h-8 w-8 text-text-tertiary stroke-1.5" />} title={t('inventory:stockMovementsTable.emptyTitle')} />
        ) : (
          <>
            <Table>
              <TableHead>
                <tr>
                  <TableHeadCell>{t('inventory:stockMovementsTable.columns.date')}</TableHeadCell>
                  <TableHeadCell>{t('inventory:stockMovementsTable.columns.warehouse')}</TableHeadCell>
                  <TableHeadCell>{t('inventory:stockMovementsTable.columns.product')}</TableHeadCell>
                  <TableHeadCell>{t('inventory:stockMovementsTable.columns.type')}</TableHeadCell>
                  <TableHeadCell className="text-right">{t('inventory:stockMovementsTable.columns.quantityDelta')}</TableHeadCell>
                  <TableHeadCell>{t('inventory:stockMovementsTable.columns.note')}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell label={t('inventory:stockMovementsTable.columns.date')} className="whitespace-nowrap font-mono text-xs">
                      {formatDateTime(m.createdAt)}
                    </TableCell>
                    <TableCell label={t('inventory:stockMovementsTable.columns.warehouse')}>{m.warehouse?.name ?? '—'}</TableCell>
                    <TableCell label={t('inventory:stockMovementsTable.columns.product')}>
                      {m.product?.name ?? '—'}
                      {m.product?.sku && <span className="ml-1 font-mono text-xs text-slate-400">({m.product.sku})</span>}
                    </TableCell>
                    <TableCell label={t('inventory:stockMovementsTable.columns.type')}>
                      <Badge variant={stockMovementTypeBadgeVariant(m.type)}>{t(`inventory:enums.stockMovementType.${m.type}`)}</Badge>
                    </TableCell>
                    <TableCell
                      label={t('inventory:stockMovementsTable.columns.quantityDelta')}
                      className={`text-right font-mono tabular-nums font-medium ${m.quantityDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                    </TableCell>
                    <TableCell label={t('inventory:stockMovementsTable.columns.note')} className="max-w-[200px] truncate text-slate-500">
                      {m.note || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} limit={LIMIT} total={total} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </div>
  );
}
