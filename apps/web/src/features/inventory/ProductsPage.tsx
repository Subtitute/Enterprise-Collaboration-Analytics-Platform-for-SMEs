// 16/10/2026: Trang "Danh mục sản phẩm" (Inventory Service) - mirror CustomersListPage.tsx
// (features/crm) ve cau truc: tim kiem debounce 300ms + loc phia client theo dau tieng Viet
// (matchesVietnameseSearch, giong CustomersListPage.tsx) ket hop loc categoryId phia server, luoi
// the san pham + phan trang. Tao/sua/xoa san pham va quan ly danh muc deu CHI hien khi co
// PRODUCT_MANAGE (PRODUCT_VIEW da du de vao trang, xem App.tsx - route nay khong gan
// requiredPermission vi ca 3 vai tro deu co PRODUCT_VIEW).
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { PackageIcon, PlusIcon, SearchIcon, SettingsIcon } from '@/components/ui/Icons';
import { matchesVietnameseSearch } from '@/lib/utils';
import { useProductCategoriesQuery, useProductsQuery } from './hooks';
import { ProductCard } from './components/ProductCard';
import { ProductFormModal } from './components/ProductFormModal';
import { ManageCategoriesModal } from './components/ManageCategoriesModal';

const LIMIT = 20;

export function ProductsPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const canManage = permissions.includes(PERMISSIONS.PRODUCT_MANAGE);

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);

  // Debounce 300ms de khong goi API lien tuc theo tung ky tu go, mirror CustomersListPage.tsx.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId]);

  const categoriesQuery = useProductCategoriesQuery({ page: 1, limit: 100 });
  const categories = categoriesQuery.data?.data ?? [];
  const categoryNameMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  // categoryId loc phia server (dung id, khong can diacritic-insensitive); search ten/SKU loc
  // phia client (mirror CustomersListPage.tsx) vi can khop ca khong dau tieng Viet.
  const productsQuery = useProductsQuery({
    page: search ? 1 : page,
    limit: search ? 200 : LIMIT,
    categoryId: categoryId || undefined,
  });

  const rawProducts = productsQuery.data?.data ?? [];

  const filteredProducts = useMemo(() => {
    if (!search) return rawProducts;
    return rawProducts.filter((p) => matchesVietnameseSearch(p.name, search) || matchesVietnameseSearch(p.sku, search));
  }, [rawProducts, search]);

  const totalFiltered = search ? filteredProducts.length : (productsQuery.data?.meta.total ?? 0);
  const displayedProducts = useMemo(() => {
    if (!search) return filteredProducts;
    const start = (page - 1) * LIMIT;
    return filteredProducts.slice(start, start + LIMIT);
  }, [filteredProducts, page, search]);

  // Xoa san pham/doi loc co the khien trang hien tai vuot qua trang cuoi cung - tu clamp ve trang
  // cuoi hop le, mirror CustomersListPage.tsx.
  useEffect(() => {
    if (page > 1 && (page - 1) * LIMIT >= totalFiltered) {
      setPage(Math.max(1, Math.ceil(totalFiltered / LIMIT)));
    }
  }, [totalFiltered, page]);

  const hasFilters = Boolean(search) || Boolean(categoryId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-[36px] font-semibold tracking-tight text-text-primary">{t('inventory:productsPage.title')}</h1>
          <p className="mt-1 text-[14px] leading-[22px] text-text-secondary">{t('inventory:productsPage.subtitle')}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsManageCategoriesOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-text-primary text-[13px] font-medium transition-colors cursor-pointer"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              <span>{t('inventory:productsPage.manageCategories')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNewOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>{t('inventory:productsPage.newProduct')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary stroke-1.5" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('inventory:productsPage.searchPlaceholder')}
            aria-label={t('inventory:productsPage.searchPlaceholder')}
            className="h-9 w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>
        <div className="w-full sm:w-56">
          <CustomFilterSelect
            value={categoryId}
            onChange={setCategoryId}
            ariaLabel={t('inventory:productsPage.categoryFilterAllLabel')}
            options={[
              { value: '', label: t('inventory:productsPage.categoryFilterAllLabel') },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      </div>

      <QueryState
        isLoading={productsQuery.isLoading}
        isError={productsQuery.isError}
        onRetry={() => productsQuery.refetch()}
        loadingFallback={<FullPageSpinner label={t('inventory:productsPage.loading')} />}
        errorTitle={t('inventory:productsPage.errorTitle')}
        errorDescription={t('inventory:productsPage.errorDescription')}
      >
        {displayedProducts.length === 0 ? (
          <EmptyState
            icon={<PackageIcon className="h-10 w-10 text-text-tertiary stroke-1.5" />}
            title={hasFilters ? t('inventory:productsPage.emptyFilteredTitle') : t('inventory:productsPage.emptyTitle')}
            description={hasFilters ? t('inventory:productsPage.emptyFilteredDescription') : t('inventory:productsPage.emptyDescription')}
            action={
              !hasFilters &&
              canManage && (
                <button
                  type="button"
                  onClick={() => setIsNewOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span>{t('inventory:productsPage.addFirstProduct')}</span>
                </button>
              )
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {displayedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryName={categoryNameMap[product.categoryId] ?? t('inventory:productCard.unknownCategory')}
                />
              ))}
            </div>
            <Pagination page={page} limit={LIMIT} total={totalFiltered} onPageChange={setPage} />
          </>
        )}
      </QueryState>

      {canManage && (
        <>
          <ProductFormModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
          <ManageCategoriesModal open={isManageCategoriesOpen} onClose={() => setIsManageCategoriesOpen(false)} />
        </>
      )}
    </div>
  );
}
