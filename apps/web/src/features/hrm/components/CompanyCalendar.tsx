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
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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
  HOLIDAY: 'bg-rose-500',
  EVENT: 'bg-indigo-500',
};
const TYPE_PILL_CLASS: Record<CalendarEvent['type'], string> = {
  HOLIDAY: 'bg-rose-50 text-rose-700 border-rose-200/60 hover:bg-rose-100',
  EVENT: 'bg-indigo-50 text-indigo-700 border-indigo-200/60 hover:bg-indigo-100',
};

const MAX_PILLS_PER_CELL = 3;

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{t('hrm:companyCalendar.description')}</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label={t('common:datePicker.prevMonthAria')}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="min-w-32 text-center text-sm font-bold text-slate-900">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              aria-label={t('common:datePicker.nextMonthAria')}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <Button
            onClick={() => {
              setCreateDefaultDate(todayStr >= monthStartStr && todayStr <= monthEndStr ? todayStr : monthStartStr);
              setIsCreateOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" /> {t('hrm:companyCalendar.newEntry')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', TYPE_DOT_CLASS.HOLIDAY)} /> {t('hrm:calendarEventModal.type.HOLIDAY')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', TYPE_DOT_CLASS.EVENT)} /> {t('hrm:calendarEventModal.type.EVENT')}
        </span>
      </div>

      <Card className="overflow-hidden">
        <QueryState
          isLoading={calendarEventsQuery.isLoading}
          isError={calendarEventsQuery.isError}
          onRetry={() => calendarEventsQuery.refetch()}
          loadingFallback={
            <div className="flex justify-center py-12">
              <FullPageSpinner label={t('hrm:companyCalendar.loading')} />
            </div>
          }
          errorTitle={t('hrm:companyCalendar.errorTitle')}
        >
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
            {WEEK_DAYS.map((wd, idx) => (
              <div key={idx} className="px-2 py-2 text-center text-[11px] font-bold text-slate-500">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {/* Ngay thang truoc - o mo, khong tuong tac */}
            {Array.from({ length: startingDayIndex }).map((_, i) => (
              <div key={`prev-${i}`} className="min-h-24 border-b border-r border-slate-100 bg-slate-50/40 p-1.5 text-[11px] text-slate-300">
                {daysInPrevMonth - startingDayIndex + i + 1}
              </div>
            ))}

            {/* Ngay thang hien tai */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dayStr === todayStr;
              const dayEvents = eventsForDay(dayStr);
              const visibleEvents = dayEvents.slice(0, MAX_PILLS_PER_CELL);
              const hiddenCount = dayEvents.length - visibleEvents.length;

              return (
                <div
                  key={`cur-${day}`}
                  onClick={() => openCreateForDay(dayStr)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openCreateForDay(dayStr);
                  }}
                  className="min-h-24 cursor-pointer border-b border-r border-slate-100 p-1.5 transition-colors hover:bg-slate-50/80"
                >
                  <span
                    className={cn(
                      'inline-flex h-5.5 w-5.5 items-center justify-center rounded-full text-[11px] font-bold',
                      isToday ? 'bg-primary-600 text-white' : 'text-slate-700',
                    )}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
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
                          'block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-semibold transition-colors cursor-pointer',
                          TYPE_PILL_CLASS[ev.type],
                        )}
                      >
                        {ev.title}
                      </button>
                    ))}
                    {hiddenCount > 0 && (
                      <span className="block px-1.5 text-[10px] font-semibold text-slate-400">
                        {t('hrm:companyCalendar.moreEntries', { count: hiddenCount })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Ngay thang sau - o mo, khong tuong tac, lap day du 42 o (6 hang x 7 cot) */}
            {Array.from({ length: Math.max(0, 42 - (startingDayIndex + daysInMonth)) }).map((_, i) => (
              <div key={`next-${i}`} className="min-h-24 border-b border-r border-slate-100 bg-slate-50/40 p-1.5 text-[11px] text-slate-300">
                {i + 1}
              </div>
            ))}
          </div>
        </QueryState>
      </Card>

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
