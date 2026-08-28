import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { useCreateLeaveRequest } from '../hooks';

export function NewLeaveRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
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
      setError(t('hrm:newLeaveRequestModal.errors.missingDates'));
      return;
    }
    if (!reason.trim()) {
      setError(t('hrm:newLeaveRequestModal.errors.missingReason'));
      return;
    }
    createLeaveRequest.mutate(
      { startDate, endDate, reason: reason.trim() },
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
      preventCloseWhilePending={createLeaveRequest.isPending}
      title={t('hrm:newLeaveRequestModal.title')}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('hrm:newLeaveRequestModal.startDateLabel')} htmlFor="leave-start-date" required>
            <Input id="leave-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </FormField>
          <FormField label={t('hrm:newLeaveRequestModal.endDateLabel')} htmlFor="leave-end-date" required>
            <Input id="leave-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </FormField>
        </div>
        <FormField label={t('hrm:newLeaveRequestModal.reasonLabel')} htmlFor="leave-reason" error={error} required>
          <Textarea
            id="leave-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('hrm:newLeaveRequestModal.reasonPlaceholder')}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          {/* 26/08/2026: them disabled={createLeaveRequest.isPending} - nut Huy nay truoc do goi
              thang handleClose khong dieu kien, la 1 duong dong khong bi chan boi
              preventCloseWhilePending (prop do chi chan X/Escape/backdrop trong Modal.tsx, khong
              bao trum nut tu viet trong modal con) - mirror dung disabled da co san o
              DepartmentModal.tsx/UploadModal.tsx. */}
          <Button type="button" variant="outline" onClick={handleClose} disabled={createLeaveRequest.isPending}>
            {t('hrm:newLeaveRequestModal.cancelButton')}
          </Button>
          <Button type="submit" isLoading={createLeaveRequest.isPending}>
            {t('hrm:newLeaveRequestModal.submitButton')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
