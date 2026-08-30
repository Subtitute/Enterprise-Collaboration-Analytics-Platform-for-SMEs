import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { BriefcaseIcon, PlusIcon, SearchIcon } from '@/components/ui/Icons';
import { matchesVietnameseSearch } from '@/lib/utils';
import { useCustomersQuery } from './hooks';
import { CustomerCard } from './components/CustomerCard';
import { NewCustomerModal } from './components/NewCustomerModal';

// 22/08/2026: mirror ProjectsListPage.tsx (features/projects) - kich thuoc trang cho luoi the.
const LIMIT = 20;

/** Danh sach khach hang (CRM-lite) - mirror ProjectsListPage.tsx (features/projects). */
export function CustomersListPage() {
  const { t } = useTranslation();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Debounce 300ms de khong goi API lien tuc theo tung ky tu go, mirror ProjectsListPage.tsx.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 22/08/2026: doi tim kiem thi quay ve trang 1, mirror ProjectsListPage.tsx.
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Lấy dữ liệu với limit lớn hơn khi tìm kiếm để hỗ trợ tìm kiếm tiếng Việt không dấu client-side toàn diện
  const customersQuery = useCustomersQuery({ page: search ? 1 : page, limit: search ? 200 : LIMIT });

  const rawCustomers = customersQuery.data?.data ?? [];

  const filteredCustomers = useMemo(() => {
    if (!search) return rawCustomers;
    return rawCustomers.filter(
      (c) =>
        matchesVietnameseSearch(c.name, search) ||
        matchesVietnameseSearch(c.company, search) ||
        matchesVietnameseSearch(c.notes, search) ||
        matchesVietnameseSearch(c.email, search) ||
        matchesVietnameseSearch(c.phone, search)
    );
  }, [rawCustomers, search]);

  const totalFiltered = search ? filteredCustomers.length : (customersQuery.data?.meta.total ?? 0);
  const displayedCustomers = useMemo(() => {
    if (!search) return filteredCustomers;
    const start = (page - 1) * LIMIT;
    return filteredCustomers.slice(start, start + LIMIT);
  }, [filteredCustomers, page, search]);

  // 22/08/2026: xoa khach hang lam giam tong so ket qua co the khien trang hien tai vuot qua trang
  // cuoi cung (vd. dang o trang cuoi chi con 1 khach hang, xoa xong) - BE khong tu dong dieu chinh,
  // chi tra ve data: [] cho trang khong con hop le nua, nen can tu clamp ve trang cuoi cung hop le
  // o day, mirror ProjectsListPage.tsx.
  useEffect(() => {
    if (page > 1 && (page - 1) * LIMIT >= totalFiltered) {
      setPage(Math.max(1, Math.ceil(totalFiltered / LIMIT)));
    }
  }, [totalFiltered, page]);

  const hasFilters = Boolean(search);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('crm:customersListPage.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('crm:customersListPage.subtitle')}</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)}>
          <PlusIcon className="h-4 w-4" /> {t('crm:customersListPage.newCustomer')}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('crm:customersListPage.searchPlaceholder')}
          aria-label={t('crm:customersListPage.searchPlaceholder')}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <QueryState
        isLoading={customersQuery.isLoading}
        isError={customersQuery.isError}
        onRetry={() => customersQuery.refetch()}
        loadingFallback={<FullPageSpinner label={t('crm:customersListPage.loading')} />}
        errorTitle={t('crm:customersListPage.errorTitle')}
        errorDescription={t('crm:customersListPage.errorDescription')}
      >
        {displayedCustomers.length === 0 ? (
          <EmptyState
            icon={<BriefcaseIcon className="h-10 w-10" />}
            title={hasFilters ? t('crm:customersListPage.emptyFilteredTitle') : t('crm:customersListPage.emptyTitle')}
            description={
              hasFilters
                ? t('crm:customersListPage.emptyFilteredDescription')
                : t('crm:customersListPage.emptyDescription')
            }
            action={!hasFilters && <Button onClick={() => setIsNewOpen(true)}>{t('crm:customersListPage.addFirstCustomer')}</Button>}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayedCustomers.map((customer) => (
                <CustomerCard key={customer.id} customer={customer} />
              ))}
            </div>
            <Pagination page={page} limit={LIMIT} total={totalFiltered} onPageChange={setPage} />
          </>
        )}
      </QueryState>

      <NewCustomerModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
