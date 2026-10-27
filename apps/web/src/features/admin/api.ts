import { apiClient } from '@/lib/api-client';
import type { Department, FailedEvent, PaginatedResponse, Permission, RoleWithPermissions, User } from '@/types';

// 26/10/2026: mat khau tuy chon (de trong -> email kich hoat), them so dien thoai/ma nhan vien
// (Technical_Spec.md muc 27.6/27.9).
export interface InviteUserPayload {
  email: string;
  fullName: string;
  initialPassword?: string;
  departmentId?: string;
  roleIds?: string[];
  phoneNumber?: string;
  employeeCode?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  departmentId?: string | null;
  roleIds?: string[];
  phoneNumber?: string | null;
  employeeCode?: string | null;
}

export interface DirectoryParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

/** 26/10/2026: Danh sach nhan vien (ho so day du, theo pham vi Org Admin/Manager - muc 27.6). */
export async function fetchDirectory(params: DirectoryParams): Promise<PaginatedResponse<User>> {
  const { data } = await apiClient.get<PaginatedResponse<User>>('/users/directory', { params });
  return data;
}

/** 26/10/2026: lay TOAN BO danh sach trong pham vi (trinh nhap Excel phan loai Moi/Cap nhat/Ngoai pham vi). */
export async function fetchWholeDirectory(): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await fetchDirectory({ page, limit: 500 });
    all.push(...res.data);
    if (all.length >= res.meta.total || res.data.length === 0) break;
  }
  return all;
}

export async function fetchUsers(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<User>> {
  const { data } = await apiClient.get<PaginatedResponse<User>>('/users', { params });
  return data;
}

export async function inviteUser(payload: InviteUserPayload): Promise<User> {
  const { data } = await apiClient.post<User>('/users/invite', payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  const { data } = await apiClient.patch<User>(`/users/${id}`, payload);
  return data;
}

export async function deactivateUser(id: string): Promise<void> {
  await apiClient.patch(`/users/${id}/deactivate`);
}

// 22/07/2026 (review toan du an): backend bo sung PATCH /users/:id/reactivate (fix loi Major -
// truoc do 1 tai khoan bi vo hieu hoa khong co duong nao quay lai qua API, ke ca do bam nham),
// nhung FE chua co cach nao goi toi - thieu ham nay thi fix backend khong the su dung duoc tu
// giao dien. Bo sung de khep kin luong Quan tri > Thanh vien.
export async function reactivateUser(id: string): Promise<void> {
  await apiClient.patch(`/users/${id}/reactivate`);
}

// 25/09/2026: xoa vinh vien - chi cho phep voi tai khoan da vo hieu hoa (backend tu kiem tra, xem
// UsersService.remove()) - dung de don du lieu rac (vd tai khoan E2E test tao ra) khoi Quan tri >
// Thanh vien/Cham cong vinh vien, thay vi chi an duoi trang thai "Da vo hieu hoa" mai mai.
export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await apiClient.get<PaginatedResponse<Department> | Department[]>('/departments', { params: { limit: 200 } });
  return Array.isArray(data) ? data : data.data;
}

// 17/09/2026: bo sung managerId?: string | null (Department.managerId that tu backend, xem
// apps/iam-service/src/entities/department.entity.ts) - CreateDepartmentDto/UpdateDepartmentDto
// da validate gia tri nay thuoc ve nguoi trong to chuc (backend). `null` = go bo truong phong ban.
export async function createDepartment(payload: { name: string; description?: string; managerId?: string | null }): Promise<Department> {
  const { data } = await apiClient.post<Department>('/departments', payload);
  return data;
}

export async function updateDepartment(
  id: string,
  payload: { name?: string; description?: string; managerId?: string | null },
): Promise<Department> {
  const { data } = await apiClient.patch<Department>(`/departments/${id}`, payload);
  return data;
}

export async function deleteDepartment(id: string): Promise<void> {
  await apiClient.delete(`/departments/${id}`);
}

// Gia dinh: GET /roles tra ve moi role kem san permissionKeys hien tai cua no (khong co endpoint
// rieng "GET /roles/:id/permissions" trong contract), phuc vu truc tiep cho ma tran quyen.
export async function fetchRoles(): Promise<RoleWithPermissions[]> {
  const { data } = await apiClient.get<RoleWithPermissions[] | PaginatedResponse<RoleWithPermissions>>('/roles');
  return Array.isArray(data) ? data : data.data;
}

export async function fetchPermissions(): Promise<Permission[]> {
  const { data } = await apiClient.get<Permission[] | PaginatedResponse<Permission>>('/roles/permissions');
  return Array.isArray(data) ? data : data.data;
}

export async function updateRolePermissions(roleId: string, permissionKeys: string[]): Promise<RoleWithPermissions> {
  const { data } = await apiClient.patch<RoleWithPermissions>(`/roles/${roleId}/permissions`, { permissionKeys });
  return data;
}

// 28/07/2026: GET /failed-events (Dead Letter Queue) - danh sach chi doc cac su kien xu ly noi
// bo (Kafka) that bai vinh vien/het luot thu lai, phuc vu man hinh chan doan cho Org Admin
// (features/admin/FailedEventsPage.tsx). Theo dung quy uoc phan trang chung cua ca du an
// (xem fetchUsers o tren).
export async function fetchFailedEvents(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<FailedEvent>> {
  const { data } = await apiClient.get<PaginatedResponse<FailedEvent>>('/failed-events', { params });
  return data;
}

// 03/10/2026: Lich cong ty (CRUD ngay le/su kien) chuyen sang features/hrm/api.ts - tinh nang nay
// gio mo cho MOI thanh vien to chuc xem/tao EVENT (khong con rieng khu vuc Quan tri), xem
// CompanyCalendar.tsx.
