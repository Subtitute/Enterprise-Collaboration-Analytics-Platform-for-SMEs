import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  approveAttendanceAdjustment,
  approveLeaveRequest,
  approveOvertimeRequest,
  checkIn,
  checkOut,
  createAttendanceAdjustment,
  createLeaveRequest,
  createOvertimeRequest,
  fetchAllAttendance,
  fetchApprovedAttendanceAdjustments,
  fetchApprovedOvertimeRequests,
  fetchLeavePolicy,
  fetchMyAttendance,
  fetchMyAttendanceAdjustments,
  fetchMyLeaveBalance,
  fetchMyLeaveRequests,
  fetchMyOvertimeRequests,
  fetchPendingAttendanceAdjustments,
  fetchPendingLeaveRequests,
  fetchPendingOvertimeRequests,
  rejectAttendanceAdjustment,
  rejectLeaveRequest,
  rejectOvertimeRequest,
  updateLeavePolicy,
} from './api';
import type {
  CreateAttendanceAdjustmentPayload,
  CreateLeaveRequestPayload,
  CreateOvertimeRequestPayload,
  UpdateLeavePolicyPayload,
} from './api';
import type { CheckInLocation } from './components/CheckInCamera';

export function useMyAttendanceQuery(params: { page?: number; limit?: number } = {}) {
  return useQuery({ queryKey: ['attendance', 'me', params], queryFn: () => fetchMyAttendance(params) });
}

/** 403 (khong co PERMISSIONS.ATTENDANCE_VIEW) la ket qua BINH THUONG cho Employee - khong retry, mirror usePendingLeaveRequestsQuery(). */
export function useAllAttendanceQuery() {
  return useQuery({
    queryKey: ['attendance', 'all'],
    queryFn: () => fetchAllAttendance({ limit: 100 }),
    retry: false,
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

/** 403 la ket qua BINH THUONG cho Employee - dung boi AttendancePage.tsx de hien badge "Đã sửa công". */
export function useApprovedAttendanceAdjustmentsQuery() {
  return useQuery({
    queryKey: ['attendance-adjustments', 'approved'],
    queryFn: () => fetchApprovedAttendanceAdjustments(),
    retry: false,
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
