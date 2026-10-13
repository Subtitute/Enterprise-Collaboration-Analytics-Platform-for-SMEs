import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { InfoIcon } from '@/components/ui/Icons';
import type { LeaveRequest, OvertimeMultiplierType } from '@/types';
import { useCreateOvertimeRequest } from '../hooks';

interface OvertimeRegistrationModalProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  leaveRequests?: LeaveRequest[];
}

export function OvertimeRegistrationModal({ userId, open, onClose, leaveRequests = [] }: OvertimeRegistrationModalProps) {
  const { t } = useTranslation();
  const createOvertime = useCreateOvertimeRequest();

  const todayStr = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
    [],
  );

  const [workDate, setWorkDate] = useState(todayStr);
  const [otStart, setOtStart] = useState('18:00');
  const [otEnd, setOtEnd] = useState('20:00');
  const [multiplierType, setMultiplierType] = useState<OvertimeMultiplierType>('WEEKDAY');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Tính số giờ và phút OT dự kiến
  const { totalHours, durationText } = useMemo(() => {
    const [sH, sM] = otStart.split(':').map(Number);
    const [eH, eM] = otEnd.split(':').map(Number);
    const defaultZero = t('hrm:extensions.overtime.durationHoursOnly', { hours: 0, defaultValue: '0 giờ' });
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) {
      return { totalHours: 0, durationText: defaultZero };
    }
    const diffMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (diffMins <= 0) {
      return { totalHours: 0, durationText: defaultZero };
    }

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const decimalHours = Math.round((diffMins / 60) * 10) / 10;

    let text = '';
    if (hours > 0 && mins > 0) {
      text = t('hrm:extensions.overtime.durationHoursMinutes', {
        hours,
        minutes: mins,
        defaultValue: `${hours} giờ ${mins} phút`,
      });
    } else if (hours > 0) {
      text = t('hrm:extensions.overtime.durationHoursOnly', {
        hours,
        defaultValue: `${hours} giờ`,
      });
    } else {
      text = t('hrm:extensions.overtime.durationMinutesOnly', {
        minutes: mins,
        defaultValue: `${mins} phút`,
      });
    }

    return { totalHours: decimalHours, durationText: text };
  }, [otStart, otEnd, t]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    // 1. Kiểm tra lý do
    if (!reason.trim()) {
      setError(t('hrm:extensions.overtime.errors.missingReason'));
      return;
    }

    // 2. Giờ kết thúc phải sau giờ bắt đầu
    if (totalHours <= 0) {
      setError(t('hrm:extensions.overtime.errors.invalidRange'));
      return;
    }

    // 3. Chặn trùng với giờ hành chính chính thức (08:30 - 17:30) vào các ngày trong tuần
    const selectedD = new Date(workDate);
    const isWeekend = selectedD.getDay() === 0 || selectedD.getDay() === 6;
    const [sH, sM] = otStart.split(':').map(Number);
    const [eH, eM] = otEnd.split(':').map(Number);
    const startMins = sH * 60 + sM;
    const endMins = eH * 60 + eM;
    const officeStartMins = 8 * 60 + 30; // 08:30
    const officeEndMins = 17 * 60 + 30; // 17:30

    if (!isWeekend && multiplierType === 'WEEKDAY') {
      const isOverlapping =
        (startMins >= officeStartMins && startMins < officeEndMins) ||
        (endMins > officeStartMins && endMins <= officeEndMins) ||
        (startMins <= officeStartMins && endMins >= officeEndMins);

      if (isOverlapping) {
        setError(t('hrm:extensions.overtime.errors.overlapOfficeHours'));
        return;
      }
    }

    // 4. Kiểm tra có lịch nghỉ phép đã được duyệt trong ngày này không
    const hasLeave = leaveRequests.some((lr) => {
      if (lr.userId !== userId || lr.status === 'REJECTED') return false;
      return workDate >= lr.startDate && workDate <= lr.endDate;
    });

    if (hasLeave) {
      setError(t('hrm:extensions.overtime.errors.hasLeaveOnDate'));
      return;
    }

    // 5. Tran toi da 40h OT/thang
    createOvertime.mutate(
      { workDate, otStart, otEnd, multiplierType, reason: reason.trim() },
      { onSuccess: onClose },
    );
  };

  const multiplierOptions = [
    { value: 'WEEKDAY', label: t('hrm:extensions.overtime.multipliers.weekday') },
    { value: 'WEEKEND', label: t('hrm:extensions.overtime.multipliers.weekend') },
    { value: 'HOLIDAY', label: t('hrm:extensions.overtime.multipliers.holiday') },
  ];

  const otPresets = [
    { label: '17:30', value: '17:30' },
    { label: '18:00', value: '18:00' },
    { label: '19:00', value: '19:00' },
    { label: '20:00', value: '20:00' },
    { label: '21:00', value: '21:00' },
    { label: '22:00', value: '22:00' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('hrm:extensions.overtime.modalTitle')}
      size="sm"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('hrm:extensions.overtime.cancelButton')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => handleSubmit()}
            disabled={createOvertime.isPending}
            isLoading={createOvertime.isPending}
          >
            {t('hrm:extensions.overtime.submitButton')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('hrm:extensions.overtime.dateLabel')} htmlFor="ot-date" required>
          <DatePicker
            id="ot-date"
            value={workDate}
            onChange={setWorkDate}
            position="bottom"
            className="w-full"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('hrm:extensions.overtime.startLabel')} htmlFor="ot-start" required>
            <TimePicker
              id="ot-start"
              value={otStart}
              onChange={setOtStart}
              presets={otPresets}
              position="bottom"
              required
            />
          </FormField>

          <FormField label={t('hrm:extensions.overtime.endLabel')} htmlFor="ot-end" required>
            <TimePicker
              id="ot-end"
              value={otEnd}
              onChange={setOtEnd}
              presets={otPresets}
              position="bottom"
              align="right"
              required
            />
          </FormField>
        </div>

        <FormField label={t('hrm:extensions.overtime.multiplierLabel')} htmlFor="ot-multiplier" required>
          <CustomFilterSelect
            value={multiplierType}
            options={multiplierOptions}
            onChange={(val) => setMultiplierType(val as OvertimeMultiplierType)}
            position="bottom"
            className="w-full"
          />
        </FormField>

        <div className="flex items-center gap-2 p-2.5 rounded-radius-sm bg-accent-soft text-accent text-xs font-medium">
          <InfoIcon className="h-4 w-4 shrink-0" />
          <span>
            {t('hrm:extensions.overtime.estimatedDuration', { defaultValue: 'Thời lượng OT dự kiến: {{duration}}' , duration: durationText })}
          </span>
        </div>

        <FormField
          label={t('hrm:extensions.overtime.reasonLabel')}
          htmlFor="ot-reason"
          error={error || undefined}
          required
        >
          <Textarea
            id="ot-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('hrm:extensions.overtime.reasonPlaceholder')}
            className="text-xs min-h-[80px]"
            rows={3}
            required
          />
        </FormField>
      </form>
    </Modal>
  );
}

