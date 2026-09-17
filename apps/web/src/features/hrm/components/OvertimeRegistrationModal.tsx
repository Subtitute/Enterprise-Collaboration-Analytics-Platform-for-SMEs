import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Input';
import { TimePicker } from '@/components/ui/TimePicker';
import { toast } from '@/stores/toast.store';
import { formatDate } from '@/lib/utils';
import type { LeaveRequest } from '@/types';
import type { OvertimeRegistration } from '../attendance-extensions.types';
import { getStoredOvertime, saveStoredOvertime } from '../attendance-extensions.types';

interface OvertimeRegistrationModalProps {
  userId: string;
  userName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leaveRequests?: LeaveRequest[];
}

export function OvertimeRegistrationModal({
  userId,
  userName,
  open,
  onClose,
  onSuccess,
  leaveRequests = [],
}: OvertimeRegistrationModalProps) {
  const { t } = useTranslation();

  const todayStr = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
    [],
  );

  const [workDate, setWorkDate] = useState(todayStr);
  const [otStart, setOtStart] = useState('18:00');
  const [otEnd, setOtEnd] = useState('20:00');
  const [multiplierType, setMultiplierType] = useState<'WEEKDAY' | 'WEEKEND' | 'HOLIDAY'>('WEEKDAY');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Tính số giờ OT dự kiến
  const estimatedHours = useMemo(() => {
    const [sH, sM] = otStart.split(':').map(Number);
    const [eH, eM] = otEnd.split(':').map(Number);
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
    const diff = (eH * 60 + eM) - (sH * 60 + sM);
    return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
  }, [otStart, otEnd]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Kiểm tra lý do
    if (!reason.trim()) {
      setError(t('hrm:extensions.overtime.errors.missingReason'));
      return;
    }

    // 2. Giờ kết thúc phải sau giờ bắt đầu
    if (estimatedHours <= 0) {
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

    // 5. Kiểm tra trần tối đa 40 giờ OT / tháng
    const monthPrefix = workDate.slice(0, 7);
    const allOtList = getStoredOvertime();
    const userMonthOtHours = allOtList
      .filter((ot) => ot.userId === userId && ot.workDate.startsWith(monthPrefix) && ot.status !== 'REJECTED')
      .reduce((sum, item) => sum + item.estimatedHours, 0);

    if (userMonthOtHours + estimatedHours > 40) {
      setError(t('hrm:extensions.overtime.errors.monthlyCapExceeded'));
      return;
    }

    const multiplier = multiplierType === 'HOLIDAY' ? 3.0 : multiplierType === 'WEEKEND' ? 2.0 : 1.5;

    const newOvertime: OvertimeRegistration = {
      id: `ot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      userName,
      workDate,
      otStart,
      otEnd,
      multiplier,
      multiplierType,
      reason: reason.trim(),
      estimatedHours,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    saveStoredOvertime([newOvertime, ...allOtList]);
    toast.success(t('hrm:extensions.overtime.successSubmit'));
    onSuccess();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('hrm:extensions.overtime.modalTitle')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label={t('hrm:extensions.overtime.dateLabel')} htmlFor="ot-date" required>
          <Input
            id="ot-date"
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="text-xs"
            required
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('hrm:extensions.overtime.startLabel')} htmlFor="ot-start" required>
            <TimePicker
              id="ot-start"
              value={otStart}
              onChange={setOtStart}
              position="bottom"
              required
            />
          </FormField>

          <FormField label={t('hrm:extensions.overtime.endLabel')} htmlFor="ot-end" required>
            <TimePicker
              id="ot-end"
              value={otEnd}
              onChange={setOtEnd}
              position="bottom"
              align="right"
              required
            />
          </FormField>
        </div>

        <FormField label={t('hrm:extensions.overtime.multiplierLabel')} htmlFor="ot-multiplier" required>
          <Select
            id="ot-multiplier"
            value={multiplierType}
            onChange={(e) => setMultiplierType(e.target.value as 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY')}
            className="text-xs"
          >
            <option value="WEEKDAY">{t('hrm:extensions.overtime.multipliers.weekday')}</option>
            <option value="WEEKEND">{t('hrm:extensions.overtime.multipliers.weekend')}</option>
            <option value="HOLIDAY">{t('hrm:extensions.overtime.multipliers.holiday')}</option>
          </Select>
        </FormField>

        <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs font-semibold text-indigo-800">
          {t('hrm:extensions.overtime.estimatedHours', { hours: estimatedHours })}
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
            className="text-xs"
            rows={2}
            required
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('hrm:extensions.overtime.cancelButton')}
          </Button>
          <Button type="submit" size="sm">
            {t('hrm:extensions.overtime.submitButton')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

