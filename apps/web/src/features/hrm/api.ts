import { apiClient } from '@/lib/api-client';
import type {
  Attendance,
  AttendanceAdjustment,
  CalendarEvent,
  CalendarEventType,
  LeaveRequest,
  LeaveRequestStatus,
  OvertimeMultiplierType,
  OvertimeRequest,
  PaginatedResponse,
} from '@/types';
import type { CheckInLocation } from './components/CheckInCamera';

/** 13/08/2026: `location` la tuy chon - khong gui field neu khong co (xem CheckInCamera.tsx). */
function appendLocation(form: FormData, location?: CheckInLocation) {
  if (!location) return;
  form.append('latitude', String(location.latitude));
  form.append('longitude', String(location.longitude));
}

export async function checkIn(photo: Blob, location?: CheckInLocation): Promise<Attendance> {
  const form = new FormData();
  form.append('photo', photo, 'checkin.jpg');
  appendLocation(form, location);
  const { data } = await apiClient.post<Attendance>('/attendance/check-in', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function checkOut(photo: Blob, location?: CheckInLocation): Promise<Attendance> {
  const form = new FormData();
  form.append('photo', photo, 'checkout.jpg');
  appendLocation(form, location);
  const { data } = await apiClient.post<Attendance>('/attendance/check-out', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchMyAttendance(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<Attendance>> {
  const { data } = await apiClient.get<PaginatedResponse<Attendance>>('/attendance/me', { params });
  return data;
}

/**
 * Danh sach cham cong TOAN TO CHUC - CHI Manager/Org Admin (PERMISSIONS.ATTENDANCE_VIEW) goi
 * duoc, tra 403 voi Employee thuong - component goi ham nay PHAI tu xu ly 403 nhu "khong ap
 * dung" (mirror fetchPendingLeaveRequests() o duoi, xem AttendancePage.tsx).
 *
 * 03/10/2026: bo sung `userId` (tuy chon) - loc cham cong cua DUY NHAT 1 nhan vien, dung boi
 * useEmployeeAttendanceQuery() (AttendanceDetailPage.tsx) thay vi phai them 1 ham fetch rieng -
 * backend (AttendanceQueryDto, apps/hrm-service) da ho tro san tham so nay.
 *
 * 03/10/2026 (tiep): bo sung `startDate`/`endDate` - phat hien qua rieng soat: ban cu luon goi
 * `limit:100` roi loc thang client-side (xem useAllAttendanceQuery()), nen 1 to chuc vuot qua 100
 * dong cham cong tong co the khien chon 1 thang CU hien sai thanh "khong co du lieu" (du lieu that
 * su bi "day" ra khoi 100 dong dau, luon la cac dong MOI nhat). Backend da ho tro loc khoang ngay
 * (mirror calendar-events) - truyen dung khoang thang dang xem de server loc tai nguon.
 */
export async function fetchAllAttendance(
  params: { page?: number; limit?: number; userId?: string; startDate?: string; endDate?: string } = {},
): Promise<PaginatedResponse<Attendance>> {
  const { data } = await apiClient.get<PaginatedResponse<Attendance>>('/attendance', { params });
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

export async function fetchApprovedLeaveRequests(params: { page?: number; limit?: number } = {}): Promise<LeaveRequest[]> {
  const { data } = await apiClient.get<PaginatedResponse<LeaveRequest>>('/leave-requests', {
    params: { status: 'APPROVED' as LeaveRequestStatus, limit: 500, ...params },
  });
  return data.data;
}

/**
 * 03/10/2026: lich su nghi phep DAY DU (khong loc status) cua DUY NHAT 1 nhan vien - CHI
 * Manager/Org Admin (PERMISSIONS.LEAVE_REQUEST_VIEW) goi duoc, dung boi
 * useEmployeeLeaveRequestsQuery() (LeaveRequestDetailPage.tsx). Cung endpoint GET /leave-requests
 * voi fetchPendingLeaveRequests() o tren (LeaveRequestQueryDto da ho tro san tham so `userId`,
 * mirror dung co che `userId` cua fetchAllAttendance() o tren).
 */
export async function fetchLeaveRequestsForUser(userId: string, params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<LeaveRequest>> {
  const { data } = await apiClient.get<PaginatedResponse<LeaveRequest>>('/leave-requests', {
    params: { userId, ...params },
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

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  const { data } = await apiClient.patch<LeaveRequest>(`/leave-requests/${id}/cancel`);
  return data;
}

// 22/09/2026: so du phep theo Luat LD VN (HRM-lite mo rong, theo de xuat cua Tien). `entitledDays`/
// `remainingDays` CO Y KHONG co trong response nay - xem chu thich chi tiet tai
// LeaveRequestsService.getMyBalance() (apps/hrm-service): can User.createdAt (ngay vao lam, song o
// database rieng cua IAM Service) de tinh thuong nien, frontend tu ghep not qua useOrgUsersQuery()
// da co san (xem LeaveRequestsPage.tsx).
export interface LeaveBalance {
  year: number;
  usedDays: number;
  baseDaysPerYear: number;
  seniorityYearsPerBonusDay: number;
}

export async function fetchMyLeaveBalance(): Promise<LeaveBalance> {
  const { data } = await apiClient.get<LeaveBalance>('/leave-requests/me/balance');
  return data;
}

export interface LeavePolicy {
  id: string;
  organizationId: string;
  baseDaysPerYear: number;
  seniorityYearsPerBonusDay: number;
}

export interface UpdateLeavePolicyPayload {
  baseDaysPerYear?: number;
  seniorityYearsPerBonusDay?: number;
}

/** Khong yeu cau permission dac biet de XEM (moi nhan vien can biet chinh sach) - chi PATCH moi can PERMISSIONS.ORG_MANAGE. */
export async function fetchLeavePolicy(): Promise<LeavePolicy> {
  const { data } = await apiClient.get<LeavePolicy>('/leave-policy');
  return data;
}

export async function updateLeavePolicy(payload: UpdateLeavePolicyPayload): Promise<LeavePolicy> {
  const { data } = await apiClient.patch<LeavePolicy>('/leave-policy', payload);
  return data;
}

// 22/09/2026: giai trinh cham cong - thay the du lieu gia lap bang localStorage truoc day (xem
// attendance-adjustments.controller.ts, apps/hrm-service). Mirror dung cac ham LeaveRequest o tren.
export interface CreateAttendanceAdjustmentPayload {
  attendanceId: string;
  proposedCheckInAt: string;
  proposedCheckOutAt: string;
  reason: string;
}

export async function createAttendanceAdjustment(payload: CreateAttendanceAdjustmentPayload): Promise<AttendanceAdjustment> {
  const { data } = await apiClient.post<AttendanceAdjustment>('/attendance-adjustments', payload);
  return data;
}

export async function fetchMyAttendanceAdjustments(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<AttendanceAdjustment>> {
  const { data } = await apiClient.get<PaginatedResponse<AttendanceAdjustment>>('/attendance-adjustments/me', { params });
  return data;
}

/** Danh sach cho duyet toan to chuc - CHI Manager/Org Admin (PERMISSIONS.ATTENDANCE_ADJUSTMENT_VIEW) goi duoc. */
export async function fetchPendingAttendanceAdjustments(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<AttendanceAdjustment>> {
  const { data } = await apiClient.get<PaginatedResponse<AttendanceAdjustment>>('/attendance-adjustments', {
    params: { status: 'PENDING', ...params },
  });
  return data;
}

/** 22/09/2026: danh sach giai trinh DA DUYET toan to chuc, khong loc thang (to chuc quy mo nho) -
 *  dung de hien badge "Đã sửa công" tren bang cham cong (xem AttendanceStatusBadge, AttendancePage.tsx). */
export async function fetchApprovedAttendanceAdjustments(): Promise<AttendanceAdjustment[]> {
  const { data } = await apiClient.get<PaginatedResponse<AttendanceAdjustment>>('/attendance-adjustments', {
    params: { status: 'APPROVED', limit: 500 },
  });
  return data.data;
}

export async function approveAttendanceAdjustment(id: string, decisionNote?: string): Promise<AttendanceAdjustment> {
  const { data } = await apiClient.patch<AttendanceAdjustment>(`/attendance-adjustments/${id}/approve`, { decisionNote });
  return data;
}

export async function rejectAttendanceAdjustment(id: string, decisionNote?: string): Promise<AttendanceAdjustment> {
  const { data } = await apiClient.patch<AttendanceAdjustment>(`/attendance-adjustments/${id}/reject`, { decisionNote });
  return data;
}

// 22/09/2026: dang ky tang ca (OT) - thay the du lieu gia lap bang localStorage truoc day (xem
// overtime-requests.controller.ts, apps/hrm-service). Mirror dung cac ham LeaveRequest o tren.
export interface CreateOvertimeRequestPayload {
  workDate: string;
  otStart: string;
  otEnd: string;
  multiplierType: OvertimeMultiplierType;
  reason: string;
}

export async function createOvertimeRequest(payload: CreateOvertimeRequestPayload): Promise<OvertimeRequest> {
  const { data } = await apiClient.post<OvertimeRequest>('/overtime-requests', payload);
  return data;
}

export async function fetchMyOvertimeRequests(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<OvertimeRequest>> {
  const { data } = await apiClient.get<PaginatedResponse<OvertimeRequest>>('/overtime-requests/me', { params });
  return data;
}

/** Danh sach cho duyet toan to chuc - CHI Manager/Org Admin (PERMISSIONS.OVERTIME_REQUEST_VIEW) goi duoc. */
export async function fetchPendingOvertimeRequests(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<OvertimeRequest>> {
  const { data } = await apiClient.get<PaginatedResponse<OvertimeRequest>>('/overtime-requests', {
    params: { status: 'PENDING', ...params },
  });
  return data;
}

/** 22/09/2026: danh sach OT DA DUYET toan to chuc, khong loc thang (to chuc quy mo nho - xem
 *  MonthlyTimesheetTable.tsx) - dung de tinh otHours THAT cho bang cong thang, thay heuristic
 *  doan "checkout sau 17:30" truoc day. */
export async function fetchApprovedOvertimeRequests(): Promise<OvertimeRequest[]> {
  const { data } = await apiClient.get<PaginatedResponse<OvertimeRequest>>('/overtime-requests', {
    params: { status: 'APPROVED', limit: 500 },
  });
  return data.data;
}

export async function approveOvertimeRequest(id: string, decisionNote?: string): Promise<OvertimeRequest> {
  const { data } = await apiClient.patch<OvertimeRequest>(`/overtime-requests/${id}/approve`, { decisionNote });
  return data;
}

export async function rejectOvertimeRequest(id: string, decisionNote?: string): Promise<OvertimeRequest> {
  const { data } = await apiClient.patch<OvertimeRequest>(`/overtime-requests/${id}/reject`, { decisionNote });
  return data;
}

export interface CalendarEventPayload {
  title: string;
  description?: string;
  type: CalendarEventType;
  startDate: string;
  endDate?: string;
}

// 03/10/2026: Lich cong ty - chuyen tu features/admin/{api,hooks}.ts sang day cung voi
// CompanyCalendar.tsx/CalendarEventModal.tsx (features/hrm/components/) - tinh nang nay gio mo cho
// MOI thanh vien to chuc xem, khong con rieng khu vuc Quan tri. GET khong phan trang - xem chu
// thich tai CalendarEventQueryDto (hrm-service) - tra ve TOAN BO muc lich chong lan voi khoang
// [startDate, endDate] dang xem. Quyen thuc su (xem/tao EVENT cho moi nguoi, tao HOLIDAY/sua/xoa
// can CALENDAR_MANAGE hoac la nguoi tao) do backend thuc thi - xem CompanyCalendar.tsx ve cach FE
// chi an/hien UI tuong ung.
export async function fetchCalendarEvents(params: { startDate?: string; endDate?: string } = {}): Promise<CalendarEvent[]> {
  const { data } = await apiClient.get<CalendarEvent[]>('/calendar-events', { params });
  return data;
}

export async function createCalendarEvent(payload: CalendarEventPayload): Promise<CalendarEvent> {
  const { data } = await apiClient.post<CalendarEvent>('/calendar-events', payload);
  return data;
}

export async function updateCalendarEvent(id: string, payload: Partial<CalendarEventPayload>): Promise<CalendarEvent> {
  const { data } = await apiClient.patch<CalendarEvent>(`/calendar-events/${id}`, payload);
  return data;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiClient.delete(`/calendar-events/${id}`);
}
