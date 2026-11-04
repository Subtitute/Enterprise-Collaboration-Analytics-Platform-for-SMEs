import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  approveAttendanceAdjustment,
  approveLeaveRequest,
  approveOvertimeRequest,
  cancelLeaveRequest,
  checkIn,
  checkOut,
  verifyFace,
  createAttendanceAdjustment,
  createCalendarEvent,
  createLeaveAdjustment,
  createLeaveRequest,
  createOvertimeRequest,
  deleteCalendarEvent,
  deleteTimesheetEntry,
  extractPendingConflict,
  fetchAllAttendance,
  fetchApprovedAttendanceAdjustments,
  fetchCalendarEvents,
  fetchLeaveAdjustments,
  fetchLeavePolicy,
  fetchLeaveRequestsForUser,
  fetchMyAttendance,
  fetchMyAttendanceAdjustments,
  fetchMyLeaveBalance,
  fetchMyLeaveRequests,
  fetchMyOvertimeRequests,
  fetchPendingAttendanceAdjustments,
  fetchPendingLeaveRequests,
  fetchPendingOvertimeRequests,
  fetchTimesheet,
  fetchTimesheetExceptions,
  fetchTimesheetUser,
  fetchWorkSchedule,
  fetchWorkingDays,
  lockTimesheetPeriod,
  rejectAttendanceAdjustment,
  rejectLeaveRequest,
  rejectOvertimeRequest,
  unlockTimesheetPeriod,
  updateCalendarEvent,
  updateLeavePolicy,
  updateWorkSchedule,
  upsertTimesheetEntry,
} from './api';
import type {
  CalendarEventPayload,
  CreateAttendanceAdjustmentPayload,
  CreateLeaveAdjustmentPayload,
  CreateLeaveRequestPayload,
  CreateOvertimeRequestPayload,
  UpdateLeavePolicyPayload,
  UpsertTimesheetEntryPayload,
} from './api';
import type { TimesheetExceptionType, WorkSchedule } from '@/types';
import type { CheckInLocation } from './components/CheckInCamera';
import { describeFaceResult } from './face-result';

export function useMyAttendanceQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['attendance', 'me', params], queryFn: () => fetchMyAttendance(params) });
}

/**
 * 403 (khong co PERMISSIONS.ATTENDANCE_VIEW) la ket qua BINH THUONG cho Employee - khong retry,
 * mirror usePendingLeaveRequestsQuery().
 *
 * 03/10/2026: bo sung tham so `month` ('YYYY-MM' hoac 'all') - phat hien qua rieng soat: ban cu
 * LUON goi `limit:100` khong loc ngay, roi AttendancePage.tsx tu cat theo thang o client - mot khi
 * to chuc vuot qua 100 dong cham cong tong, cac dong cua thang CU bi "day" ra khoi 100 dong moi
 * nhat va hien sai thanh "khong co du lieu". Nay truyen thang dang xem xuong de server loc tai
 * nguon (xem AttendanceQueryDto.startDate/endDate, apps/hrm-service).
 *
 * `placeholderData: keepPreviousData` - doi `month` lam queryKey doi theo, neu khong co tuy chon
 * nay thi `isSuccess` se tam thoi ve `false` trong luc tai du lieu thang moi (vi la 1 query-key
 * khac, chua co cache), khien `canViewAll` (AttendancePage.tsx, suy ra TU chinh isSuccess nay) an
 * mat toan bo khoi "Quan ly to chuc" trong chop nhoang moi lan doi thang - khong chi rieng bang du
 * lieu ben trong.
 */
