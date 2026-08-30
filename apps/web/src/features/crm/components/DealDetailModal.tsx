import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FormField, Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { TrashIcon } from '@/components/ui/Icons';
import type { Deal } from '@/types';
import { dealStageBadgeVariant } from '../utils';
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

  return (
    <>
      <Modal open={Boolean(deal)} onClose={onClose} title={t('crm:dealDetailModal.title')}>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="flex items-center justify-between">
            <Badge variant={dealStageBadgeVariant(deal.stage)}>{t(`crm:enums.dealStage.${deal.stage}`)}</Badge>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"
              aria-label={t('crm:dealDetailModal.deleteAriaLabel')}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
          <FormField label={t('crm:dealDetailModal.fieldTitle')} htmlFor="deal-detail-title">
            <Input id="deal-detail-title" value={title} onChange={(e) => setTitle(e.target.value)} />
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
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
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
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('crm:dealDetailModal.close')}
            </Button>
            <Button type="submit" isLoading={updateDeal.isPending}>
              {t('crm:dealDetailModal.save')}
            </Button>
          </div>
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
