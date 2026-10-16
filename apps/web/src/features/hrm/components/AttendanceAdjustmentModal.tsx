import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Textarea } from '@/components/ui/Input';
import { TimePicker } from '@/components/ui/TimePicker';
import { formatTime, formatDate } from '@/lib/utils';
import type { Attendance } from '@/types';
import { useCreateAttendanceAdjustment } from '../hooks';

interface AttendanceAdjustmentModalProps {
  record: Attendance | null;
  open: boolean;
  onClose: () => void;
}

export function AttendanceAdjustmentModal({ record, open, onClose }: AttendanceAdjustmentModalProps) {
  const { t } = useTranslation();
  const createAdjustment = useCreateAttendanceAdjustment();

  // Khởi tạo giờ check-in / check-out mặc định từ record hiện tại (nếu có)
  const defaultInTime = record?.checkInAt
    ? formatTime(record.checkInAt)
    : '08:30';
  const defaultOutTime = record?.checkOutAt
    ? formatTime(record.checkOutAt)
    : '17:30';

  const [inTime, setInTime] = useState(defaultInTime);
  const [outTime, setOutTime] = useState(defaultOutTime);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 16/10/2026: Tránh lỗi stale state khi mở modal nhiều lần hoặc đổi record khác ngày:
  // Tự động đồng bộ lại inTime, outTime theo record mới, reset reason và error.
  useEffect(() => {
    if (open && record) {
      setInTime(record.checkInAt ? formatTime(record.checkInAt) : '08:30');
      setOutTime(record.checkOutAt ? formatTime(record.checkOutAt) : '17:30');
      setReason('');
      setError(null);
    }
  }, [open, record]);

  if (!record) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Kiểm tra lý do
    if (!reason.trim()) {
      setError(t('hrm:extensions.adjustment.errors.missingReason'));
      return;
    }

    // 2. Kiểm tra giới hạn 7 ngày
    const workDate = new Date(record.workDate);
    const now = new Date();
    const diffDays = (now.getTime() - workDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      setError(t('hrm:extensions.adjustment.errors.tooOld'));
      return;
    }

    // 3. Kiểm tra giờ ra phải sau giờ vào
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    if (outH < inH || (outH === inH && outM <= inM)) {
      setError(t('hrm:extensions.adjustment.errors.invalidRange'));
      return;
    }

    // 4. Kiểm tra không vượt quá thời điểm hiện tại (nếu là hôm nay)
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
    if (record.workDate === todayStr) {
      const curParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      }).formatToParts(now);
      const curH = Number(curParts.find((p) => p.type === 'hour')?.value ?? 0);
      const curM = Number(curParts.find((p) => p.type === 'minute')?.value ?? 0);

      if (outH > curH || (outH === curH && outM > curM)) {
        setError(t('hrm:extensions.adjustment.errors.futureTime'));
        return;
      }
    }

    // Gửi yêu cầu giải trình thật lên server - AttendanceAdjustmentsService validate lại TOÀN BỘ
    // các điều kiện trên (7 ngày/thứ tự giờ/không vượt hiện tại) phía server, đây chỉ là lớp phản
    // hồi nhanh cho trải nghiệm người dùng.
    createAdjustment.mutate(
      {
        attendanceId: record.id,
        proposedCheckInAt: `${record.workDate}T${inTime}:00+07:00`,
        proposedCheckOutAt: `${record.workDate}T${outTime}:00+07:00`,
        reason: reason.trim(),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('hrm:extensions.adjustment.modalTitle')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <span className="block text-xs font-semibold text-slate-500 mb-1">
            {t('hrm:extensions.adjustment.dateLabel')}
          </span>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-900">
            {formatDate(record.workDate)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('hrm:extensions.adjustment.checkInLabel')} htmlFor="adj-in-time" required>
            <TimePicker
              id="adj-in-time"
              value={inTime}
              onChange={setInTime}
              position="bottom"
              required
            />
          </FormField>

          <FormField label={t('hrm:extensions.adjustment.checkOutLabel')} htmlFor="adj-out-time" required>
            <TimePicker
              id="adj-out-time"
              value={outTime}
              onChange={setOutTime}
              position="bottom"
              align="right"
              required
            />
          </FormField>
        </div>

        <FormField
          label={t('hrm:extensions.adjustment.reasonLabel')}
          htmlFor="adj-reason"
          error={error || undefined}
          required
        >
          <Textarea
            id="adj-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('hrm:extensions.adjustment.reasonPlaceholder')}
            className="text-xs"
            rows={3}
            required
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('hrm:extensions.adjustment.cancelButton')}
          </Button>
          <Button type="submit" size="sm" disabled={createAdjustment.isPending}>
            {t('hrm:extensions.adjustment.submitButton')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

