import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useCreateCustomer } from '../hooks';

export const NewCustomerModal = React.memo(function NewCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      title={t('crm:newCustomerModal.title', 'Thêm khách hàng mới')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={createCustomer.isPending} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
            {t('crm:newCustomerModal.cancel', 'Hủy')}
          </Button>
          <Button type="submit" form="new-customer-form" isLoading={createCustomer.isPending} className="h-9 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium">
            {t('crm:newCustomerModal.submit', 'Thêm khách hàng')}
          </Button>
        </div>
      }
    >
      <form id="new-customer-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('crm:newCustomerModal.fieldName', 'Tên khách hàng')} htmlFor="customer-name" error={error} required>
          <Input
            id="customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('crm:newCustomerModal.namePlaceholder', 'Ví dụ: Công ty TNHH ABC')}
          />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldCompany', 'Công ty')} htmlFor="customer-company">
          <Input id="customer-company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldEmail', 'Email')} htmlFor="customer-email">
          <Input id="customer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldPhone', 'Số điện thoại')} htmlFor="customer-phone">
          <Input id="customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>

        {/* Phần Ghi chú: Mục chọn loại khách hàng & Khác (tự điền) */}
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <FormField label={t('crm:newCustomerModal.fieldNotes', 'Ghi chú & Loại khách hàng')} htmlFor="customer-type">
            <CustomFilterSelect
              value={customerType}
              onChange={setCustomerType}
              position="top"
              options={[
                { value: '', label: t('crm:newCustomerModal.customerTypePlaceholder', '-- Chọn phân loại khách hàng --') },
                { value: 'lead', label: t('crm:newCustomerModal.customerTypes.lead', 'Khách hàng tiềm năng') },
                { value: 'vip', label: t('crm:newCustomerModal.customerTypes.vip', 'Khách hàng VIP') },
                { value: 'loyal', label: t('crm:newCustomerModal.customerTypes.loyal', 'Khách hàng thân thiết') },
                { value: 'sme', label: t('crm:newCustomerModal.customerTypes.sme', 'Doanh nghiệp SME') },
                { value: 'enterprise', label: t('crm:newCustomerModal.customerTypes.enterprise', 'Tập đoàn / Doanh nghiệp lớn') },
                { value: 'individual', label: t('crm:newCustomerModal.customerTypes.individual', 'Khách hàng cá nhân') },
                { value: 'other', label: t('crm:newCustomerModal.customerTypeOther', 'Khác (Tự điền ghi chú)') },
              ]}
            />
          </FormField>

          {customerType === 'other' && (
            <FormField label={t('crm:newCustomerModal.customNotesLabel', 'Chi tiết ghi chú (tự điền)')} htmlFor="customer-custom-notes">
              <Textarea
                id="customer-custom-notes"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder={t('crm:newCustomerModal.notesPlaceholder', 'Nhập ghi chú hoặc thông tin cụ thể về khách hàng…')}
                className="animate-fade-in"
              />
            </FormField>
          )}
        </div>
      </form>
    </Modal>
  );
});

