import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Table, TableHead, TableBody, TableRow, TableHeadCell } from '@/components/ui/Table';
import { BriefcaseIcon, PlusIcon } from '@/components/ui/Icons';
import { matchesVietnameseSearch } from '@/lib/utils';
import { useCustomersQuery } from './hooks';
import { CustomerCard } from './components/CustomerCard';
import { CustomerTableRow } from './components/CustomerTableRow';
import { CrmFilterToolbar } from './components/CrmFilterToolbar';
import { NewCustomerModal } from './components/NewCustomerModal';

// 22/08/2026: mirror ProjectsListPage.tsx (features/projects) - kich thuoc trang cho luoi the.
const LIMIT = 20;

/** Danh sach khach hang (CRM-lite) - mirror ProjectsListPage.tsx (features/projects). */
export function CustomersListPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewOpen, setIsNewOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsNewOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-[36px] font-semibold tracking-tight text-text-primary">{t('crm:customersListPage.title')}</h1>
          <p className="mt-1 text-[14px] leading-[22px] text-text-secondary">{t('crm:customersListPage.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer shrink-0"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          <span>{t('crm:customersListPage.newCustomer')}</span>
        </button>
      </div>

      <CrmFilterToolbar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

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
            icon={<BriefcaseIcon className="h-10 w-10 text-text-tertiary stroke-1.5" />}
            title={hasFilters ? t('crm:customersListPage.emptyFilteredTitle') : t('crm:customersListPage.emptyTitle')}
            description={
              hasFilters
                ? t('crm:customersListPage.emptyFilteredDescription')
                : t('crm:customersListPage.emptyDescription')
            }
            action={!hasFilters && (
              <button
                type="button"
                onClick={() => setIsNewOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>{t('crm:customersListPage.addFirstCustomer')}</span>
              </button>
            )}
          />
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {displayedCustomers.map((customer) => (
                  <CustomerCard key={customer.id} customer={customer} />
                ))}
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeadCell className="px-4 py-3">{t('crm:customersListPage.columns.name', 'Khách hàng')}</TableHeadCell>
                    <TableHeadCell className="px-4 py-3">{t('crm:customersListPage.columns.company', 'Công ty')}</TableHeadCell>
                    <TableHeadCell className="px-4 py-3">{t('crm:customersListPage.columns.contact', 'Liên hệ')}</TableHeadCell>
                    <TableHeadCell className="px-4 py-3">{t('crm:customersListPage.columns.deals', 'Deal')}</TableHeadCell>
                    <TableHeadCell className="px-4 py-3">{t('crm:customersListPage.columns.lastInteraction', 'Tương tác')}</TableHeadCell>
                    <TableHeadCell className="px-4 py-3 text-right">{t('crm:customersListPage.columns.actions', 'Thao tác')}</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedCustomers.map((customer) => (
                    <CustomerTableRow key={customer.id} customer={customer} />
                  ))}
                </TableBody>
              </Table>
            )}
            <Pagination page={page} limit={LIMIT} total={totalFiltered} onPageChange={setPage} />
          </>
        )}
      </QueryState>

      <NewCustomerModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
