/**
 * Danh sach route public tren API Gateway - khong yeu cau Authorization header.
 * Nguon: Technical_Spec.md muc 6 (AuthN/AuthZ) - dang ky to chuc/dang nhap/refresh
 * xay ra TRUOC khi client co JWT nen Gateway phai bo qua buoc verify voi cac route nay.
 */
export const PUBLIC_GATEWAY_ROUTES: string[] = [
  '/api/v1/auth/register-organization',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  // 22/07/2026 (review toan du an): logout dung refresh token (cookie httpOnly) lam credential
  // that su cua no, KHONG phai access token - truoc ban sua nay endpoint khong nam trong danh
  // sach public nen Gateway doi hoi 1 access token con hop le truoc khi cho proxy toi IAM, dung
  // luc nguoi dung RAT CO KHA NANG muon dang xuat la khi access token (15 phut) da het han, gay
  // 401 ngay tai Gateway va refresh token/DB row khong bao gio bi thu hoi qua duong nay.
  '/api/v1/auth/logout',
  '/api/v1/health',
  // 04/08/2026: endpoint /metrics de Prometheus scrape (Technical_Spec.md muc 15) - Prometheus
  // khong co JWT nen phai nam trong danh sach public giong /health.
  '/api/v1/metrics',
];
