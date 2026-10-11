// 15/09/2026: trang goc "Lich cong ty" (HRM-lite mo rong, theo yeu cau GVHD - xem
// Technical_Spec.md "Lich cong ty") - Org Admin thiet lap ngay le + su kien/dat lich dung chung
// toan to chuc. Luoi thang tai su dung LAI dung logic tinh toan o day (firstDayOfMonth/
// startingDayIndex/daysInMonth) cua DatePicker.tsx (components/ui/) - khong import thang
// DatePicker vi do la 1 POPOVER gan voi 1 o nhap lieu, khong phai luoi hien thi toan trang; day
// la ban dung rieng cho boi canh "xem ca thang" (khac boi canh "chon 1 ngay" cua DatePicker).
//
// 03/10/2026: chuyen tu features/admin/CalendarPage.tsx (trang day du, chi Org Admin) sang day
// (component nhung, dung trong LeaveRequestsPage.tsx) theo hop dong moi: GET /calendar-events mo
// cho MOI thanh vien da xac thuc (khong con gate quyen), POST type=EVENT ai cung tao duoc, type=
// HOLIDAY can PERMISSIONS.CALENDAR_MANAGE (gio ca Manager LAN Org Admin deu co, khong rieng Org
// Admin nhu truoc). PATCH/DELETE 1 muc lich: duoc phep neu la nguoi TAO ra no, HOAC co
// CALENDAR_MANAGE va cap bac (rank) cua CHINH MINH cao hon cap bac cua nguoi da tao (createdByRank)
// - tinh rank theo permission (KHONG doan ten vai tro, du an nay da tung sua loi anti-pattern nay -
// xem canReassignOwner tai CustomerDetailPage.tsx).
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/ui/Modal';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { QueryState } from '@/components/ui/QueryState';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/components/ui/Icons';
import { cn, getTodayGmt7DateString } from '@/lib/utils';
import { useAuthStore, usePermissions } from '@/stores/auth.store';
import { PERMISSIONS } from '@/constants/permissions';
import { useCalendarEventsQuery, useDeleteCalendarEvent } from '../hooks';
import { CalendarEventModal } from './CalendarEventModal';
import type { CalendarEvent } from '@/types';

const TYPE_DOT_CLASS: Record<CalendarEvent['type'], string> = {
  HOLIDAY: 'bg-[#B3261E]',
  EVENT: 'bg-[#0E5E5E]',
};

const MAX_PILLS_PER_CELL = 2;

/**
 * 03/10/2026: cap bac (tier) cua CHINH nguoi dang xem, tinh THEO PERMISSION ho dang giu (khop
 * dung dinh nghia createdByRank ma backend gan cho muc lich luc tao - xem CalendarEvent type) -
 * dung de so sanh voi createdByRank cua 1 muc lich khi quyet dinh co duoc sua/xoa muc do khong
 * (du KHONG phai nguoi tao ra no).
 */
function computeOwnRank(permissions: string[]): number {
  if (permissions.includes(PERMISSIONS.ORG_MANAGE)) return 3;
  if (permissions.includes(PERMISSIONS.CALENDAR_MANAGE)) return 2;
  return 1;
}

