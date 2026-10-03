import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { useCreateCalendarEvent, useUpdateCalendarEvent } from '../hooks';
import type { CalendarEvent, CalendarEventType } from '@/types';

// 15/09/2026: Lich cong ty - modal tao/sua 1 muc lich (ngay le hoac su kien), mirror cau truc
// DepartmentModal.tsx (cung to chuc create/update trong 1 modal qua prop `calendarEvent?`).
// 03/10/2026: chuyen tu features/admin/components/ sang day (CompanyCalendar.tsx gio nhung trong
// features/hrm, mo cho moi thanh vien to chuc xem/tao - khong con rieng khu vuc Quan tri) + bo sung
// 2 prop moi: readOnly (xem CalendarEvent nguoi dung KHONG duoc sua/xoa - disable toan bo form, an
// nut Luu/Xoa) va an tuy chon HOLIDAY o cong tac loai neu nguoi dung khong co CALENDAR_MANAGE (thay
// vi de ho chon roi nhan 403 that su tu server - xem chu thich tai CompanyCalendar.tsx).
export function CalendarEventModal({
  open,
  onClose,
  onDelete,
  calendarEvent,
  defaultDate,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  /** 15/09/2026: nut "Xoa" trong modal nay chi goi ra ConfirmDialog cua CompanyCalendar.tsx - khong tu xoa truc tiep o day. */
  onDelete?: (calendarEvent: CalendarEvent) => void;
  calendarEvent?: CalendarEvent | null;
  /** Ngay duoc bam chon tren luoi lich (khi tao moi tu 1 o ngay cu the) - bo qua khi dang sua. */
  defaultDate?: string;
  /** 03/10/2026: true khi nguoi xem khong phai nguoi tao VA khong du cap bac quan ly muc lich nay -
   *  chi xem (moi field disabled, an nut Luu/Xoa), dung boi CompanyCalendar.tsx khi mo modal sua. */
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const canManageCalendar = permissions.includes(PERMISSIONS.CALENDAR_MANAGE);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarEventType>('EVENT');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const createCalendarEvent = useCreateCalendarEvent();
  const updateCalendarEvent = useUpdateCalendarEvent();
  const isEditing = Boolean(calendarEvent);

  // 17/09/2026 (giu nguyen tu ban admin): mac dinh HOLIDAY chi hop le voi nguoi co CALENDAR_MANAGE -
  // nguoi khong co quyen nay CHI tao duoc EVENT, nen danh sach tuy chon trong cong tac loai bo bot
  // HOLIDAY voi ho (thay vi de ho chon roi nhan 403 that su tu server khi submit).
  // 03/10/2026: NGOAI LE - dang xem/sua 1 muc HOLIDAY co san (du ban than khong co CALENDAR_MANAGE,
  // vd quyen vua bi thu hoi sau khi muc nay da duoc tao) van phai hien dung HOLIDAY dang la gia tri
  // THAT cua no, khong duoc am tham doi thanh EVENT chi vi bo loc o tren - neu khong, cong tac se
  // khong co nut nao o trang thai "dang chon" ca (gay hieu lam cho nguoi xem read-only).
  const typeOptions: CalendarEventType[] = canManageCalendar
    ? ['HOLIDAY', 'EVENT']
    : calendarEvent?.type === 'HOLIDAY'
      ? ['HOLIDAY']
      : ['EVENT'];

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
    if (readOnly) return;
    if (!title.trim()) {
      setError(t('hrm:calendarEventModal.titleRequiredError'));
      return;
    }
    if (!startDate) {
      setError(t('hrm:calendarEventModal.startDateRequiredError'));
      return;
    }
    if (endDate && endDate < startDate) {
      setError(t('hrm:calendarEventModal.endDateBeforeStartError'));
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
  const modalTitle = readOnly
    ? t('hrm:calendarEventModal.viewTitle')
    : isEditing
      ? t('hrm:calendarEventModal.editTitle')
      : t('hrm:calendarEventModal.createTitle');

  return (
    <Modal open={open} onClose={onClose} preventCloseWhilePending={isPending} title={modalTitle} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <fieldset disabled={readOnly} className="space-y-4">
          {/* Cong tac dang segmented control chon loai muc lich - mirror FolderShareModal.tsx. */}
          <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1 text-xs">
            {typeOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setType(opt)}
                className={cn(
                  'flex-1 rounded-lg py-1.5 font-semibold transition-all cursor-pointer disabled:cursor-not-allowed',
                  type === opt ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {t(`hrm:calendarEventModal.type.${opt}`)}
              </button>
            ))}
          </div>

          {/* 17/09/2026: HOLIDAY gio co anh huong THAT (chan cham cong toan to chuc + gui thong bao),
              khong con thuan tuy trang tri nhu truoc - canh bao ro cho nguoi co quyen biet truoc khi luu. */}
          {type === 'HOLIDAY' && (
            <p className="rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2 text-xs text-amber-800">
              {t('hrm:calendarEventModal.holidayHint')}
            </p>
          )}

          <FormField label={t('hrm:calendarEventModal.titleLabel')} htmlFor="calendar-event-title" error={error} required>
            <Input
              id="calendar-event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('hrm:calendarEventModal.titlePlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="calendar-event-start-date">
                {t('hrm:calendarEventModal.startDateLabel')} <span className="text-rose-500">*</span>
              </label>
              <DatePicker id="calendar-event-start-date" value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="calendar-event-end-date">
                {t('hrm:calendarEventModal.endDateLabel')}
              </label>
              <DatePicker id="calendar-event-end-date" value={endDate} onChange={setEndDate} minDate={startDate || undefined} align="right" />
            </div>
          </div>

          <FormField label={t('hrm:calendarEventModal.descriptionLabel')} htmlFor="calendar-event-description">
            <Textarea id="calendar-event-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </fieldset>

        <div className="flex items-center justify-between gap-2 pt-1">
          {!readOnly && isEditing && calendarEvent && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(calendarEvent)}
              disabled={isPending}
              className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {t('hrm:calendarEventModal.delete')}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {readOnly ? t('common:actions.close') : t('hrm:calendarEventModal.cancel')}
            </Button>
            {!readOnly && (
              <Button type="submit" isLoading={isPending}>
                {isEditing ? t('hrm:calendarEventModal.saveChanges') : t('hrm:calendarEventModal.create')}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
