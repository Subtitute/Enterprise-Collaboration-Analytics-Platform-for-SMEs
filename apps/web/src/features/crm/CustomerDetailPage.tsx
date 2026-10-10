import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryState } from '@/components/ui/QueryState';
import { Dropdown } from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronLeftIcon, MailIcon, PlusIcon, BuildingIcon, UserIcon, CheckIcon } from '@/components/ui/Icons';
import { usePermissions } from '@/stores/auth.store';
import { useUserNameMap } from '@/hooks/useOrgUsers';
import { formatDealValue } from './utils';
import { useCustomerQuery, useDealsQuery, useUpdateCustomer } from './hooks';
import { DealKanbanBoard } from './components/DealKanbanBoard';
import { NewDealModal } from './components/NewDealModal';
import { DealDetailModal } from './components/DealDetailModal';
import type { Deal } from '@/types';
import { PERMISSIONS } from '@/constants/permissions';

/** Chi tiet khach hang + Kanban pipeline ban hang (Wireframe.md muc 12) - mirror ProjectDetailPage.tsx. */
export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { customerId = '' } = useParams<{ customerId: string }>();
  const customerQuery = useCustomerQuery(customerId);
  const dealsQuery = useDealsQuery(customerId);

  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const { map: userNameMap, users: orgUsers } = useUserNameMap();
  const updateCustomerOwner = useUpdateCustomer(customerId);
  const permissions = usePermissions();

  // 17/09/2026: Doi nguoi phu trach khach hang (Customer.ownerUserId, PATCH /customers/:id) - BE
  // da xac thuc PERMISSIONS.CUSTOMER_UPDATE truoc khi cho goi endpoint nay. Dung usePermissions()
  // (stores/auth.store.ts, giai ma truong permissions[] co san trong JWT access token) thay vi
  // doan ten vai tro - day chinh la ly do ham nay ra doi (xem chu thich canAccessAdminArea,
  // lib/utils.ts), tranh sai neu 1 to chuc tuy chinh lai quyen cua vai tro qua trang Roles &
  // Permissions (luc do doan theo TEN vai tro se sai). Chi an/hien nut - BE van la noi thuc thi
  // that su, PATCH van tra 403 neu tai khoan khong thuc su co quyen.
  const canReassignOwner = permissions.includes(PERMISSIONS.CUSTOMER_UPDATE);

  if (customerQuery.isLoading) return <FullPageSpinner label={t('crm:customerDetailPage.loading')} />;
  if (customerQuery.isError || !customerQuery.data) {
    return (
      <EmptyState
        title={t('crm:customerDetailPage.notFoundTitle')}
        description={t('crm:customerDetailPage.notFoundDescription')}
      />
    );
  }

  const customer = customerQuery.data;
  const deals = dealsQuery.data ?? [];
  const ownerName = userNameMap[customer.ownerUserId] ?? '—';

  return (
    <div className="space-y-5">
      <Link to="/customers" className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary transition-colors">
        <ChevronLeftIcon className="h-3.5 w-3.5 stroke-1.5" /> {t('crm:customerDetailPage.backToList', 'Quay lại danh sách khách hàng')}
      </Link>

      <div className="flex flex-col justify-between gap-4 rounded-radius-lg border border-border-subtle bg-white p-5 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-[30px] font-semibold text-text-primary">{customer.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {customer.company && (
              <span className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                <BuildingIcon className="h-3.5 w-3.5 text-text-tertiary stroke-1.5" /> {customer.company}
              </span>
            )}
            {customer.email && (
              <span className="flex items-center gap-1.5 text-[13px] text-text-secondary font-mono text-[12px]">
                <MailIcon className="h-3.5 w-3.5 text-text-tertiary stroke-1.5" /> {customer.email}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-[13px] text-text-secondary">
              <UserIcon className="h-3.5 w-3.5 text-text-tertiary stroke-1.5" />
              <span>{t('crm:customerDetailPage.ownerLabel', 'Phụ trách')}: <strong className="font-medium text-text-primary">{ownerName}</strong></span>
              {canReassignOwner && (
                <>
                  <span>·</span>
                  <Dropdown
                    align="left"
                    panelClassName="min-w-[240px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md space-y-0.5"
                    trigger={({ toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        title={t('crm:customerDetailPage.changeOwnerAriaLabel')}
                        className="cursor-pointer font-medium text-accent hover:underline text-[13px]"
                      >
                        {t('crm:customerDetailPage.changeOwner', 'Đổi')}
                      </button>
                    )}
                  >
                    {({ close }) => (
                      <div className="max-h-60 overflow-y-auto space-y-0.5">
                        <div className="border-b border-border-subtle px-2.5 py-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                            {t('crm:customerDetailPage.reassignOwnerHeading')}
                          </p>
                        </div>
                        {orgUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              if (u.id !== customer.ownerUserId) updateCustomerOwner.mutate({ ownerUserId: u.id });
                              close();
                            }}
                            className="group flex w-full items-center gap-2.5 rounded-radius-sm px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-bg-subtle cursor-pointer"
                          >
                            <Avatar name={u.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-text-primary">
                                {u.fullName}
                              </p>
                              <p className="truncate font-mono text-[10px] text-text-tertiary tabular-nums">{u.email}</p>
                            </div>
                            {u.id === customer.ownerUserId && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-[#2F6F44]" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </Dropdown>
                </>
              )}
            </span>
          </div>

          <div className="mt-2 text-[13px] text-text-secondary">
            <span className="font-mono tabular-nums">{customer.openDealCount ?? 0}</span> {t('crm:customerDetailPage.openDealsSuffix', 'deal đang hoạt động')} — <span className="font-mono text-accent font-medium tabular-nums">{formatDealValue(customer.openDealValue ?? 0)}</span>
          </div>

          {customer.notes && <p className="mt-2 max-w-2xl text-[13px] text-text-tertiary">{customer.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewDealOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>{t('crm:customerDetailPage.newDeal', 'Deal mới')}</span>
          </button>
        </div>
      </div>

      <QueryState
        isLoading={dealsQuery.isLoading}
        isError={dealsQuery.isError}
        onRetry={() => dealsQuery.refetch()}
        loadingFallback={<FullPageSpinner label={t('crm:customerDetailPage.dealsLoading')} />}
        errorTitle={t('crm:customerDetailPage.dealsErrorTitle')}
        errorDescription={t('crm:customerDetailPage.dealsErrorDescription')}
      >
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-radius-lg border border-dashed border-border-subtle bg-white p-10 text-center">
            <h3 className="text-[16px] font-medium text-text-primary">{t('crm:customerDetailPage.emptyDealsTitle', 'Chưa có deal nào')}</h3>
            <p className="mt-1 text-[13px] text-text-tertiary">{t('crm:customerDetailPage.emptyDealsDescription', 'Tạo cơ hội bán hàng đầu tiên cho khách hàng này.')}</p>
            <button
              type="button"
              onClick={() => setIsNewDealOpen(true)}
              className="mt-4 inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>{t('crm:customerDetailPage.createFirstDeal', 'Tạo deal mới')}</span>
            </button>
          </div>
        ) : (
          <DealKanbanBoard customerId={customerId} deals={deals} onDealClick={setSelectedDeal} />
        )}
      </QueryState>

      <NewDealModal customerId={customerId} open={isNewDealOpen} onClose={() => setIsNewDealOpen(false)} />
      <DealDetailModal customerId={customerId} deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
    </div>
  );
}