/** Component nhung, co the dat trong bat ky trang nao (hien dang dung trong LeaveRequestsPage.tsx) - tu fetch du lieu, khong nhan prop. */
export function CompanyCalendar() {
  const { t } = useTranslation();
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<string | undefined>(undefined);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);

  const currentUser = useAuthStore((s) => s.user);
  const permissions = usePermissions();
  const canManageCalendar = permissions.includes(PERMISSIONS.CALENDAR_MANAGE);
  const ownRank = useMemo(() => computeOwnRank(permissions), [permissions]);

  const todayStr = useMemo(() => getTodayGmt7DateString(), []);
  const monthStartStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthEndStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const calendarEventsQuery = useCalendarEventsQuery({ startDate: monthStartStr, endDate: monthEndStr });
  const deleteCalendarEvent = useDeleteCalendarEvent();
  const events = calendarEventsQuery.data ?? [];

  /**
   * Nguoi xem duoc sua/xoa 1 muc lich neu la nguoi tao ra no, HOAC co CALENDAR_MANAGE va cap bac
   * cao hon nguoi da tao. RIENG HOLIDAY: giu CALENDAR_MANAGE la DU, khong so sanh cap bac - mirror
   * dung "backstop HOLIDAY" cua `assertCanModify()` phia backend (bat ky Org Admin/Manager nao
   * cung quan ly duoc moi ngay le, khong chi Org Admin cao cap hon nguoi da tao no). Thieu nhanh
   * nay (phat hien qua rieng soat 03/10/2026) khien 1 Manager khong thay nut Sua/Xoa cho ngay le
   * do Org Admin tao du backend van chap nhan request - form chi mo len o dang chi-doc oan uong.
   */
  function canManageEvent(event: CalendarEvent): boolean {
    if (event.type === 'HOLIDAY') return canManageCalendar;
    if (currentUser && event.createdByUserId === currentUser.id) return true;
    return canManageCalendar && ownRank > event.createdByRank;
  }

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  // 0 (Chu nhat) -> 6, 1 (T2) -> 0 - tuan bat dau Thu Hai, mirror DatePicker.tsx.
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => t(`common:datePicker.months.${i}`));
  const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => t(`common:datePicker.weekDays.${i}`));

  function goToPrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function eventsForDay(dayStr: string): CalendarEvent[] {
    // Muc lich nhieu ngay (vd Tet) "chong lan" voi ngay nay neu startDate <= dayStr <= endDate.
    return events.filter((e) => e.startDate <= dayStr && e.endDate >= dayStr);
  }

  function openCreateForDay(dayStr: string) {
    setCreateDefaultDate(dayStr);
    setIsCreateOpen(true);
  }

  return (
    <div className="space-y-3">
      {/* Header lịch: nut < > ghost + Thang MM YYYY + nut + Muc moi Secondary h28 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-radius-sm border border-border-subtle bg-white p-0.5">
          <button
            type="button"
            onClick={goToPrevMonth}
            aria-label={t('common:datePicker.prevMonthAria')}
            className="flex h-7 w-7 items-center justify-center rounded-radius-sm text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-24 text-center font-mono text-[13px] font-semibold text-text-primary tabular-nums">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label={t('common:datePicker.nextMonthAria')}
            className="flex h-7 w-7 items-center justify-center rounded-radius-sm text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors cursor-pointer"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            // 05/10/2026 (fix loi thuc te): truoc ban sua nay, khi dang xem 1 THANG DA QUA (lui
            // ve qua cac mui ten), nut nay dien san monthStartStr (ngay 1 cua thang do) - 1 ngay
            // QUA KHU - lam nguoi dung mo form tao moi voi ngay khong hop le san co. Danh gia 3
            // truong hop: thang dang xem CHUA ngay hom nay -> todayStr; thang trong TUONG LAI
            // (monthStartStr > todayStr) -> monthStartStr; thang DA QUA -> todayStr (khong duoc
            // dung monthStartStr qua khu).
            setCreateDefaultDate(monthStartStr > todayStr ? monthStartStr : todayStr);
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-radius-xs border border-border-strong bg-white hover:bg-bg-subtle text-[12px] font-medium text-text-primary transition-colors cursor-pointer shrink-0"
        >
          <PlusIcon className="h-3 w-3" />
          <span>{t('hrm:companyCalendar.newEntry')}</span>
        </button>
      </div>

      {/* Legend dot 6px: Ngày lễ #B3261E, Sự kiện #0E5E5E */}
      <div className="flex items-center gap-3 text-[12px] font-normal text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B3261E] shrink-0" />
          <span>{t('hrm:calendarEventModal.type.HOLIDAY')}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0E5E5E] shrink-0" />
          <span>{t('hrm:calendarEventModal.type.EVENT')}</span>
        </span>
      </div>

      {/* Lưới tháng: Side-widget phẳng, cell tự co BỎ fix h96 */}
      <div className="overflow-hidden rounded-radius-md border border-border-subtle bg-white">
        <QueryState
          isLoading={calendarEventsQuery.isLoading}
          isError={calendarEventsQuery.isError}
          onRetry={() => calendarEventsQuery.refetch()}
          loadingFallback={
            <div className="flex justify-center py-8">
              <FullPageSpinner label={t('hrm:companyCalendar.loading')} />
            </div>
          }
          errorTitle={t('hrm:companyCalendar.errorTitle')}
        >
          {/* Header 7 cột T2..CN */}
          <div className="grid grid-cols-7 border-b border-border-subtle bg-bg-subtle">
            {WEEK_DAYS.map((wd, idx) => (
              <div key={idx} className="py-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {wd}
              </div>
            ))}
          </div>

          {/* Lưới ngày: Cell phóng to, co giãn tự nhiên, hiện rõ ngày và thẻ sự kiện/ngày lễ */}
          <div className="grid grid-cols-7">
            {/* Ngày tháng trước */}
            {Array.from({ length: startingDayIndex }).map((_, i) => (
              <div
                key={`prev-${i}`}
                className="min-h-[72px] sm:min-h-[84px] border-b border-r border-border-subtle bg-bg-subtle/50 p-1.5 text-text-tertiary"
              >
                <span className="font-mono text-[11px] font-medium tabular-nums">
                  {daysInPrevMonth - startingDayIndex + i + 1}
                </span>
              </div>
            ))}

            {/* Ngày tháng hiện tại */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dayStr === todayStr;
              // 05/10/2026 (fix loi thuc te): ngay da qua khong con mo duoc form tao moi khi bam vao
              // o ngay - truoc ban sua nay bam vao BAT KY o nao (ke ca qua khu) deu mo CalendarEventModal
              // voi ngay do dien san, chi bi chan luc submit (bao loi bat ngo). Cac muc lich CO SAN
              // trong ngay qua khu van xem/sua duoc binh thuong qua nut rieng cua tung muc (bubble
              // stopPropagation, doc lap voi onClick cua o ngay o day).
              const isPast = dayStr < todayStr;
              const dayEvents = eventsForDay(dayStr);
              const visibleEvents = dayEvents.slice(0, 2);
              const hiddenCount = dayEvents.length - visibleEvents.length;

              return (
                <div
                  key={`cur-${day}`}
                  onClick={isPast ? undefined : () => openCreateForDay(dayStr)}
                  role={isPast ? undefined : 'button'}
                  tabIndex={isPast ? undefined : 0}
                  onKeyDown={
                    isPast
                      ? undefined
                      : (e) => {
                          if (e.key === 'Enter') openCreateForDay(dayStr);
                        }
                  }
                  className={cn(
                    'group relative flex min-h-[72px] sm:min-h-[84px] flex-col justify-between border-b border-r border-border-subtle p-1.5 transition-colors',
                    isPast ? 'bg-bg-subtle/50' : 'cursor-pointer hover:bg-bg-subtle',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-medium tabular-nums',
                        isToday ? 'bg-text-primary text-white font-bold' : 'text-text-primary',
                      )}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Thẻ sự kiện / ngày lễ dạng pill rõ ràng */}
                  <div className="mt-1 space-y-1 w-full">
                    {visibleEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEvent(ev);
                        }}
                        title={ev.title}
                        className={cn(
                          'block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80 cursor-pointer',
                          ev.type === 'HOLIDAY'
                            ? 'bg-[#F8E5E3] text-[#B3261E] border border-[#B3261E]/20'
                            : 'bg-[#E4EFEE] text-[#0E5E5E] border border-[#0E5E5E]/20',
                        )}
                      >
                        {ev.title}
                      </button>
                    ))}
                    {hiddenCount > 0 && (
                      <span className="block px-1 font-mono text-[9px] font-medium text-text-tertiary tabular-nums">
                        +{hiddenCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Ngày tháng sau */}
            {Array.from({ length: Math.max(0, 42 - (startingDayIndex + daysInMonth)) }).map((_, i) => (
              <div
                key={`next-${i}`}
                className="min-h-[72px] sm:min-h-[84px] border-b border-r border-border-subtle bg-bg-subtle/50 p-1.5 text-text-tertiary"
              >
                <span className="font-mono text-[11px] font-medium tabular-nums">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </QueryState>
      </div>

      <CalendarEventModal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} defaultDate={createDefaultDate} />
      <CalendarEventModal
        open={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        calendarEvent={editingEvent}
        readOnly={editingEvent ? !canManageEvent(editingEvent) : false}
        onDelete={
          editingEvent && canManageEvent(editingEvent)
            ? (ev) => {
                setEditingEvent(null);
                setDeletingEvent(ev);
              }
            : undefined
        }
      />
      <ConfirmDialog
        open={Boolean(deletingEvent)}
        onClose={() => setDeletingEvent(null)}
        onConfirm={() => {
          if (deletingEvent) deleteCalendarEvent.mutate(deletingEvent.id);
          setDeletingEvent(null);
        }}
        title={t('hrm:companyCalendar.deleteConfirm.title')}
        description={deletingEvent ? t('hrm:companyCalendar.deleteConfirm.description', { title: deletingEvent.title }) : undefined}
        confirmLabel={t('hrm:calendarEventModal.delete')}
        danger
      />
    </div>
  );
}
