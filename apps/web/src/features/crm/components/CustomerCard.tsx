import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { BuildingIcon, EditIcon, MailIcon, MoreVerticalIcon, TrashIcon } from '@/components/ui/Icons';
import { formatRelativeTime } from '@/lib/utils';
import { formatDealValue } from '../utils';
import { useDeleteCustomer } from '../hooks';
import { EditCustomerModal } from './EditCustomerModal';
import type { Customer } from '@/types';

export function CustomerCard({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const del = useDeleteCustomer();

  const lastInteraction = formatRelativeTime(customer.updatedAt || customer.createdAt);

  return (
    <>
      <Card
        onClick={() => navigate(`/customers/${customer.id}`)}
        className="group relative flex flex-col justify-between p-5 border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-300 cursor-pointer"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
              <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-primary-700 transition-colors">
                {customer.name}
              </p>
              {customer.notes && (
                <span
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0 max-w-[120px] truncate"
                  title={customer.notes}
                >
                  {customer.notes}
                </span>
              )}
            </div>
            <Dropdown
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer -mr-1"
                  aria-label={t('crm:customerCard.optionsAriaLabel')}
                >
                  <MoreVerticalIcon className="h-4 w-4" />
                </button>
              )}
            >
              {({ close }) => (
                <div
                  className="w-48 py-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditOpen(true);
                      close();
                    }}
                  >
                    <EditIcon className="h-4 w-4 text-slate-500" /> Chỉnh sửa thông tin
                  </DropdownItem>
                  <DropdownItem
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={(e) => {
                      e.stopPropagation();
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
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 truncate">
              <BuildingIcon className="h-3.5 w-3.5 shrink-0" /> {customer.company}
            </p>
          )}
          {customer.email && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 truncate">
              <MailIcon className="h-3.5 w-3.5 shrink-0" /> {customer.email}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400 italic">
            Tương tác: {lastInteraction}
          </span>
          <span
            className={
              (customer.openDealValue ?? 0) === 0
                ? 'text-sm font-normal text-slate-400'
                : (customer.openDealValue ?? 0) >= 1_000_000_000
                ? 'text-sm font-bold text-indigo-700 tracking-tight'
                : 'text-sm font-semibold text-primary-700'
            }
          >
            {formatDealValue(customer.openDealValue ?? 0)}
          </span>
        </div>
      </Card>

      <EditCustomerModal
        customer={customer}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

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
