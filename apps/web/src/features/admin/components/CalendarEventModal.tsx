import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { cn } from '@/lib/utils';
import { useCreateCalendarEvent, useUpdateCalendarEvent } from '../hooks';
import type { CalendarEvent, CalendarEventType } from '@/types';

// 15/09/2026: Lich cong ty - modal tao/sua 1 muc lich (ngay le hoac su kien), mirror cau truc
// DepartmentModal.tsx (cung to chuc create/update trong 1 modal qua prop `calendarEvent?`).
export function CalendarEventModal({
  open,
  onClose,
  onDelete,
  calendarEvent,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  /** 15/09/2026: nut "Xoa" trong modal nay chi goi ra ConfirmDialog cua CalendarPage.tsx - khong tu xoa truc tiep o day. */
  onDelete?: (calendarEvent: CalendarEvent) => void;
  calendarEvent?: CalendarEvent | null;
  /** Ngay duoc bam chon tren luoi lich (khi tao moi tu 1 o ngay cu the) - bo qua khi dang sua. */
  defaultDate?: string;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarEventType>('EVENT');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const createCalendarEvent = useCreateCalendarEvent();
  const updateCalendarEvent = useUpdateCalendarEvent();
  const isEditing = Boolean(calendarEvent);

  useEffect(() => {
    if (open) {
      setTitle(calendarEvent?.title ?? '');
      setDescription(calendarEvent?.description ?? '');
      setType(calendarEvent?.type ?? 'EVENT');
      setStartDate(calendarEvent?.startDate ?? defaultDate ?? '');
      setEndDate(calendarEvent?.endDate ?? defaultDate ?? '');
      setError('');
    }
  }, [open, calendarEvent, defaultDate]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('admin:calendarEventModal.titleRequiredError'));
      return;
    }
    if (!startDate) {
      setError(t('admin:calendarEventModal.startDateRequiredError'));
      return;
    }
    if (endDate && endDate < startDate) {
      setError(t('admin:calendarEventModal.endDateBeforeStartError'));
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      startDate,
      endDate: endDate || startDate,
    };
    if (isEditing && calendarEvent) {
      updateCalendarEvent.mutate({ id: calendarEvent.id, payload }, { onSuccess: onClose });
    } else {
      createCalendarEvent.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = createCalendarEvent.isPending || updateCalendarEvent.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventCloseWhilePending={isPending}
      title={isEditing ? t('admin:calendarEventModal.editTitle') : t('admin:calendarEventModal.createTitle')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Cong tac dang segmented control chon loai muc lich - mirror FolderShareModal.tsx. */}
        <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1 text-xs">
          {(['HOLIDAY', 'EVENT'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setType(opt)}
              className={cn(
                'flex-1 rounded-lg py-1.5 font-semibold transition-all cursor-pointer',
                type === opt ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {t(`admin:calendarEventModal.type.${opt}`)}
            </button>
          ))}
        </div>

        {/* 17/09/2026: HOLIDAY gio co anh huong THAT (chan cham cong toan to chuc + gui thong bao),
            khong con thuan tuy trang tri nhu truoc - canh bao ro cho Org Admin biet truoc khi luu. */}
        {type === 'HOLIDAY' && (
          <p className="rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2 text-xs text-amber-800">
            {t('admin:calendarEventModal.holidayHint')}
          </p>
        )}

        <FormField label={t('admin:calendarEventModal.titleLabel')} htmlFor="calendar-event-title" error={error} required>
          <Input
            id="calendar-event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('admin:calendarEventModal.titlePlaceholder')}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="calendar-event-start-date">
              {t('admin:calendarEventModal.startDateLabel')} <span className="text-rose-500">*</span>
            </label>
            <DatePicker id="calendar-event-start-date" value={startDate} onChange={setStartDate} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="calendar-event-end-date">
              {t('admin:calendarEventModal.endDateLabel')}
            </label>
            <DatePicker id="calendar-event-end-date" value={endDate} onChange={setEndDate} minDate={startDate || undefined} align="right" />
          </div>
        </div>

        <FormField label={t('admin:calendarEventModal.descriptionLabel')} htmlFor="calendar-event-description">
          <Textarea id="calendar-event-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>

        <div className="flex items-center justify-between gap-2 pt-1">
          {isEditing && calendarEvent && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(calendarEvent)}
              disabled={isPending}
              className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {t('admin:calendarEventModal.delete')}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('admin:calendarEventModal.cancel')}
            </Button>
            <Button type="submit" isLoading={isPending}>
              {isEditing ? t('admin:calendarEventModal.saveChanges') : t('admin:calendarEventModal.create')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
