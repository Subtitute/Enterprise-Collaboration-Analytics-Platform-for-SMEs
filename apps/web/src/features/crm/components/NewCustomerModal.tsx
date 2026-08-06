import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateCustomer } from '../hooks';

export function NewCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      setError('Vui lòng nhập tên khách hàng');
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
    <Modal open={open} onClose={handleClose} title="Thêm khách hàng mới">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Tên khách hàng" htmlFor="customer-name" error={error} required>
          <Input id="customer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Công ty TNHH ABC" />
        </FormField>
        <FormField label="Công ty" htmlFor="customer-company">
          <Input id="customer-company" value={company} onChange={(e) => setCompany(e.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="customer-email">
          <Input id="customer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Số điện thoại" htmlFor="customer-phone">
          <Input id="customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </FormField>
        <FormField label="Ghi chú" htmlFor="customer-notes">
          <Textarea id="customer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thông tin thêm về khách hàng…" />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={createCustomer.isPending}>
            Thêm khách hàng
          </Button>
        </div>
      </form>
    </Modal>
  );
}
