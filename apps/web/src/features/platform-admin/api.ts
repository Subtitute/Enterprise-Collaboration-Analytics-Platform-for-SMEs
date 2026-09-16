import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse, PlatformOrganization, PlatformStats } from '@/types';

// 16/09/2026: "Super Admin" (tinh nang moi) - dung apiClient thuong (co interceptor gan
// Authorization + tu refresh khi 401), khac authClient dung cho /auth/* - day la endpoint DA dang
// nhap, gate bang SuperAdminGuard o backend (khong phai @Public()).
export async function fetchPlatformOrganizations(
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedResponse<PlatformOrganization>> {
  const { data } = await apiClient.get<PaginatedResponse<PlatformOrganization>>('/platform-admin/organizations', { params });
  return data;
}

export async function deactivatePlatformOrganization(id: string): Promise<PlatformOrganization> {
  const { data } = await apiClient.patch<PlatformOrganization>(`/platform-admin/organizations/${id}/deactivate`);
  return data;
}

export async function reactivatePlatformOrganization(id: string): Promise<PlatformOrganization> {
  const { data } = await apiClient.patch<PlatformOrganization>(`/platform-admin/organizations/${id}/reactivate`);
  return data;
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const { data } = await apiClient.get<PlatformStats>('/platform-admin/stats');
  return data;
}
