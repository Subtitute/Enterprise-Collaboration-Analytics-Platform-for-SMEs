import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { TrashIcon } from '@/components/ui/Icons';
import type { Deal } from '@/types';
import { useDeleteDeal, useUpdateDeal } from '../hooks';

/**
 * Modal xem/sua thong tin 1 deal (Wireframe.md muc 12) - mirror TaskDetailModal.tsx (features/
 * projects) ve cau truc chung, nhung KHONG co binh luan/lich su (ngoai pham vi CRM-lite dot nay).
 * Doi giai doan (stage) CHI thuc hien qua keo-tha tren Kanban (xem DealKanbanBoard.tsx), khong co
 * o modal nay - tranh 2 noi cung sua 1 gia tri theo 2 co che khac nhau (drag vs form).
 */
export function DealDetailModal({
  customerId,
  deal,
  onClose,
}: {
  customerId: string;
  deal: Deal | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateDeal = useUpdateDeal(customerId, deal?.id ?? '');
  const deleteDeal = useDeleteDeal(customerId);

  useEffect(() => {
    if (!deal) return;
    setTitle(deal.title);
    if (deal.value !== undefined && deal.value !== null) {
      setValue(new Intl.NumberFormat('vi-VN').format(Number(deal.value)));
    } else {
      setValue('');
    }
    setExpectedCloseDate(deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : '');
  }, [deal]);

  if (!deal) return null;

  function handleValueChange(inputVal: string) {
    const rawNumber = inputVal.replace(/\D/g, '');
    if (!rawNumber) {
      setValue('');
      return;
    }
    const formatted = new Intl.NumberFormat('vi-VN').format(Number(rawNumber));
    setValue(formatted);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const cleanNumber = value ? Number(value.replace(/\./g, '')) : undefined;
    updateDeal.mutate({
      title: title.trim(),
      value: cleanNumber,
      expectedCloseDate: expectedCloseDate || undefined,
    });
  }

  const STAGE_CONFIG: Record<
    Deal['stage'],
    { bg: string; text: string; dot: string }
  > = {
    NEW: { bg: 'bg-bg-subtle', text: 'text-text-tertiary', dot: 'bg-text-tertiary' },
    CONTACTED: { bg: 'bg-info-soft', text: 'text-info', dot: 'bg-info' },
    PROPOSAL: { bg: 'bg-accent-soft', text: 'text-accent', dot: 'bg-accent' },
    NEGOTIATION: { bg: 'bg-warning-soft', text: 'text-warning', dot: 'bg-warning' },
    WON: { bg: 'bg-success-soft', text: 'text-success', dot: 'bg-success' },
    LOST: { bg: 'bg-error-soft', text: 'text-error', dot: 'bg-error' },
  };

  const currentStage = STAGE_CONFIG[deal.stage] || STAGE_CONFIG.NEW;

  return (
    <>
      <Modal
        open={Boolean(deal)}
        onClose={onClose}
        title={t('crm:dealDetailModal.title')}
        preventCloseWhilePending={updateDeal.isPending || deleteDeal.isPending}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-border-strong text-text-secondary hover:bg-canvas hover:text-text-primary rounded-radius-sm h-9"
              onClick={onClose}
              disabled={updateDeal.isPending}
            >
              {t('crm:dealDetailModal.close')}
            </Button>
            <Button
              type="submit"
              form="deal-detail-form"
              className="bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-9"
              isLoading={updateDeal.isPending}
            >
              {t('crm:dealDetailModal.save')}
            </Button>
          </div>
        }
      >
        <form id="deal-detail-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[2px] text-[11px] font-semibold ${currentStage.bg} ${currentStage.text}`}
            >
              <span className={`h-1 w-1 rounded-full ${currentStage.dot}`} />
              {t(`crm:enums.dealStage.${deal.stage}`)}
            </span>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex h-8 w-8 items-center justify-center rounded-radius-sm text-error hover:bg-error-soft transition-colors cursor-pointer"
              aria-label={t('crm:dealDetailModal.deleteAriaLabel')}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          <FormField label={t('crm:dealDetailModal.fieldTitle')} htmlFor="deal-detail-title">
            <Input
              id="deal-detail-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-radius-sm border-border-strong focus:border-border-strong focus:ring-1 focus:ring-border-strong"
            />
          </FormField>
          <FormField label={t('crm:dealDetailModal.fieldValue')} htmlFor="deal-detail-value">
            <div className="relative">
              <Input
                id="deal-detail-value"
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="0"
                className="text-right pr-12 font-mono text-[14px] leading-5 font-medium tabular-nums text-text-primary rounded-radius-sm border-border-strong focus:border-border-strong focus:ring-1 focus:ring-border-strong"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] font-medium text-text-tertiary">
                VND
              </span>
            </div>
          </FormField>
          <FormField label={t('crm:dealDetailModal.fieldExpectedCloseDate')} htmlFor="deal-detail-expected-close-date">
            <DatePicker
              id="deal-detail-expected-close-date"
              value={expectedCloseDate}
              onChange={setExpectedCloseDate}
              position="top"
              placeholder="DD/MM/YYYY"
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteDeal.mutate(deal.id);
          setConfirmDelete(false);
          onClose();
        }}
        title={t('crm:dealDetailModal.deleteConfirmTitle')}
        description={t('crm:dealDetailModal.deleteConfirmDescription', { title: deal.title })}
        confirmLabel={t('crm:dealDetailModal.deleteConfirmButton')}
        danger
      />
    </>
  );
}
