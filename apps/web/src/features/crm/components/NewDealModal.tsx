import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('crm:newDealModal.titleRequiredError'));
      return;
    }
    createDeal.mutate(
      {
        title: title.trim(),
        value: value ? Number(value) : undefined,
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
          <Input id="deal-value" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
        </FormField>
        <FormField label={t('crm:newDealModal.fieldExpectedCloseDate')} htmlFor="deal-expected-close-date">
          <Input
            id="deal-expected-close-date"
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
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
