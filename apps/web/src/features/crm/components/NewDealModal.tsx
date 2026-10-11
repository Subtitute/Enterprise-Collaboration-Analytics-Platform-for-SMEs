import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { useCreateDeal } from '../hooks';

export const NewDealModal = React.memo(function NewDealModal({ customerId, open, onClose }: { customerId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [error, setError] = useState('');
  const createDeal = useCreateDeal(customerId);

  function reset() {
    setTitle('');
    setValue('');
    setExpectedCloseDate('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleValueChange(inputVal: string) {
    // Chỉ giữ lại các chữ số
    const rawNumber = inputVal.replace(/\D/g, '');
    if (!rawNumber) {
      setValue('');
      return;
    }
    // Định dạng phân tách hàng nghìn bằng dấu chấm (VD: 1.000.000)
    const formatted = new Intl.NumberFormat('vi-VN').format(Number(rawNumber));
    setValue(formatted);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('crm:newDealModal.titleRequiredError'));
      return;
    }
    const cleanNumber = value ? Number(value.replace(/\./g, '')) : undefined;
    createDeal.mutate(
      {
        title: title.trim(),
        value: cleanNumber,
        expectedCloseDate: expectedCloseDate || undefined,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={createDeal.isPending}
      title={t('crm:newDealModal.title')}
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border-strong text-text-secondary hover:bg-canvas hover:text-text-primary rounded-radius-sm h-9"
            onClick={handleClose}
            disabled={createDeal.isPending}
          >
            {t('crm:newDealModal.cancel')}
          </Button>
          <Button
            type="submit"
            form="new-deal-form"
            className="bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-9"
            isLoading={createDeal.isPending}
          >
            {t('crm:newDealModal.submit')}
          </Button>
        </div>
      }
    >
      <form id="new-deal-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('crm:newDealModal.fieldTitle')} htmlFor="deal-title" error={error} required>
          <Input
            id="deal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('crm:newDealModal.titlePlaceholder')}
            className="rounded-radius-sm border-border-strong focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
        </FormField>
        <FormField label={t('crm:newDealModal.fieldValue')} htmlFor="deal-value">
          <div className="relative">
            <Input
              id="deal-value"
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
        <FormField label={t('crm:newDealModal.fieldExpectedCloseDate')} htmlFor="deal-expected-close-date">
          <DatePicker
            id="deal-expected-close-date"
            value={expectedCloseDate}
            onChange={setExpectedCloseDate}
            position="top"
            placeholder="DD/MM/YYYY"
          />
        </FormField>
      </form>
    </Modal>
  );
});

