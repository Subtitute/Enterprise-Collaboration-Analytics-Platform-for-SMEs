import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/stores/toast.store';
import { extractErrorMessage } from '@/lib/api-client';
import {
  approveLeaveRequest,
  checkIn,
  checkOut,
  createLeaveRequest,
  fetchAllAttendance,
  fetchMyAttendance,
  fetchMyLeaveRequests,
  fetchPendingLeaveRequests,
  rejectLeaveRequest,
} from './api';
import type { CreateLeaveRequestPayload } from './api';
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
