import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateCustomer } from '../hooks';

export function NewCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const createCustomer = useCreateCustomer();

  function reset() {
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setNotes('');
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
    createCustomer.mutate(
      {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('crm:newCustomerModal.title')}>
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
        <FormField label={t('crm:newCustomerModal.fieldNotes')} htmlFor="customer-notes">
          <Textarea
            id="customer-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('crm:newCustomerModal.notesPlaceholder')}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
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
