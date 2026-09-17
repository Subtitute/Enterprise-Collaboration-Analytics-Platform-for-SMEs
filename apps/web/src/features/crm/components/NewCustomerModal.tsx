import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Input';
import { useCreateCustomer } from '../hooks';

export function NewCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [error, setError] = useState('');
  const createCustomer = useCreateCustomer();

  function reset() {
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setCustomerType('');
    setCustomNotes('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('crm:newCustomerModal.nameRequiredError'));
      return;
    }

    // Xác định nội dung ghi chú: loại được chọn hoặc nội dung tự điền
    let finalNotes: string | undefined = undefined;
    if (customerType === 'other') {
      finalNotes = customNotes.trim() || undefined;
    } else if (customerType) {
      finalNotes = t(`crm:newCustomerModal.customerTypes.${customerType}`);
    }

    createCustomer.mutate(
      {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        notes: finalNotes,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={createCustomer.isPending}
      title={t('crm:newCustomerModal.title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('crm:newCustomerModal.fieldName')} htmlFor="customer-name" error={error} required>
          <Input
            id="customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('crm:newCustomerModal.namePlaceholder')}
          />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldCompany')} htmlFor="customer-company">
          <Input id="customer-company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldEmail')} htmlFor="customer-email">
          <Input id="customer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldPhone')} htmlFor="customer-phone">
          <Input id="customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>

        {/* Phần Ghi chú: Mục chọn loại khách hàng & Khác (tự điền) */}
        <div className="space-y-3 pt-1 border-t border-slate-100">
          <FormField label={t('crm:newCustomerModal.fieldNotes')} htmlFor="customer-type">
            <Select
              id="customer-type"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
            >
              <option value="">{t('crm:newCustomerModal.customerTypePlaceholder')}</option>
              <option value="lead">{t('crm:newCustomerModal.customerTypes.lead')}</option>
              <option value="vip">{t('crm:newCustomerModal.customerTypes.vip')}</option>
              <option value="loyal">{t('crm:newCustomerModal.customerTypes.loyal')}</option>
              <option value="sme">{t('crm:newCustomerModal.customerTypes.sme')}</option>
              <option value="enterprise">{t('crm:newCustomerModal.customerTypes.enterprise')}</option>
              <option value="individual">{t('crm:newCustomerModal.customerTypes.individual')}</option>
              <option value="other">{t('crm:newCustomerModal.customerTypeOther')}</option>
            </Select>
          </FormField>

          {customerType === 'other' && (
            <FormField label={t('crm:newCustomerModal.customNotesLabel')} htmlFor="customer-custom-notes">
              <Textarea
                id="customer-custom-notes"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder={t('crm:newCustomerModal.notesPlaceholder')}
                className="animate-fade-in"
              />
            </FormField>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          {/* 26/08/2026: them disabled={createCustomer.isPending} - nut Huy nay truoc do goi thang
              handleClose khong dieu kien, la 1 duong dong khong bi chan boi preventCloseWhilePending
              (prop do chi chan X/Escape/backdrop trong Modal.tsx, khong bao trum nut tu viet trong
              modal con) - mirror dung disabled đã co san o DepartmentModal.tsx/UploadModal.tsx. */}
          <Button type="button" variant="outline" onClick={handleClose} disabled={createCustomer.isPending}>
            {t('crm:newCustomerModal.cancel')}
          </Button>
          <Button type="submit" isLoading={createCustomer.isPending}>
            {t('crm:newCustomerModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
