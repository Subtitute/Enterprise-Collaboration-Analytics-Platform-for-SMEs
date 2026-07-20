import { apiClient } from '@/lib/api-client';
import type { Department, PaginatedResponse, Permission, RoleWithPermissions, User } from '@/types';

export interface InviteUserPayload {
  email: string;
  fullName: string;
  initialPassword: string;
  departmentId?: string;
  roleIds?: string[];
}

export interface UpdateUserPayload {
  fullName?: string;
  departmentId?: string | null;
  roleIds?: string[];
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

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await apiClient.get<PaginatedResponse<Department> | Department[]>('/departments', { params: { limit: 200 } });
  return Array.isArray(data) ? data : data.data;
}

export async function createDepartment(payload: { name: string; description?: string }): Promise<Department> {
  const { data } = await apiClient.post<Department>('/departments', payload);
  return data;
}

export async function updateDepartment(id: string, payload: { name?: string; description?: string }): Promise<Department> {
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
