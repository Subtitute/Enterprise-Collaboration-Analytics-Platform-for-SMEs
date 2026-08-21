import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { BuildingIcon, MailIcon, MoreVerticalIcon, TrashIcon } from '@/components/ui/Icons';
import { formatDealValue } from '../utils';
import { useDeleteCustomer } from '../hooks';
import type { Customer } from '@/types';

export function CustomerCard({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useDeleteCustomer();

  return (
    <>
      <Card className="flex flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/customers/${customer.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 hover:text-primary-700">{customer.name}</p>
          </Link>
          <Dropdown
            trigger={({ toggle }) => (
              <button
                onClick={toggle}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={t('crm:customerCard.optionsAriaLabel')}
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </button>
            )}
          >
            {({ close }) => (
              <div className="w-48 py-1.5">
                <DropdownItem
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    setConfirmDelete(true);
                    close();
                  }}
                >
                  <TrashIcon className="h-4 w-4" /> {t('crm:customerCard.deleteCustomer')}
                </DropdownItem>
              </div>
            )}
          </Dropdown>
        </div>

        {customer.company && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <BuildingIcon className="h-3.5 w-3.5" /> {customer.company}
          </p>
        )}
        {customer.email && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <MailIcon className="h-3.5 w-3.5" /> {customer.email}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-500">
            {t('crm:customerCard.openDeals', { count: customer.openDealCount ?? 0 })}
          </span>
          <span className="text-sm font-semibold text-primary-700">{formatDealValue(customer.openDealValue ?? 0)}</span>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          del.mutate(customer.id);
          setConfirmDelete(false);
        }}
        title={t('crm:customerCard.deleteConfirmTitle')}
        description={t('crm:customerCard.deleteConfirmDescription', { name: customer.name })}
        confirmLabel={t('crm:customerCard.deleteCustomer')}
        danger
      />
    </>
  );
}
