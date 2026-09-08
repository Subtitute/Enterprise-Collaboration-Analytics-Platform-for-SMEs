import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useUpdateCustomer } from '../hooks';
import type { Customer } from '@/types';

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
  const [notes, setNotes] = useState(customer.notes || '');
  const [error, setError] = useState('');
  const updateCustomer = useUpdateCustomer(customer.id);

  useEffect(() => {
    if (open) {
      setName(customer.name || '');
      setEmail(customer.email || '');
      setPhone(customer.phone || '');
      setCompany(customer.company || '');
      setNotes(customer.notes || '');
      setError('');
    }
  }, [customer, open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('crm:newCustomerModal.nameRequiredError'));
      return;
    }
    updateCustomer.mutate(
      {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        notes: notes.trim() || undefined,
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
        <FormField label={t('crm:newCustomerModal.fieldNotes')} htmlFor="edit-customer-notes">
          <Textarea
            id="edit-customer-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('crm:newCustomerModal.notesPlaceholder')}
          />
        </FormField>
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
