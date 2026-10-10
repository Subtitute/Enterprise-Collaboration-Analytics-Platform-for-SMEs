import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { useUpdateCustomer } from '../hooks';
import type { Customer } from '@/types';

const KNOWN_TYPE_KEYS = ['lead', 'vip', 'loyal', 'sme', 'enterprise', 'individual'] as const;

export function EditCustomerModal({
  customer,
  open,
  onClose,
}: {
  customer: Customer;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(customer.name || '');
  const [email, setEmail] = useState(customer.email || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [company, setCompany] = useState(customer.company || '');
  const [customerType, setCustomerType] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [error, setError] = useState('');
  const updateCustomer = useUpdateCustomer(customer.id);

  useEffect(() => {
    if (open) {
      setName(customer.name || '');
      setEmail(customer.email || '');
      setPhone(customer.phone || '');
      setCompany(customer.company || '');
      setError('');

      const rawNotes = customer.notes?.trim() || '';
      if (!rawNotes) {
        setCustomerType('');
        setCustomNotes('');
      } else {
        // Kiểm tra xem notes có trùng với 1 trong các loại có sẵn không
        let matchedKey = '';
        for (const key of KNOWN_TYPE_KEYS) {
          const translated = t(`crm:newCustomerModal.customerTypes.${key}`);
          if (translated.toLowerCase() === rawNotes.toLowerCase()) {
            matchedKey = key;
            break;
          }
        }
        if (matchedKey) {
          setCustomerType(matchedKey);
          setCustomNotes('');
        } else {
          setCustomerType('other');
          setCustomNotes(rawNotes);
        }
      }
    }
  }, [customer, open, t]);

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

    updateCustomer.mutate(
      {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        notes: finalNotes,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventCloseWhilePending={updateCustomer.isPending}
      title={t('crm:editCustomerModal.title')}
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-border-strong text-text-secondary hover:bg-canvas hover:text-text-primary rounded-radius-sm h-9"
            onClick={onClose}
            disabled={updateCustomer.isPending}
          >
            {t('crm:newCustomerModal.cancel')}
          </Button>
          <Button
            type="submit"
            form="edit-customer-form"
            className="bg-primary hover:bg-primary-hover text-primary-contrast rounded-radius-sm h-9"
            isLoading={updateCustomer.isPending}
          >
            {t('crm:editCustomerModal.save', 'Lưu thay đổi')}
          </Button>
        </div>
      }
    >
      <form id="edit-customer-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('crm:newCustomerModal.fieldName')} htmlFor="edit-customer-name" error={error} required>
          <Input
            id="edit-customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('crm:newCustomerModal.namePlaceholder')}
            className="rounded-radius-sm border-border-strong focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldCompany')} htmlFor="edit-customer-company">
          <Input
            id="edit-customer-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-radius-sm border-border-strong focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldEmail')} htmlFor="edit-customer-email">
          <Input
            id="edit-customer-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-radius-sm border-border-strong focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldPhone')} htmlFor="edit-customer-phone">
          <Input
            id="edit-customer-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-radius-sm border-border-strong focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
        </FormField>

        {/* Phần Ghi chú: Mục chọn loại khách hàng & Khác (tự điền) */}
        <div className="space-y-3 pt-2 border-t border-border-subtle">
          <FormField label={t('crm:newCustomerModal.fieldNotes')} htmlFor="edit-customer-type">
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
            <FormField label={t('crm:newCustomerModal.customNotesLabel')} htmlFor="edit-customer-custom-notes">
              <Textarea
                id="edit-customer-custom-notes"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder={t('crm:newCustomerModal.notesPlaceholder')}
                className="animate-fade-in"
              />
            </FormField>
          )}
        </div>
      </form>
    </Modal>
  );
}
