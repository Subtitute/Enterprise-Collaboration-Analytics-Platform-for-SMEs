import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TableRow, TableCell } from '@/components/ui/Table';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { BuildingIcon, EditIcon, MailIcon, MoreVerticalIcon, PhoneIcon, TrashIcon } from '@/components/ui/Icons';
import { formatRelativeTime } from '@/lib/utils';
import { formatDealValue } from '../utils';
import { useDeleteCustomer } from '../hooks';
import { CustomerTypeBadge } from './CustomerCard';
import { EditCustomerModal } from './EditCustomerModal';
import type { Customer } from '@/types';

interface CustomerTableRowProps {
  customer: Customer;
}

export const CustomerTableRow = React.memo(function CustomerTableRow({ customer }: CustomerTableRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const del = useDeleteCustomer();

  const lastInteraction = formatRelativeTime(customer.updatedAt || customer.createdAt);
  const dealValue = customer.openDealValue ?? 0;
  const dealCount = customer.openDealCount ?? 0;

  return (
    <>
      <TableRow
        onClick={() => navigate(`/customers/${customer.id}`)}
        className="cursor-pointer group hover:bg-bg-subtle/80 transition-colors"
      >
        {/* Cột 1: Tên khách hàng & Badge loại */}
        <TableCell label={t('crm:customersListPage.columns.name')} className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-semibold text-[14px] text-text-primary group-hover:text-accent transition-colors truncate">
              {customer.name}
            </span>
            <CustomerTypeBadge notes={customer.notes} />
          </div>
        </TableCell>

        {/* Cột 2: Công ty */}
        <TableCell label={t('crm:customersListPage.columns.company')} className="px-4 py-3">
          {customer.company ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary truncate">
              <BuildingIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary stroke-1.5" />
              <span className="truncate">{customer.company}</span>
            </span>
          ) : (
            <span className="text-text-tertiary text-[13px]">—</span>
          )}
        </TableCell>

        {/* Cột 3: Liên hệ (Email / Phone) */}
        <TableCell label={t('crm:customersListPage.columns.contact')} className="px-4 py-3">
          <div className="space-y-0.5 text-[12px]">
            {customer.email && (
              <span className="flex items-center gap-1.5 font-mono text-text-secondary truncate">
                <MailIcon className="h-3 w-3 shrink-0 text-text-tertiary stroke-1.5" />
                <span className="truncate">{customer.email}</span>
              </span>
            )}
            {customer.phone && (
              <span className="flex items-center gap-1.5 font-mono text-text-tertiary truncate">
                <PhoneIcon className="h-3 w-3 shrink-0 text-text-tertiary stroke-1.5" />
                <span className="truncate">{customer.phone}</span>
              </span>
            )}
            {!customer.email && !customer.phone && <span className="text-text-tertiary">—</span>}
          </div>
        </TableCell>

        {/* Cột 4: Deals mở & Giá trị */}
        <TableCell label={t('crm:customersListPage.columns.deals', 'Deal')} className="px-4 py-3 font-mono tabular-nums text-[13px]">
          <span className="font-medium text-text-primary">{dealCount} deal</span>
          <span className="text-text-tertiary mx-1.5">·</span>
          <span className={dealValue > 0 ? 'font-medium text-accent' : 'text-text-tertiary'}>
            {formatDealValue(dealValue)}
          </span>
        </TableCell>

        {/* Cột 5: Tương tác cuối */}
        <TableCell label={t('crm:customersListPage.columns.lastInteraction')} className="px-4 py-3 font-mono text-[12px] text-text-tertiary tabular-nums">
          {lastInteraction}
        </TableCell>

        {/* Cột 6: Hành động */}
        <TableCell className="px-4 py-3 text-right">
          <Dropdown
            align="right"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer ml-auto"
                aria-label={t('crm:customerCard.optionsAriaLabel')}
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </button>
            )}
          >
            {({ close }) => (
              <div
                className="min-w-[180px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm hover:bg-bg-subtle text-[13px] text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditOpen(true);
                    close();
                  }}
                >
                  <EditIcon className="h-4 w-4 text-text-secondary" /> {t('crm:customerCard.editCustomer')}
                </DropdownItem>
                <DropdownItem
                  className="h-9 px-2.5 rounded-radius-sm text-[13px] text-[#B3261E] hover:bg-[#F8E5E3]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(true);
                    close();
                  }}
                >
                  <TrashIcon className="h-4 w-4 text-[#B3261E]" /> {t('crm:customerCard.deleteCustomer')}
                </DropdownItem>
              </div>
            )}
          </Dropdown>
        </TableCell>
      </TableRow>

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
});

