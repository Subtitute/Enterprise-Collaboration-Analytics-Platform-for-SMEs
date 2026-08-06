import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { ChevronLeftIcon, MailIcon, PlusIcon, BuildingIcon } from '@/components/ui/Icons';
import { formatDealValue } from './utils';
import { useCustomerQuery, useDealsQuery } from './hooks';
import { DealKanbanBoard } from './components/DealKanbanBoard';
import { NewDealModal } from './components/NewDealModal';
import { DealDetailModal } from './components/DealDetailModal';
import type { Deal } from '@/types';

/** Chi tiet khach hang + Kanban pipeline ban hang (Wireframe.md muc 12) - mirror ProjectDetailPage.tsx. */
export function CustomerDetailPage() {
  const { customerId = '' } = useParams<{ customerId: string }>();
  const customerQuery = useCustomerQuery(customerId);
  const dealsQuery = useDealsQuery(customerId);

  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  if (customerQuery.isLoading) return <FullPageSpinner label="Đang tải khách hàng…" />;
  if (customerQuery.isError || !customerQuery.data) {
    return <EmptyState title="Không tìm thấy khách hàng" description="Khách hàng có thể đã bị xoá hoặc bạn không có quyền truy cập." />;
  }

  const customer = customerQuery.data;
  const deals = dealsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeftIcon className="h-4 w-4" /> Quay lại danh sách khách hàng
      </Link>

      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">{customer.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            {customer.company && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <BuildingIcon className="h-3.5 w-3.5" /> {customer.company}
              </span>
            )}
            {customer.email && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MailIcon className="h-3.5 w-3.5" /> {customer.email}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {customer.openDealCount ?? 0} deal đang hoạt động — {formatDealValue(customer.openDealValue ?? 0)}
            </span>
          </div>
          {customer.notes && <p className="mt-2 max-w-2xl text-sm text-slate-500">{customer.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => setIsNewDealOpen(true)}>
            <PlusIcon className="h-4 w-4" /> Deal mới
          </Button>
        </div>
      </div>

      <QueryState
        isLoading={dealsQuery.isLoading}
        isError={dealsQuery.isError}
        onRetry={() => dealsQuery.refetch()}
        loadingFallback={<FullPageSpinner label="Đang tải deal…" />}
        errorTitle="Không thể tải deal"
        errorDescription="Đã xảy ra lỗi khi tải danh sách deal của khách hàng. Vui lòng thử lại."
      >
        {deals.length === 0 ? (
          <EmptyState
            title="Chưa có deal nào"
            description="Tạo cơ hội bán hàng đầu tiên cho khách hàng này."
            action={<Button onClick={() => setIsNewDealOpen(true)}>Tạo deal mới</Button>}
          />
        ) : (
          <DealKanbanBoard customerId={customerId} deals={deals} onDealClick={setSelectedDeal} />
        )}
      </QueryState>

      <NewDealModal customerId={customerId} open={isNewDealOpen} onClose={() => setIsNewDealOpen(false)} />
      <DealDetailModal customerId={customerId} deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
    </div>
  );
}
