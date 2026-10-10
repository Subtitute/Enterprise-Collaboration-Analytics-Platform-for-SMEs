import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { FormField, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { calculateWorkingDays, getTodayGmt7DateString } from '@/lib/utils';
import { useCreateLeaveRequest } from '../hooks';

export type LeaveTypeOption = 'ANNUAL' | 'SICK' | 'UNPAID';

export function NewLeaveRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [leaveType, setLeaveType] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const createLeaveRequest = useCreateLeaveRequest();

  const totalWorkingDays = calculateWorkingDays(startDate, endDate);
  const todayGmt7 = getTodayGmt7DateString();

  const typeOptions = [
    { value: '', label: t('hrm:newLeaveRequestModal.typePlaceholder') },
    { value: 'ANNUAL', label: t('hrm:newLeaveRequestModal.types.ANNUAL') },
    { value: 'SICK', label: t('hrm:newLeaveRequestModal.types.SICK') },
    { value: 'UNPAID', label: t('hrm:newLeaveRequestModal.types.UNPAID') },
  ];

  function reset() {
    setLeaveType('');
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
    if (startDate < todayGmt7) {
      setError(t('hrm:newLeaveRequestModal.errors.startDateInPast'));
      return;
    }
    if (endDate < startDate) {
      setError(t('hrm:newLeaveRequestModal.errors.endDateBeforeStart'));
      return;
    }
    if (!leaveType) {
      setError(t('hrm:newLeaveRequestModal.errors.missingType'));
      return;
    }
    if (!reason.trim()) {
      setError(t('hrm:newLeaveRequestModal.errors.missingReason'));
      return;
    }

    const typePrefix = `[${leaveType}]`;
    const fullReason = `${typePrefix} ${reason.trim()}`;

    createLeaveRequest.mutate(
      { startDate, endDate, reason: fullReason },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={createLeaveRequest.isPending}
      title={<span className="text-[16px] leading-[24px] font-semibold text-text-primary">{t('hrm:newLeaveRequestModal.title')}</span>}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={handleClose}
            disabled={createLeaveRequest.isPending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[13px] font-medium text-text-primary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            {t('hrm:newLeaveRequestModal.cancelButton')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createLeaveRequest.isPending}
            className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            {createLeaveRequest.isPending ? t('common:status.loading') : t('hrm:newLeaveRequestModal.submitButton')}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[min(640px,calc(100vh-80px))] overflow-y-auto" noValidate>
        {/* 1. Row 2 cột: Ngày bắt đầu * / Ngày kết thúc * DatePicker Module 07 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1" htmlFor="leave-start-date">
              {t('hrm:newLeaveRequestModal.startDateLabel')} <span className="text-[#B3261E]">*</span>
            </label>
            <DatePicker
              id="leave-start-date"
              value={startDate}
              minDate={todayGmt7}
              onChange={(val) => {
                setStartDate(val);
                if (error) setError('');
              }}
              position="bottom"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1" htmlFor="leave-end-date">
              {t('hrm:newLeaveRequestModal.endDateLabel')} <span className="text-[#B3261E]">*</span>
            </label>
            <DatePicker
              id="leave-end-date"
              value={endDate}
              minDate={startDate || todayGmt7}
              onChange={(val) => {
                setEndDate(val);
                if (error) setError('');
              }}
              position="bottom"
              align="right"
            />
          </div>
        </div>

        {totalWorkingDays > 0 && (
          <div className="flex items-center gap-1.5 text-[12px] font-normal text-text-secondary">
            <span>
              • {t('hrm:newLeaveRequestModal.totalDaysPrefix')}{' '}
              <strong className="font-mono font-medium text-text-primary tabular-nums">
                {t('hrm:newLeaveRequestModal.totalDaysValue', { count: totalWorkingDays })}
              </strong>{' '}
              {t('hrm:newLeaveRequestModal.totalDaysSuffix')}
            </span>
          </div>
        )}

        {/* 2. Loại nghỉ phép *: CustomFilterSelect phẳng */}
        <div className="space-y-1">
          <label className="block text-[12px] font-medium text-text-secondary">
            {t('hrm:newLeaveRequestModal.typeLabel')} <span className="text-[#B3261E]">*</span>
          </label>
          <CustomFilterSelect
            value={leaveType}
            options={typeOptions}
            onChange={(val) => {
              setLeaveType(val);
              if (error) setError('');
            }}
            position="bottom"
          />
        </div>

        {/* 3. Lý do *: textarea min-h 80 */}
        <FormField label={t('hrm:newLeaveRequestModal.reasonLabel')} htmlFor="leave-reason" error={error} required>
          <Textarea
            id="leave-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('hrm:newLeaveRequestModal.reasonPlaceholder')}
            className="min-h-[80px]"
          />
        </FormField>
      </form>
    </Modal>
  );
}
