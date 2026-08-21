import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { BriefcaseIcon, PlusIcon, SearchIcon } from '@/components/ui/Icons';
import { useCustomersQuery } from './hooks';
import { CustomerCard } from './components/CustomerCard';
import { NewCustomerModal } from './components/NewCustomerModal';

/** Danh sach khach hang (CRM-lite) - mirror ProjectsListPage.tsx (features/projects). */
export function CustomersListPage() {
  const { t } = useTranslation();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce 400ms de khong goi API lien tuc theo tung ky tu go, mirror ProjectsListPage.tsx.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const customersQuery = useCustomersQuery({ limit: 100, search: search || undefined });
  const customers = customersQuery.data?.data ?? [];
  const hasFilters = Boolean(search);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('crm:customersListPage.title')}</h1>
          <p className="text-sm text-slate-500">{t('crm:customersListPage.subtitle')}</p>
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
        {customers.length === 0 ? (
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {customers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        )}
      </QueryState>

      <NewCustomerModal open={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
