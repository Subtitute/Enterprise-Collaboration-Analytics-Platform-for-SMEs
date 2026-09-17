import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Input';
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
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('crm:newCustomerModal.fieldName')} htmlFor="edit-customer-name" error={error} required>
          <Input
            id="edit-customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('crm:newCustomerModal.namePlaceholder')}
          />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldCompany')} htmlFor="edit-customer-company">
          <Input id="edit-customer-company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldEmail')} htmlFor="edit-customer-email">
          <Input id="edit-customer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label={t('crm:newCustomerModal.fieldPhone')} htmlFor="edit-customer-phone">
          <Input id="edit-customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>

        {/* Phần Ghi chú: Mục chọn loại khách hàng & Khác (tự điền) */}
        <div className="space-y-3 pt-1 border-t border-slate-100">
          <FormField label={t('crm:newCustomerModal.fieldNotes')} htmlFor="edit-customer-type">
            <Select
              id="edit-customer-type"
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
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={updateCustomer.isPending}>
            {t('crm:newCustomerModal.cancel')}
          </Button>
          <Button type="submit" isLoading={updateCustomer.isPending}>
            {t('crm:editCustomerModal.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
