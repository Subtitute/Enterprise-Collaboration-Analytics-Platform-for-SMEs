import { apiClient, authClient } from '@/lib/api-client';
import type { AuthUser, Organization } from '@/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterOrganizationPayload {
  organizationName: string;
  taxCode?: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RegisterOrganizationResponse extends AuthResponse {
  organization: Organization;
}

// Dung authClient (khong interceptor) cho cac endpoint /auth/* de tranh vong lap voi logic refresh.
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await authClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function registerOrganization(payload: RegisterOrganizationPayload): Promise<RegisterOrganizationResponse> {
  const { data } = await authClient.post<RegisterOrganizationResponse>('/auth/register-organization', payload);
  return data;
}

export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  const { data } = await authClient.post<AuthResponse>('/auth/refresh', { refreshToken });
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken });
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}
