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
  // 25/07/2026: xoa truong refreshToken (khong con duoc backend tra ve trong body tu khi refresh
  // token chuyen sang httpOnly cookie - xem AuthSession trong stores/auth.store.ts, da khong con
  // truong nay tu 21/07/2026). Xac nhan qua grep: khong con noi nao trong src doc AuthResponse
  // .refreshToken ca - day la truong con sot lai tu truoc khi migrate sang httpOnly cookie.
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

// 25/07/2026: xoa ham refreshSession(refreshToken) - day la ham chet tu truoc khi migrate refresh
// token sang httpOnly cookie, xac nhan qua grep khong con call site nao. Luong refresh session
// THAT SU dang dung la refreshAccessToken() trong lib/api-client.ts, goi authClient.post
// ('/auth/refresh') KHONG kem body (trinh duyet tu gui kem cookie ecap_refresh_token).

// 25/07/2026: bo tham so refreshToken (khong con y nghia - server doc token that tu httpOnly
// cookie, moi gia tri client gui trong body deu bi bo qua). Cap nhat call site duy nhat trong
// features/auth/hooks.ts (useLogout) theo cho khop chu ky moi.
export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

// 15/09/2026: "Quen mat khau" (phan hoi GVHD, muc 4) - dung authClient (khong interceptor gan
// Authorization), giong login()/registerOrganization() o tren: day la 2 endpoint CONG KHAI, chua
// dang nhap nen khong co accessToken de gan vao header.
export async function forgotPassword(payload: ForgotPasswordPayload): Promise<{ success: true }> {
  const { data } = await authClient.post<{ success: true }>('/auth/forgot-password', payload);
  return data;
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ success: true }> {
  const { data } = await authClient.post<{ success: true }>('/auth/reset-password', payload);
  return data;
}
