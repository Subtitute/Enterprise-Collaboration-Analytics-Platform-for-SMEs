// 16/10/2026: Bang ton kho hien tai (GET /stock), loc theo kho/san pham - dung trong tab "Tồn kho"
// cua WarehousePage.tsx. Danh sach kho/san pham cho 2 dropdown loc duoc truyen tu cha (WarehousePage
// da co san, tranh goi them 1 query trung lap).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { QueryState } from '@/components/ui/QueryState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { WarehouseIcon } from '@/components/ui/Icons';
import { useStockQuery } from '../hooks';
import type { Product, Warehouse } from '@/types';

const LIMIT = 20;

export function StockTable({ warehouses, products }: { warehouses: Warehouse[]; products: Product[] }) {
  const { t } = useTranslation();
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [warehouseId, productId]);

  const stockQuery = useStockQuery({ page, limit: LIMIT, warehouseId: warehouseId || undefined, productId: productId || undefined });
  const items = stockQuery.data?.data ?? [];
  const total = stockQuery.data?.meta.total ?? 0;

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

      <QueryState isLoading={stockQuery.isLoading} isError={stockQuery.isError} onRetry={() => stockQuery.refetch()}>
        {items.length === 0 ? (
          <EmptyState icon={<WarehouseIcon className="h-8 w-8 text-text-tertiary stroke-1.5" />} title={t('inventory:stockTable.emptyTitle')} />
        ) : (
          <>
            <Table>
              <TableHead>
                <tr>
                  <TableHeadCell>{t('inventory:stockTable.columns.warehouse')}</TableHeadCell>
                  <TableHeadCell>{t('inventory:stockTable.columns.product')}</TableHeadCell>
                  <TableHeadCell className="text-right">{t('inventory:stockTable.columns.quantity')}</TableHeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell label={t('inventory:stockTable.columns.warehouse')}>{s.warehouse?.name ?? '—'}</TableCell>
                    <TableCell label={t('inventory:stockTable.columns.product')}>
                      {s.product?.name ?? '—'}
                      {s.product?.sku && <span className="ml-1 font-mono text-xs text-slate-400">({s.product.sku})</span>}
                    </TableCell>
                    <TableCell label={t('inventory:stockTable.columns.quantity')} className="text-right font-mono tabular-nums font-medium">
                      {s.quantity}
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
