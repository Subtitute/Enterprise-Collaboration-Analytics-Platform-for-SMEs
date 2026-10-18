// 16/10/2026: Bang ton kho hien tai (GET /stock), loc theo kho/san pham - dung trong tab "Tồn kho"
// cua WarehousePage.tsx. Danh sach kho/san pham cho 2 dropdown loc duoc truyen tu cha (WarehousePage
// da co san, tranh goi them 1 query trung lap).
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from '@/components/ui/Table';
import { QueryState } from '@/components/ui/QueryState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { SearchIcon, WarehouseIcon } from '@/components/ui/Icons';
import { matchesVietnameseSearch } from '@/lib/utils';
import { useStockQuery } from '../hooks';
import type { Product, Warehouse } from '@/types';

const LIMIT = 20;

export function StockTable({ warehouses, products }: { warehouses: Warehouse[]; products: Product[] }) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, warehouseId, productId]);

  const stockQuery = useStockQuery({
    page: search ? 1 : page,
    limit: search ? 200 : LIMIT,
    warehouseId: warehouseId || undefined,
    productId: productId || undefined,
  });
  const rawItems = stockQuery.data?.data ?? [];

  const filteredItems = useMemo(() => {
    if (!search) return rawItems;
    return rawItems.filter(
      (s) =>
        matchesVietnameseSearch(s.product?.name ?? '', search) ||
        matchesVietnameseSearch(s.product?.sku ?? '', search),
    );
  }, [rawItems, search]);

  const total = search ? filteredItems.length : (stockQuery.data?.meta.total ?? 0);
  const displayedItems = useMemo(() => {
    if (!search) return filteredItems;
    const start = (page - 1) * LIMIT;
    return filteredItems.slice(start, start + LIMIT);
  }, [filteredItems, page, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary stroke-1.5" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('inventory:stockTable.searchPlaceholder')}
            aria-label={t('inventory:stockTable.searchPlaceholder')}
            className="h-9 w-full rounded-radius-sm border border-[#E5E4E0] bg-white pl-9 pr-3 text-[13px] text-[#1C1B1A] placeholder:text-text-tertiary focus:border-[#0E5E5E] focus:outline-none focus:ring-2 focus:ring-[#E4EFEE]"
          />
        </div>
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
        {displayedItems.length === 0 ? (
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
                {displayedItems.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell label={t('inventory:stockTable.columns.warehouse')}>{s.warehouse?.name ?? '—'}</TableCell>
                    <TableCell label={t('inventory:stockTable.columns.product')}>
                      <div className="flex flex-col">
                        <span className="text-[13px] leading-5 font-medium text-[#1C1B1A]">{s.product?.name ?? '—'}</span>
                        {s.product?.sku && (
                          <span className="font-mono text-[11px] leading-4 font-medium text-text-tertiary">
                            {s.product.sku}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell label={t('inventory:stockTable.columns.quantity')} className="text-right font-mono text-[13px] tabular-nums font-medium">
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
