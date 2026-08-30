import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { useCreateDeal } from '../hooks';

export function NewDealModal({ customerId, open, onClose }: { customerId: string; open: boolean; onClose: () => void }) {
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
      // 26/08/2026: modal nay cung o lai trong DOM (cha bat/tat qua prop `open`), mutate() ben tren
      // goi onSuccess: handleClose (dong+reset form) - giong dung loi da sua hom qua o 4 modal khac
      // (vd DepartmentModal.tsx): neu dong+mo lai modal trong luc mutation cu con dang bay,
      // onSuccess cu se dong nham phien ban modal moi. Chan bang prop dung chung cua Modal.tsx.
      preventCloseWhilePending={createDeal.isPending}
      title={t('crm:newDealModal.title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('crm:newDealModal.fieldTitle')} htmlFor="deal-title" error={error} required>
          <Input
            id="deal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('crm:newDealModal.titlePlaceholder')}
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
              className="pr-10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
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
        <div className="flex justify-end gap-2 pt-1">
          {/* 26/08/2026: them disabled={createDeal.isPending} - nut Huy nay truoc do goi thang
              handleClose khong dieu kien, la 1 duong dong khong bi chan boi preventCloseWhilePending
              (prop do chi chan X/Escape/backdrop trong Modal.tsx, khong bao trum nut tu viet trong
              modal con) - mirror dung disabled đã co san o DepartmentModal.tsx/UploadModal.tsx. */}
          <Button type="button" variant="outline" onClick={handleClose} disabled={createDeal.isPending}>
            {t('crm:newDealModal.cancel')}
          </Button>
          <Button type="submit" isLoading={createDeal.isPending}>
            {t('crm:newDealModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
