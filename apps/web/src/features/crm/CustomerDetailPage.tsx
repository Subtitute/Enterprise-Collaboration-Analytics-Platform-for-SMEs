import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
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
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeftIcon className="h-4 w-4" /> {t('crm:customerDetailPage.backToList')}
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
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <UserIcon className="h-3.5 w-3.5" />
              {t('crm:customerDetailPage.ownerLabel')}: <span className="font-medium text-slate-700">{ownerName}</span>
              {canReassignOwner && (
                <Dropdown
                  align="left"
                  panelClassName="w-64 p-1.5 rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 space-y-1"
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      title={t('crm:customerDetailPage.changeOwnerAriaLabel')}
                      className="cursor-pointer font-medium text-primary-600 hover:underline"
                    >
                      {t('crm:customerDetailPage.changeOwner')}
                    </button>
                  )}
                >
                  {({ close }) => (
                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                      <div className="border-b border-slate-100 px-2.5 py-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                          className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors duration-150 hover:bg-slate-50"
                        >
                          <Avatar name={u.fullName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-800 transition-colors group-hover:text-primary-600">
                              {u.fullName}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">{u.email}</p>
                          </div>
                          {u.id === customer.ownerUserId && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </Dropdown>
              )}
            </span>
            <span className="text-xs text-slate-500">
              {t('crm:customerDetailPage.openDealsSummary', {
                count: customer.openDealCount ?? 0,
                value: formatDealValue(customer.openDealValue ?? 0),
              })}
            </span>
          </div>
          {customer.notes && <p className="mt-2 max-w-2xl text-sm text-slate-500">{customer.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => setIsNewDealOpen(true)}>
            <PlusIcon className="h-4 w-4" /> {t('crm:customerDetailPage.newDeal')}
          </Button>
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
          <EmptyState
            title={t('crm:customerDetailPage.emptyDealsTitle')}
            description={t('crm:customerDetailPage.emptyDealsDescription')}
            action={<Button onClick={() => setIsNewDealOpen(true)}>{t('crm:customerDetailPage.createFirstDeal')}</Button>}
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