export function useAllAttendanceQuery(month = 'all') {
  const dateRangeParams = (() => {
    if (month === 'all') return {};
    const [year, m] = month.split('-').map(Number);
    const lastDay = new Date(year, m, 0).getDate();
    return { startDate: `${month}-01`, endDate: `${month}-${String(lastDay).padStart(2, '0')}` };
  })();

  return useQuery({
    queryKey: ['attendance', 'all', month],
    queryFn: () => fetchAllAttendance({ limit: 100, ...dateRangeParams }),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/**
 * 03/10/2026: lich su cham cong DAY DU cua 1 nhan vien cu the - dung boi AttendanceDetailPage.tsx
 * (/attendance/:userId, CHI Manager/Org Admin). Tach rieng khoi useAllAttendanceQuery() (khac
 * queryKey + co loc userId) thay vi doi params cua hook do, vi 2 noi dung nay phuc vu 2 man hinh
 * khac nhau (danh sach toan to chuc vs lich su 1 nguoi) va khong muon 1 cache lam vo hieu cache kia.
 * `enabled` cho phep AttendanceDetailPage.tsx tri hoan goi API toi khi xac dinh duoc nguoi xem co
 * PERMISSIONS.ATTENDANCE_VIEW hay khong (tranh 1 request 403 chac chan that bai).
 */
export function useEmployeeAttendanceQuery(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['attendance', 'employee', userId],
    queryFn: () => fetchAllAttendance({ userId, limit: 200 }),
    enabled: (options?.enabled ?? true) && Boolean(userId),
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ photo, location }: { photo: Blob; location?: CheckInLocation }) => checkIn(photo, location),
    // 28/10/2026: bao ngay % tuong dong khuon mat (hoac ly do khong doi chieu duoc) ngay sau khi chup.
    onSuccess: ({ attendance, face }) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(
        t('hrm:toasts.checkInSuccess'),
        describeFaceResult(t, face, attendance.checkInFaceMatched, attendance.checkInFaceMatchScore),
      );
    },
    onError: (error) => toast.error(t('hrm:toasts.checkInError'), extractErrorMessage(error)),
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ photo, location }: { photo: Blob; location?: CheckInLocation }) => checkOut(photo, location),
    onSuccess: ({ attendance, face }) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(
        t('hrm:toasts.checkOutSuccess'),
        describeFaceResult(t, face, attendance.checkOutFaceMatched, attendance.checkOutFaceMatchScore),
      );
    },
    onError: (error) => toast.error(t('hrm:toasts.checkOutError'), extractErrorMessage(error)),
  });
}

/**
 * 28/10/2026: "Thu nhan dien" o Ho so ca nhan - doi chieu 1 anh voi anh da dang ky, KHONG tao ban ghi
 * cham cong. Loi (khong thay mat/dich vu cham) cung bao bang toast thay vi im lang.
 */
export function useFaceVerifyTest() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (photo: Blob) => verifyFace(photo),
    onSuccess: (result) => {
      const face = { status: result.enrolled ? ('scored' as const) : ('notEnrolled' as const), threshold: result.threshold };
      const description = describeFaceResult(t, face, result.matched, result.score);
      if (result.matched) toast.success(t('hrm:faceEnroll.testResultTitle'), description);
      else toast.info(t('hrm:faceEnroll.testResultTitle'), description);
    },
    onError: (error) => toast.error(t('hrm:faceEnroll.testResultTitle'), extractErrorMessage(error)),
  });
}

// 26/10/2026: 3 hook dang ky/xoa khuon mat (24/10/2026) chuyen sang features/face/hooks.ts - kho anh
// nhan dien + dong y (Technical_Spec.md muc 27).

export function useMyLeaveRequestsQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['leave-requests', 'me', params], queryFn: () => fetchMyLeaveRequests(params) });
}

/** 22/09/2026: so du phep nam hien tai - invalidate ['leave-requests'] (approve/reject o duoi) da
 *  bao gom key nay (khop tien to), nen "cap nhat realtime sau khi duyet" tu dong hoat dong. */
export function useMyLeaveBalanceQuery() {
  return useQuery({ queryKey: ['leave-requests', 'me', 'balance'], queryFn: () => fetchMyLeaveBalance() });
}

export function useLeavePolicyQuery() {
  return useQuery({ queryKey: ['leave-policy'], queryFn: () => fetchLeavePolicy() });
}

