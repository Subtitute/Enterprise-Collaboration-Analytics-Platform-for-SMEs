import { apiClient } from '@/lib/api-client';
import type { Attendance, LeaveRequest, LeaveRequestStatus, PaginatedResponse } from '@/types';

export async function checkIn(photo: Blob): Promise<Attendance> {
  const form = new FormData();
  form.append('photo', photo, 'checkin.jpg');
  const { data } = await apiClient.post<Attendance>('/attendance/check-in', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function checkOut(photo: Blob): Promise<Attendance> {
  const form = new FormData();
  form.append('photo', photo, 'checkout.jpg');
  const { data } = await apiClient.post<Attendance>('/attendance/check-out', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchMyAttendance(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<Attendance>> {
  const { data } = await apiClient.get<PaginatedResponse<Attendance>>('/attendance/me', { params });
  return data;
}

export async function getAttendancePhotoUrl(id: string, kind: 'checkin' | 'checkout'): Promise<string> {
  const { data } = await apiClient.get<{ url: string }>(`/attendance/${id}/photo`, { params: { kind } });
  return data.url;
}

export interface CreateLeaveRequestPayload {
  startDate: string;
  endDate: string;
  reason: string;
}

export async function createLeaveRequest(payload: CreateLeaveRequestPayload): Promise<LeaveRequest> {
  const { data } = await apiClient.post<LeaveRequest>('/leave-requests', payload);
  return data;
}

export async function fetchMyLeaveRequests(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<LeaveRequest>> {
  const { data } = await apiClient.get<PaginatedResponse<LeaveRequest>>('/leave-requests/me', { params });
  return data;
}

/**
 * Danh sach cho duyet toan to chuc - CHI Manager/Org Admin (PERMISSIONS.LEAVE_REQUEST_VIEW) goi
 * duoc, tra 403 voi Employee thuong. Component goi ham nay PHAI tu xu ly 403 nhu "khong ap dung
 * voi minh" (an muc duyet di) thay vi hien banner loi - xem LeaveRequestsPage.tsx.
 */
export async function fetchPendingLeaveRequests(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<LeaveRequest>> {
  const { data } = await apiClient.get<PaginatedResponse<LeaveRequest>>('/leave-requests', {
    params: { status: 'PENDING' as LeaveRequestStatus, ...params },
  });
  return data;
}

export async function approveLeaveRequest(id: string, decisionNote?: string): Promise<LeaveRequest> {
  const { data } = await apiClient.patch<LeaveRequest>(`/leave-requests/${id}/approve`, { decisionNote });
  return data;
}

export async function rejectLeaveRequest(id: string, decisionNote?: string): Promise<LeaveRequest> {
  const { data } = await apiClient.patch<LeaveRequest>(`/leave-requests/${id}/reject`, { decisionNote });
  return data;
}
