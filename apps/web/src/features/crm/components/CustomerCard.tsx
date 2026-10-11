import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { BuildingIcon, EditIcon, MailIcon, MoreVerticalIcon, TrashIcon } from '@/components/ui/Icons';
import { formatRelativeTime } from '@/lib/utils';
import { formatDealValue } from '../utils';
import { useDeleteCustomer } from '../hooks';
import { EditCustomerModal } from './EditCustomerModal';
import type { Customer } from '@/types';

export function CustomerTypeBadge({ notes }: { notes?: string | null }) {
  if (!notes) return null;

  // Đối chiếu Badge loại khách hàng theo §5
  // Khách hàng mới: info-soft #E4EEF5, info #1E5A8A
  // Khách hàng thân thiết: success-soft #E6F1E9, success #2F6F44
  // Khách hàng tiềm năng: warning-soft #FBEEE0, warning #B45309
  // Mặc định / khác: bg-bg-subtle, text-text-secondary
  let colorStyles = 'bg-bg-subtle text-text-secondary';
  let dotColor = 'bg-text-secondary';

  const n = notes.toLowerCase();
  if (n.includes('mới') || n.includes('new')) {
    colorStyles = 'bg-[#E4EEF5] text-[#1E5A8A]';
    dotColor = 'bg-[#1E5A8A]';
  } else if (n.includes('thân thiết') || n.includes('loyal') || n.includes('vip')) {
    colorStyles = 'bg-[#E6F1E9] text-[#2F6F44]';
    dotColor = 'bg-[#2F6F44]';
  } else if (n.includes('tiềm năng') || n.includes('lead')) {
    colorStyles = 'bg-[#FBEEE0] text-[#B45309]';
    dotColor = 'bg-[#B45309]';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-radius-xs text-[11px] font-semibold shrink-0 max-w-[150px] truncate ${colorStyles}`}
      title={notes}
    >
      <span className={`h-1 w-1 rounded-full shrink-0 ${dotColor}`} />
      <span className="truncate">{notes}</span>
    </span>
  );
}

export const CustomerCard = React.memo(function CustomerCard({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const del = useDeleteCustomer();

  const lastInteraction = formatRelativeTime(customer.updatedAt || customer.createdAt);
  const dealValue = customer.openDealValue ?? 0;

  return (
    <>
      <div
        onClick={() => navigate(`/customers/${customer.id}`)}
        className="group relative flex flex-col justify-between p-5 rounded-radius-lg border border-border-subtle bg-white transition-colors hover:border-border-strong cursor-pointer select-none"
      >
        <div>
          {/* Row 1: Tên 15/22 w600 text-primary + Badge KH (§5) + menu ⋯ */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
              <p className="truncate text-[15px] leading-[22px] font-semibold text-text-primary group-hover:text-accent transition-colors">
                {customer.name}
              </p>
              <CustomerTypeBadge notes={customer.notes} />
            </div>
            <Dropdown
              align="right"
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center -mr-1 -mt-1 rounded-radius-sm text-text-tertiary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
                  aria-label={t('crm:customerCard.optionsAriaLabel')}
                >
                  <MoreVerticalIcon className="h-4 w-4" />
                </button>
              )}
            >
              {({ close }) => (
                <div
                  className="min-w-[180px] p-1 rounded-radius-md border border-border-subtle bg-white shadow-md"
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
          </div>

          {/* Row 2: icon building-2 14px text-tertiary + Công ty 13/400 text-secondary; icon mail 14px + Email 13/400 text-secondary */}
          <div className="mt-2 space-y-1">
            {customer.company && (
              <p className="flex items-center gap-1.5 text-[13px] leading-5 text-text-secondary truncate">
                <BuildingIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary stroke-1.5" />
                <span className="truncate">{customer.company}</span>
              </p>
            )}
            {customer.email && (
              <p className="flex items-center gap-1.5 text-[13px] leading-5 text-text-secondary truncate">
                <MailIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary stroke-1.5" />
                <span className="truncate font-mono text-[12px]">{customer.email}</span>
              </p>
            )}
          </div>
        </div>

        {/* Row 3 (divider trên): Trái: Tương tác: {date} mono 12/400 text-tertiary. Phải: {value} ₫ mono 15/500 text-accent #0E5E5E. Nếu 0 → text-tertiary w400. */}
        <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
          <span className="text-[12px] font-mono text-text-tertiary tabular-nums">
            {t('crm:customerCard.lastInteractionLabel', 'Tương tác:')} {lastInteraction}
          </span>
          <span
            className={`font-mono tabular-nums ${
              dealValue === 0
                ? 'text-[13px] font-normal text-text-tertiary'
                : 'text-[15px] font-medium text-accent'
            }`}
          >
            {formatDealValue(dealValue)}
          </span>
        </div>
      </div>

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

