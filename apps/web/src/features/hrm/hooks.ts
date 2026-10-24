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
  createAttendanceAdjustment,
  createCalendarEvent,
  createLeaveRequest,
  createOvertimeRequest,
  deleteCalendarEvent,
  deleteFaceEnrollment,
  enrollFace,
  fetchAllAttendance,
  fetchApprovedAttendanceAdjustments,
  fetchApprovedLeaveRequests,
  fetchApprovedOvertimeRequests,
  fetchCalendarEvents,
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
  getFaceEnrollmentStatus,
  rejectAttendanceAdjustment,
  rejectLeaveRequest,
  rejectOvertimeRequest,
  updateCalendarEvent,
  updateLeavePolicy,
} from './api';
import type {
  CalendarEventPayload,
  CreateAttendanceAdjustmentPayload,
  CreateLeaveRequestPayload,
  CreateOvertimeRequestPayload,
  UpdateLeavePolicyPayload,
} from './api';
import type { CheckInLocation } from './components/CheckInCamera';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(t('hrm:toasts.checkInSuccess'));
    },
    onError: (error) => toast.error(t('hrm:toasts.checkInError'), extractErrorMessage(error)),
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ photo, location }: { photo: Blob; location?: CheckInLocation }) => checkOut(photo, location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(t('hrm:toasts.checkOutSuccess'));
    },
    onError: (error) => toast.error(t('hrm:toasts.checkOutError'), extractErrorMessage(error)),
  });
}

/** 24/10/2026: Face recognition - trang thai dang ky khuon mat CUA CHINH nguoi dang xem (ProfilePage.tsx). */
export function useFaceEnrollmentStatusQuery() {
  return useQuery({ queryKey: ['face-enrollment', 'me'], queryFn: getFaceEnrollmentStatus });
}

export function useEnrollFace() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (photo: Blob) => enrollFace(photo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['face-enrollment'] });
      toast.success(t('hrm:faceEnroll.toasts.enrollSuccess'));
    },
    onError: (error) => toast.error(t('hrm:faceEnroll.toasts.enrollError'), extractErrorMessage(error)),
  });
}

export function useDeleteFaceEnrollment() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: deleteFaceEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['face-enrollment'] });
      toast.success(t('hrm:faceEnroll.toasts.deleteSuccess'));
    },
    onError: (error) => toast.error(t('hrm:faceEnroll.toasts.deleteError'), extractErrorMessage(error)),
  });
}

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

/** 16/10/2026: Danh sach don nghi phep da duyet (APPROVED) toan to chuc - gate qua enabled de tranh 403 cho Employee. */
export function useApprovedLeaveRequestsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['leave-requests', 'approved'],
    queryFn: () => fetchApprovedLeaveRequests(),
    retry: false,
    enabled: options?.enabled,
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

/** 403 la ket qua BINH THUONG cho Employee - dung boi MonthlyTimesheetTable.tsx de tinh otHours that. */
export function useApprovedOvertimeRequestsQuery() {
  return useQuery({
    queryKey: ['overtime-requests', 'approved'],
    queryFn: () => fetchApprovedOvertimeRequests(),
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
      toast.success(t('hrm:toasts.calendarEventDeleted'));
    },
    onError: (error) => toast.error(t('hrm:toasts.calendarEventDeleteFailed'), extractErrorMessage(error)),
  });
}