export function useUpdateLeavePolicy() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: UpdateLeavePolicyPayload) => updateLeavePolicy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-policy'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests', 'me', 'balance'] });
      toast.success(t('hrm:leaveRequestsPage.balance.policyUpdateSuccess'));
    },
    onError: (error) => toast.error(t('hrm:leaveRequestsPage.balance.policyUpdateError'), extractErrorMessage(error)),
  });
}

/** 403 (khong co PERMISSIONS.LEAVE_REQUEST_VIEW) la ket qua BINH THUONG cho Employee - khong retry, LeaveRequestsPage.tsx tu an muc nay khi loi. */
export function usePendingLeaveRequestsQuery() {
  return useQuery({
    queryKey: ['leave-requests', 'pending'],
    queryFn: () => fetchPendingLeaveRequests({ limit: 100 }),
    retry: false,
  });
}

/**
 * 03/10/2026: lich su nghi phep DAY DU (khong loc status) cua 1 nhan vien cu the - dung boi
 * LeaveRequestDetailPage.tsx (/leave-requests/:userId, CHI Manager/Org Admin). Mirror
 * useEmployeeAttendanceQuery() o hrm/hooks.ts (cung co che `enabled` tri hoan goi API toi khi xac
 * dinh duoc nguoi xem co PERMISSIONS.LEAVE_REQUEST_VIEW hay khong).
 */
export function useEmployeeLeaveRequestsQuery(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['leave-requests', 'employee', userId],
    queryFn: () => fetchLeaveRequestsForUser(userId, { limit: 100 }),
    enabled: (options?.enabled ?? true) && Boolean(userId),
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) => createLeaveRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success(t('hrm:toasts.createLeaveRequestSuccess'));
    },
    onError: (error) => toast.error(t('hrm:toasts.createLeaveRequestError'), extractErrorMessage(error)),
  });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => approveLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      // 04/11/2026: duyet don doi bang cong, so du phep va danh sach ngoai le do may chu tinh.
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:toasts.approveLeaveRequestSuccess'));
    },
    onError: (error) => toast.error(t('hrm:toasts.approveLeaveRequestError'), extractErrorMessage(error)),
  });
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => rejectLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:toasts.rejectLeaveRequestSuccess'));
    },
    onError: (error) => toast.error(t('hrm:toasts.rejectLeaveRequestError'), extractErrorMessage(error)),
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => cancelLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:toasts.cancelLeaveRequestSuccess'));
    },
    onError: (error) => toast.error(t('hrm:toasts.cancelLeaveRequestError'), extractErrorMessage(error)),
  });
}

// 22/09/2026: giai trinh cham cong - thay the du lieu gia lap bang localStorage truoc day. Mirror
// dung cac hook LeaveRequest o tren. approve() invalidate ca ['attendance'] vi duyet THANH CONG se
// ghi de checkInAt/checkOutAt that cua Attendance (xem AttendanceAdjustmentsService.decide()).
export function useMyAttendanceAdjustmentsQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['attendance-adjustments', 'me', params], queryFn: () => fetchMyAttendanceAdjustments(params) });
}

/** 403 (khong co PERMISSIONS.ATTENDANCE_ADJUSTMENT_VIEW) la ket qua BINH THUONG cho Employee - khong retry. */
export function usePendingAttendanceAdjustmentsQuery() {
  return useQuery({
    queryKey: ['attendance-adjustments', 'pending'],
    queryFn: () => fetchPendingAttendanceAdjustments({ limit: 100 }),
    retry: false,
  });
}

export function useCreateAttendanceAdjustment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: CreateAttendanceAdjustmentPayload) => createAttendanceAdjustment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-adjustments'] });
      toast.success(t('hrm:extensions.adjustment.successSubmit'));
    },
    onError: (error) => toast.error(t('hrm:extensions.adjustment.errorSubmit'), extractErrorMessage(error)),
  });
}

/** Dung boi AttendancePage.tsx de hien badge "Đã sửa công" cho quan ly (gate qua enabled: canViewAdjustments). */
export function useApprovedAttendanceAdjustmentsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['attendance-adjustments', 'approved'],
    queryFn: () => fetchApprovedAttendanceAdjustments(),
    retry: false,
    enabled: options?.enabled,
  });
}

