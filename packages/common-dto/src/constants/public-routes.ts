/**
 * Danh sach route public tren API Gateway - khong yeu cau Authorization header.
 * Nguon: Technical_Spec.md muc 6 (AuthN/AuthZ) - dang ky to chuc/dang nhap/refresh
 * xay ra TRUOC khi client co JWT nen Gateway phai bo qua buoc verify voi cac route nay.
 */
export const PUBLIC_GATEWAY_ROUTES: string[] = [
  '/api/v1/auth/register-organization',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/health',
];
