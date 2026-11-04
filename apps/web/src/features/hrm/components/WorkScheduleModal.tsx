import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { cn } from '@/lib/utils';
import { useUpdateWorkSchedule, useWorkScheduleQuery } from '../hooks';

// 04/11/2026: thu tu hien thi T2..CN; gia tri gui di theo quy uoc may chu (0 = Chu nhat, 1 = Thu hai ... 6 = Thu bay).
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

/**
 * 04/11/2026: cau hinh lich lam viec cua to chuc (ngay lam trong tuan, gio vao/ra, gia han, gio nghi).
 * Chi mo duoc voi PERMISSIONS.ORG_MANAGE (nut mo o MonthlyTimesheetTable). Kiem tra hop le chinh nam o
 * may chu (WORK_SCHEDULE_INVALID); o day chi chan nhanh nhung loi hien nhien.
 */
export function WorkScheduleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const scheduleQuery = useWorkScheduleQuery({ enabled: open });
  const update = useUpdateWorkSchedule();

  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [workStart, setWorkStart] = useState('08:30');
  const [workEnd, setWorkEnd] = useState('17:30');
  const [lateGrace, setLateGrace] = useState('0');
  const [earlyGrace, setEarlyGrace] = useState('0');
  const [breakMinutes, setBreakMinutes] = useState('60');
  const [error, setError] = useState('');

  useEffect(() => {
    const s = scheduleQuery.data;
    if (!s) return;
    setWeekdays(s.workingWeekdays);
    setWorkStart(s.workStart);
    setWorkEnd(s.workEnd);
    setLateGrace(String(s.lateGraceMinutes));
    setEarlyGrace(String(s.earlyLeaveGraceMinutes));
    setBreakMinutes(String(s.breakMinutes));
    setError('');
  }, [scheduleQuery.data]);

  function toggleDay(day: number) {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    if (error) setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const minutes = [lateGrace, earlyGrace, breakMinutes].map(Number);
    if (weekdays.length === 0) return setError(t('hrm:workSchedule.errors.noWeekday'));
    if (!workStart || !workEnd || workEnd <= workStart) return setError(t('hrm:workSchedule.errors.timeRange'));
    if (minutes.some((m) => !Number.isInteger(m) || m < 0 || m > 240)) return setError(t('hrm:workSchedule.errors.minutes'));
    setError('');
    update.mutate(
      {
        workingWeekdays: [...weekdays].sort((a, b) => a - b),
        workStart,
        workEnd,
        lateGraceMinutes: minutes[0],
        earlyLeaveGraceMinutes: minutes[1],
        breakMinutes: minutes[2],
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={open} onClose={onClose} preventCloseWhilePending={update.isPending} title={t('hrm:workSchedule.title')} size="sm">
      <QueryState
        isLoading={scheduleQuery.isLoading}
        isError={scheduleQuery.isError}
        onRetry={() => scheduleQuery.refetch()}
        errorTitle={t('hrm:workSchedule.loadError')}
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <p className="text-[12px] font-medium text-text-secondary">{t('hrm:workSchedule.weekdaysLabel')}</p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_VALUES.map((day, idx) => {
                const active = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'h-9 rounded-radius-sm border text-[12px] font-medium transition-colors cursor-pointer',
                      active
                        ? 'border-text-primary bg-text-primary text-white'
                        : 'border-border-strong bg-white text-text-secondary hover:bg-bg-subtle',
                    )}
                  >
                    {t(`common:datePicker.weekDays.${idx}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 04/11/2026: nhan dai xuong 2 dong khong lam lech o nhap cung hang. */}
          <div className="grid grid-cols-2 items-end gap-3">
            <FormField label={t('hrm:workSchedule.workStartLabel')} htmlFor="ws-start">
              <Input id="ws-start" type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="text-xs" />
            </FormField>
            <FormField label={t('hrm:workSchedule.workEndLabel')} htmlFor="ws-end">
              <Input id="ws-end" type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="text-xs" />
            </FormField>
            <FormField label={t('hrm:workSchedule.lateGraceLabel')} htmlFor="ws-late">
              <Input id="ws-late" type="number" min={0} max={240} value={lateGrace} onChange={(e) => setLateGrace(e.target.value)} className="text-xs" />
            </FormField>
            <FormField label={t('hrm:workSchedule.earlyGraceLabel')} htmlFor="ws-early">
              <Input id="ws-early" type="number" min={0} max={240} value={earlyGrace} onChange={(e) => setEarlyGrace(e.target.value)} className="text-xs" />
            </FormField>
          </div>
          <FormField label={t('hrm:workSchedule.breakLabel')} htmlFor="ws-break" error={error}>
            <Input id="ws-break" type="number" min={0} max={240} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} className="text-xs" />
          </FormField>
          <p className="text-[11px] text-text-tertiary">{t('hrm:workSchedule.hint')}</p>

          <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={update.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {t('common:actions.save')}
            </Button>
          </div>
        </form>
      </QueryState>
    </Modal>
  );
}
