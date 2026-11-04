import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CustomFilterSelect } from '@/components/ui/CustomFilterSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField, Input } from '@/components/ui/Input';
import { QueryState } from '@/components/ui/QueryState';
import { formatTime } from '@/lib/utils';
import { TIMESHEET_SYMBOLS } from '@/types';
import type { TimesheetDay, TimesheetSymbol } from '@/types';
import { useDeleteTimesheetEntry, useTimesheetUserQuery, useUpsertTimesheetEntry } from '../hooks';
import { SymbolBadge, SymbolLegend } from './timesheet-shared';

interface TimesheetDetailModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  month: string; // 'YYYY-MM'
  today: string; // 'YYYY-MM-DD' GMT+7
  /** Co PERMISSIONS.ATTENDANCE_ADJUSTMENT_APPROVE hay khong - quyet dinh co hien nut sua tay. */
  canAdjust: boolean;
}

/** Thu trong tuan (0 = Chu nhat) cua chuoi YYYY-MM-DD, tinh bang UTC de khong lech theo gio may. */
function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * 04/11/2026: chi tiet bang cong thang cua 1 nhan vien (du lieu may chu tinh): ky hieu, gio vao/ra, muon, lam
 * them tung ngay. Nguoi co ATTENDANCE_ADJUSTMENT_APPROVE sua tay duoc khi ky dang mo (ky khoa thi an nut sua).
 */