export function useApproveAttendanceAdjustment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => approveAttendanceAdjustment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:extensions.adjustment.successApprove'));
    },
    onError: (error) => toast.error(t('hrm:extensions.adjustment.errorApprove'), extractErrorMessage(error)),
  });
}

export function useRejectAttendanceAdjustment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => rejectAttendanceAdjustment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-adjustments'] });
      toast.success(t('hrm:extensions.adjustment.successReject'));
    },
    onError: (error) => toast.error(t('hrm:extensions.adjustment.errorReject'), extractErrorMessage(error)),
  });
}

// 22/09/2026: dang ky tang ca (OT) - thay the du lieu gia lap bang localStorage truoc day. Mirror
// dung cac hook LeaveRequest/AttendanceAdjustment o tren.
export function useMyOvertimeRequestsQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['overtime-requests', 'me', params], queryFn: () => fetchMyOvertimeRequests(params) });
}

/** 403 (khong co PERMISSIONS.OVERTIME_REQUEST_VIEW) la ket qua BINH THUONG cho Employee - khong retry. */
export function usePendingOvertimeRequestsQuery() {
  return useQuery({
    queryKey: ['overtime-requests', 'pending'],
    queryFn: () => fetchPendingOvertimeRequests({ limit: 100 }),
    retry: false,
  });
}

export function useCreateOvertimeRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: CreateOvertimeRequestPayload) => createOvertimeRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime-requests'] });
      toast.success(t('hrm:extensions.overtime.successSubmit'));
    },
    onError: (error) => toast.error(t('hrm:extensions.overtime.errorSubmit'), extractErrorMessage(error)),
  });
}

export function useApproveOvertimeRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => approveOvertimeRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime-requests'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:extensions.overtime.successApprove'));
    },
    onError: (error) => toast.error(t('hrm:extensions.overtime.errorApprove'), extractErrorMessage(error)),
  });
}

export function useRejectOvertimeRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => rejectOvertimeRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime-requests'] });
      toast.success(t('hrm:extensions.overtime.successReject'));
    },
    onError: (error) => toast.error(t('hrm:extensions.overtime.errorReject'), extractErrorMessage(error)),
  });
}

// 03/10/2026: Lich cong ty - hook chuyen tu features/admin/hooks.ts (xem ghi chu tai
// createCalendarEvent() trong hrm/api.ts ve ly do chuyen). Giu nguyen logic invalidate/toast cu.
export function useCalendarEventsQuery(params: { startDate?: string; endDate?: string } = {}) {
  return useQuery({ queryKey: ['calendar-events', params], queryFn: () => fetchCalendarEvents(params) });
}

export function useCreateCalendarEvent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CalendarEventPayload) => createCalendarEvent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      // 04/11/2026: ngay le/ngay lam bu doi so ngay lam viec va bang cong.
      queryClient.invalidateQueries({ queryKey: ['work-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:toasts.calendarEventCreated'));
    },
    onError: (error) => toast.error(t('hrm:toasts.calendarEventCreateFailed'), extractErrorMessage(error)),
  });
}

export function useUpdateCalendarEvent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CalendarEventPayload> }) => updateCalendarEvent(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      // 04/11/2026: ngay le/ngay lam bu doi so ngay lam viec va bang cong.
      queryClient.invalidateQueries({ queryKey: ['work-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:toasts.calendarEventUpdated'));
    },
    onError: (error) => toast.error(t('hrm:toasts.calendarEventUpdateFailed'), extractErrorMessage(error)),
  });
}

export function useDeleteCalendarEvent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      // 04/11/2026: ngay le/ngay lam bu doi so ngay lam viec va bang cong.
      queryClient.invalidateQueries({ queryKey: ['work-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:toasts.calendarEventDeleted'));
    },
    onError: (error) => toast.error(t('hrm:toasts.calendarEventDeleteFailed'), extractErrorMessage(error)),
  });
}

