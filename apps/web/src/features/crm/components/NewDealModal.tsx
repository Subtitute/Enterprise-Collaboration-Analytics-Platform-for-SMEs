import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { useCreateDeal } from '../hooks';

export function NewDealModal({ customerId, open, onClose }: { customerId: string; open: boolean; onClose: () => void }) {
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
      setError('Vui lòng nhập tiêu đề deal');
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
    <Modal open={open} onClose={handleClose} title="Tạo deal mới">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Tiêu đề" htmlFor="deal-title" error={error} required>
          <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Gói triển khai năm 2026" />
        </FormField>
        <FormField label="Giá trị (VND)" htmlFor="deal-value">
          <Input id="deal-value" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
        </FormField>
        <FormField label="Ngày dự kiến chốt" htmlFor="deal-expected-close-date">
          <Input
            id="deal-expected-close-date"
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={createDeal.isPending}>
            Tạo deal
          </Button>
        </div>
      </form>
    </Modal>
  );
}