export function TimesheetDetailModal({ open, onClose, userId, userName, month, today, canAdjust }: TimesheetDetailModalProps) {
  const { t } = useTranslation();
  const query = useTimesheetUserQuery(userId, month, { enabled: open });
  const upsert = useUpsertTimesheetEntry();
  const remove = useDeleteTimesheetEntry();

  const [editing, setEditing] = useState<TimesheetDay | null>(null);
  const [symbol, setSymbol] = useState<TimesheetSymbol>('X');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const detail = query.data;
  const isLocked = detail?.period.status === 'LOCKED';
  const joinedAt = detail?.summary.joinedAt?.slice(0, 10) ?? '';
  const symbolOptions = TIMESHEET_SYMBOLS.map((s) => ({ value: s, label: `${s} - ${t(`hrm:timesheet.symbols.${s}`)}` }));

  function startEdit(day: TimesheetDay) {
    setEditing(day);
    setSymbol(day.symbol ?? 'X');
    setNote(day.note ?? '');
    setError('');
  }

  function handleSave() {
    if (!editing) return;
    if (!note.trim()) {
      setError(t('hrm:timesheetDetail.noteRequired'));
      return;
    }
    upsert.mutate({ userId, workDate: editing.date, symbol, note: note.trim() }, { onSuccess: () => setEditing(null) });
  }

  function handleRemove() {
    if (!editing) return;
    remove.mutate({ userId, workDate: editing.date }, { onSuccess: () => setEditing(null) });
  }

  // Ngay co the sua tay: ky mo, khong phai ngay tuong lai, khong truoc ngay vao lam (may chu van kiem tra lai).
  const canEditDay = (day: TimesheetDay) => canAdjust && !isLocked && day.date <= today && (!joinedAt || day.date >= joinedAt);

  function renderDayLabel(day: TimesheetDay) {
    const wd = weekdayOf(day.date);
    return `${day.date.slice(8, 10)}/${day.date.slice(5, 7)} ${t(`common:datePicker.weekDays.${(wd + 6) % 7}`)}`;
  }

  function renderNote(day: TimesheetDay) {
    return (
      <>
        {day.holidayName && <span className="block text-[11px] text-[#1E5A8A] break-words">{day.holidayName}</span>}
        {day.isManual && (
          <span className="block text-[11px] text-text-tertiary break-words">
            {t('hrm:timesheetDetail.manualMark')}
            {day.note ? `: ${day.note}` : ''}
          </span>
        )}
      </>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventCloseWhilePending={upsert.isPending || remove.isPending}
      title={t('hrm:timesheetDetail.title', { name: userName, month })}
      size="xl"
    >
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorTitle={t('hrm:timesheetDetail.loadError')}
      >
        {!detail || detail.days.length === 0 ? (
          <EmptyState title={t('hrm:timesheetDetail.empty')} />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-secondary">
              <span>
                {t('hrm:timesheetDetail.paidOfExpected')}:{' '}
                <strong className="font-mono text-text-primary tabular-nums">
                  {detail.summary.paidDays} / {detail.summary.expectedDays}
                </strong>
              </span>
              <span>
                {t('hrm:timesheetDetail.periodStatus')}:{' '}
                <strong className="text-text-primary">{t(`hrm:timesheet.period.status.${detail.period.status}`)}</strong>
              </span>
            </div>

            {isLocked && <p className="rounded-radius-xs bg-[#FBEEE0] px-3 py-2 text-[12px] text-[#B45309]">{t('hrm:timesheetDetail.lockedHint')}</p>}

            {/* Desktop: bang */}
            <div className="hidden sm:block max-h-[360px] overflow-auto rounded-radius-sm border border-border-subtle">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10 bg-bg-subtle border-b border-border-subtle">
                  <tr className="text-left text-[12px] font-medium text-text-tertiary">
                    <th className="py-2 px-3">{t('hrm:timesheetDetail.columns.date')}</th>
                    <th className="py-2 px-3 text-center">{t('hrm:timesheetDetail.columns.symbol')}</th>
                    <th className="py-2 px-3">{t('hrm:timesheetDetail.columns.checkIn')}</th>
                    <th className="py-2 px-3">{t('hrm:timesheetDetail.columns.checkOut')}</th>
                    <th className="py-2 px-3 text-right">{t('hrm:timesheetDetail.columns.late')}</th>
                    <th className="py-2 px-3 text-right">{t('hrm:timesheetDetail.columns.ot')}</th>
                    <th className="py-2 px-3">{t('hrm:timesheetDetail.columns.note')}</th>
                    {canAdjust && !isLocked && <th className="py-2 px-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle bg-white">
                  {detail.days.map((day) => (
                    <tr key={day.date} className={day.isWorkingDay ? '' : 'bg-bg-subtle/60'}>
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-[12px] tabular-nums">{renderDayLabel(day)}</td>
                      <td className="py-2 px-3 text-center">
                        <SymbolBadge symbol={day.symbol} />
                      </td>
                      <td className="py-2 px-3 font-mono text-[12px] tabular-nums">{formatTime(day.checkInAt)}</td>
                      <td className="py-2 px-3 font-mono text-[12px] tabular-nums">{formatTime(day.checkOutAt)}</td>
                      <td className="py-2 px-3 text-right font-mono text-[12px] tabular-nums">
                        {day.lateMinutes > 0 ? t('hrm:timesheetDetail.minutes', { count: day.lateMinutes }) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[12px] tabular-nums">{day.otHours > 0 ? `${day.otHours}h` : '—'}</td>
                      <td className="py-2 px-3 max-w-[220px]">{renderNote(day)}</td>
                      {canAdjust && !isLocked && (
                        <td className="py-2 px-3 text-right">
                          {canEditDay(day) && (
                            <button type="button" onClick={() => startEdit(day)} className="text-[12px] font-medium text-accent hover:underline cursor-pointer">
                              {t('hrm:timesheetDetail.editButton')}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: the theo ngay (cung kieu the cua MonthlyTimesheetTable) */}
            <div className="block sm:hidden max-h-[360px] space-y-2 overflow-y-auto">
              {detail.days.map((day) => (
                <div key={day.date} className="space-y-1.5 rounded-radius-sm border border-border-subtle bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-medium tabular-nums">{renderDayLabel(day)}</span>
                    <SymbolBadge symbol={day.symbol} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary">
                    <span>
                      {t('hrm:timesheetDetail.columns.checkIn')}: <span className="font-mono text-text-primary">{formatTime(day.checkInAt)}</span>
                    </span>
                    <span>
                      {t('hrm:timesheetDetail.columns.checkOut')}: <span className="font-mono text-text-primary">{formatTime(day.checkOutAt)}</span>
                    </span>
                    <span>
                      {t('hrm:timesheetDetail.columns.late')}:{' '}
                      <span className="font-mono text-text-primary">{day.lateMinutes > 0 ? t('hrm:timesheetDetail.minutes', { count: day.lateMinutes }) : '—'}</span>
                    </span>
                    <span>
                      {t('hrm:timesheetDetail.columns.ot')}: <span className="font-mono text-text-primary">{day.otHours > 0 ? `${day.otHours}h` : '—'}</span>
                    </span>
                  </div>
                  {renderNote(day)}
                  {canEditDay(day) && (
                    <button type="button" onClick={() => startEdit(day)} className="text-[12px] font-medium text-accent hover:underline cursor-pointer">
                      {t('hrm:timesheetDetail.editButton')}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {editing && (
              <div className="space-y-3 rounded-radius-sm border border-border-strong bg-bg-subtle p-3">
                <p className="text-[13px] font-semibold text-text-primary">{t('hrm:timesheetDetail.editTitle', { date: renderDayLabel(editing) })}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-[12px] font-medium text-text-secondary">{t('hrm:timesheetDetail.symbolLabel')}</label>
                    <CustomFilterSelect value={symbol} options={symbolOptions} onChange={(v) => setSymbol(v as TimesheetSymbol)} position="top" />
                  </div>
                  <FormField label={t('hrm:timesheetDetail.noteLabel')} htmlFor="ts-entry-note" error={error} required>
                    <Input id="ts-entry-note" value={note} onChange={(e) => setNote(e.target.value)} className="text-xs" />
                  </FormField>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {editing.isManual ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleRemove} disabled={remove.isPending || upsert.isPending}>
                      {t('hrm:timesheetDetail.removeButton')}
                    </Button>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
                      {t('common:actions.cancel')}
                    </Button>
                    <Button type="button" size="sm" onClick={handleSave} disabled={upsert.isPending || remove.isPending}>
                      {t('common:actions.save')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <SymbolLegend />
          </div>
        )}
      </QueryState>
    </Modal>
  );
}
