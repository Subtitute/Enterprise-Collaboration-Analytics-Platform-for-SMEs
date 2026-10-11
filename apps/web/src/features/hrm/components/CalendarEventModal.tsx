import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { FormField, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { cn, getTodayGmt7DateString } from '@/lib/utils';
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
  // 05/10/2026 (fix loi thuc te - phat hien qua nguoi dung): truoc ban sua nay KHONG co kiem tra
  // nao ca - co the tao/doi 1 muc lich (EVENT lan HOLIDAY) sang ngay bat dau trong QUA KHU, cung
  // mot loi logic da tung sua cho NewLeaveRequestModal.tsx (15/09/2026) nhung chua ap dung o day.
  // `minDate`/kiem tra duoi day chi la lop chan dau tien (UI) - CalendarEventsService (server) moi
  // la lop xac thuc THAT SU (xem assertStartDateNotInPast).
  const todayGmt7 = getTodayGmt7DateString();

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
    // Chi chan khi ngay bat dau THAT SU doi sang qua khu - khong chan viec sua cac truong khac
    // (tieu de, mo ta...) cua 1 muc lich co san ma ngay bat dau da troi qua tu truoc (mirror dung
    // CalendarEventsService.update() phia server).
    if (startDate < todayGmt7 && startDate !== calendarEvent?.startDate) {
      setError(t('hrm:calendarEventModal.startDateInPastError'));
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
    <Modal
      open={open}
      onClose={onClose}
      preventCloseWhilePending={isPending}
      title={<span className="text-[16px] leading-[24px] font-semibold text-text-primary">{modalTitle}</span>}
      size="sm"
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          {!readOnly && isEditing && calendarEvent && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(calendarEvent)}
              disabled={isPending}
              className="text-[13px] font-medium text-[#B3261E] hover:underline disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {t('hrm:calendarEventModal.delete')}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm border border-border-strong bg-white hover:bg-bg-subtle text-[13px] font-medium text-text-primary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
            >
              {readOnly ? t('common:actions.close') : t('hrm:calendarEventModal.cancel')}
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center justify-center h-9 px-4 rounded-radius-sm bg-text-primary hover:bg-black text-white text-[13px] font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
              >
                {isPending
                  ? t('common:status.loading')
                  : isEditing
                    ? t('hrm:calendarEventModal.saveChanges')
                    : t('hrm:calendarEventModal.create')}
              </button>
            )}
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[min(640px,calc(100vh-80px))] overflow-y-auto" noValidate>
        <fieldset disabled={readOnly} className="space-y-4">
          {/* 1. Segmented Control 2 tab (nền bg-subtle, active nền trắng + Ink w600 + border subtle): Sự kiện | Ngày lễ. Icon 14px */}
          <div className="flex gap-1 rounded-radius-sm bg-bg-subtle p-1 text-[13px]">
            {typeOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setType(opt)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-radius-xs py-1.5 font-medium transition-all cursor-pointer disabled:cursor-not-allowed',
                  type === opt
                    ? 'border border-border-subtle bg-white text-text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    opt === 'HOLIDAY' ? 'bg-[#B3261E]' : 'bg-[#0E5E5E]',
                  )}
                />
                <span>{t(`hrm:calendarEventModal.type.${opt}`)}</span>
              </button>
            ))}
          </div>

          {type === 'HOLIDAY' && (
            <p className="rounded-radius-xs bg-[#FBEEE0] border border-[#B45309]/20 px-3 py-2 text-[12px] text-[#B45309]">
              {t('hrm:calendarEventModal.holidayHint')}
            </p>
          )}

          {/* 2. Tiêu đề *: input, placeholder Ví dụ: Nghỉ Tết Nguyên Đán */}
          <FormField label={t('hrm:calendarEventModal.titleLabel')} htmlFor="calendar-event-title" error={error} required>
            <input
              id="calendar-event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('hrm:calendarEventModal.titlePlaceholder')}
              className="h-9 w-full rounded-radius-sm border border-border-strong bg-white px-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </FormField>

          {/* 3. Row 2 cột: Ngày bắt đầu * / Ngày kết thúc — DatePicker Module 07, mono */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1" htmlFor="calendar-event-start-date">
                {t('hrm:calendarEventModal.startDateLabel')} <span className="text-[#B3261E]">*</span>
              </label>
              <DatePicker id="calendar-event-start-date" value={startDate} onChange={setStartDate} minDate={todayGmt7} position="bottom" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1" htmlFor="calendar-event-end-date">
                {t('hrm:calendarEventModal.endDateLabel')}
              </label>
              <DatePicker id="calendar-event-end-date" value={endDate} onChange={setEndDate} minDate={startDate || undefined} align="right" position="bottom" />
            </div>
          </div>

          {/* 4. Mô tả: textarea min-h 80 */}
          <FormField label={t('hrm:calendarEventModal.descriptionLabel')} htmlFor="calendar-event-description">
            <Textarea
              id="calendar-event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </FormField>
        </fieldset>
      </form>
    </Modal>
  );
}
