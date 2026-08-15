import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  return useMutation({
    mutationFn: ({ photo, location }: { photo: Blob; location?: CheckInLocation }) => checkIn(photo, location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Đã chấm công vào làm');
    },
    onError: (error) => toast.error('Không thể chấm công vào làm', extractErrorMessage(error)),
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photo, location }: { photo: Blob; location?: CheckInLocation }) => checkOut(photo, location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Đã chấm công ra về');
    },
    onError: (error) => toast.error('Không thể chấm công ra về', extractErrorMessage(error)),
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
  return useMutation({
    mutationFn: (payload: CreateLeaveRequestPayload) => createLeaveRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Đã gửi yêu cầu nghỉ phép');
    },
    onError: (error) => toast.error('Không thể gửi yêu cầu nghỉ phép', extractErrorMessage(error)),
  });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approveLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Đã duyệt yêu cầu nghỉ phép');
    },
    onError: (error) => toast.error('Không thể duyệt yêu cầu', extractErrorMessage(error)),
  });
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rejectLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Đã từ chối yêu cầu nghỉ phép');
    },
    onError: (error) => toast.error('Không thể từ chối yêu cầu', extractErrorMessage(error)),
  });
}