// 04/11/2026: so ngay lam viec theo lich cong ty cho khoang ngay (form don nghi). Chi goi khi du 2 ngay
// hop le; loi khong chan form (giao dien lui ve dem thu 2-6).
export function useWorkingDaysQuery(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['work-calendar', 'working-days', startDate, endDate],
    queryFn: () => fetchWorkingDays(startDate, endDate),
    enabled: Boolean(startDate) && Boolean(endDate) && endDate >= startDate,
    retry: false,
  });
}

export function useWorkScheduleQuery(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ['work-calendar', 'schedule'], queryFn: () => fetchWorkSchedule(), enabled: options?.enabled });
}

export function useUpdateWorkSchedule() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: WorkSchedule) => updateWorkSchedule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success(t('hrm:workSchedule.saveSuccess'));
    },
    onError: (error) => toast.error(t('hrm:workSchedule.saveError'), extractErrorMessage(error)),
  });
}

// 04/11/2026: dieu chinh so du phep (ORG_MANAGE). Danh sach theo (userId, year); chi tai khi da chon nguoi.
export function useLeaveAdjustmentsQuery(userId: string, year: number) {
  return useQuery({
    queryKey: ['leave-requests', 'adjustments', userId, year],
    queryFn: () => fetchLeaveAdjustments(userId, year),
    enabled: Boolean(userId),
  });
}

export function useCreateLeaveAdjustment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: CreateLeaveAdjustmentPayload) => createLeaveAdjustment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success(t('hrm:leaveRequestsPage.balance.adjust.success'));
    },
    onError: (error) => toast.error(t('hrm:leaveRequestsPage.balance.adjust.error'), extractErrorMessage(error)),
  });
}

// 04/11/2026: bang cong thang do may chu tinh. 403 (khong co ATTENDANCE_VIEW) khong retry. keepPreviousData
// de doi thang khong lam trang nhap nhay trang.
export function useTimesheetQuery(month: string) {
  return useQuery({
    queryKey: ['timesheets', 'month', month],
    queryFn: () => fetchTimesheet(month),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useTimesheetUserQuery(userId: string, month: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['timesheets', 'user', userId, month],
    queryFn: () => fetchTimesheetUser(userId, month),
    enabled: (options?.enabled ?? true) && Boolean(userId),
    retry: false,
  });
}

export function useTimesheetExceptionsQuery(params: { month: string; type?: TimesheetExceptionType; page: number; limit: number }) {
  return useQuery({
    queryKey: ['timesheets', 'exceptions', params],
    queryFn: () => fetchTimesheetExceptions(params),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export function useUpsertTimesheetEntry() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: UpsertTimesheetEntryPayload) => upsertTimesheetEntry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:timesheetDetail.saveSuccess'));
    },
    onError: (error) => toast.error(t('hrm:timesheetDetail.saveError'), extractErrorMessage(error)),
  });
}

export function useDeleteTimesheetEntry() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ userId, workDate }: { userId: string; workDate: string }) => deleteTimesheetEntry(userId, workDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:timesheetDetail.removeSuccess'));
    },
    onError: (error) => toast.error(t('hrm:timesheetDetail.removeError'), extractErrorMessage(error)),
  });
}

/**
 * 04/11/2026: khoa ky cong. 409 TIMESHEET_PERIOD_HAS_PENDING la luong BINH THUONG (con don dang cho) - khong
 * toast loi o day, MonthlyTimesheetTable doc so don qua extractPendingConflict() roi hoi xac nhan `force`.
 */
export function useLockTimesheetPeriod() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ month, force }: { month: string; force?: boolean }) => lockTimesheetPeriod(month, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:timesheet.period.lockSuccess'));
    },
    onError: (error) => {
      if (extractPendingConflict(error)) return;
      toast.error(t('hrm:timesheet.period.lockError'), extractErrorMessage(error));
    },
  });
}

export function useUnlockTimesheetPeriod() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ month, reason }: { month: string; reason: string }) => unlockTimesheetPeriod(month, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(t('hrm:timesheet.period.unlockSuccess'));
    },
    onError: (error) => toast.error(t('hrm:timesheet.period.unlockError'), extractErrorMessage(error)),
  });
}
