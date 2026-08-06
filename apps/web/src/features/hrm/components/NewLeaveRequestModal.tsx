import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateLeaveRequest } from '../hooks';

export function NewLeaveRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const createLeaveRequest = useCreateLeaveRequest();

  function reset() {
    setStartDate('');
    setEndDate('');
    setReason('');
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError('Vui lòng chọn ngày bắt đầu và kết thúc');
      return;
    }
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do nghỉ phép');
      return;
    }
    createLeaveRequest.mutate(
      { startDate, endDate, reason: reason.trim() },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Tạo yêu cầu nghỉ phép">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Ngày bắt đầu" htmlFor="leave-start-date" required>
            <Input id="leave-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label="Ngày kết thúc" htmlFor="leave-end-date" required>
            <Input id="leave-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
        </div>
        <FormField label="Lý do" htmlFor="leave-reason" error={error} required>
          <Textarea id="leave-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do xin nghỉ phép…" />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={createLeaveRequest.isPending}>
            Gửi yêu cầu
          </Button>
        </div>
      </form>
    </Modal>
  );
}
