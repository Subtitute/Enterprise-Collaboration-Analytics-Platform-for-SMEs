import { useEffect, useState } from 'react';
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
          <h1 className="text-xl font-semibold text-slate-900">Khách hàng</h1>
          <p className="text-sm text-slate-500">Quản lý khách hàng và cơ hội bán hàng (deal pipeline).</p>
        </div>
        <Button onClick={() => setIsNewOpen(true)}>
          <PlusIcon className="h-4 w-4" /> Khách hàng mới
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm kiếm khách hàng…"
          aria-label="Tìm kiếm khách hàng…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <QueryState
        isLoading={customersQuery.isLoading}
        isError={customersQuery.isError}
        onRetry={() => customersQuery.refetch()}
        loadingFallback={<FullPageSpinner label="Đang tải danh sách khách hàng…" />}
        errorTitle="Không thể tải danh sách khách hàng"
        errorDescription="Đã xảy ra lỗi khi tải danh sách khách hàng. Vui lòng thử lại."
      >
        {customers.length === 0 ? (
          <EmptyState
            icon={<BriefcaseIcon className="h-10 w-10" />}
            title={hasFilters ? 'Không tìm thấy khách hàng phù hợp' : 'Chưa có khách hàng nào'}
            description={
              hasFilters
                ? 'Thử điều chỉnh từ khóa tìm kiếm.'
                : 'Thêm khách hàng đầu tiên để bắt đầu theo dõi cơ hội bán hàng.'
            }
            action={!hasFilters && <Button onClick={() => setIsNewOpen(true)}>Thêm khách hàng mới</Button>}
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
