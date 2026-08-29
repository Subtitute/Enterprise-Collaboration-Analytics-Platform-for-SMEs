import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { disconnectAnalyticsSocket, disconnectNotificationSocket } from '@/lib/socket';
import { extractErrorMessage } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/stores/toast.store';
import { login, logout as logoutApi, registerOrganization } from './api';
import type { LoginPayload, RegisterOrganizationPayload } from './api';

// 20/08/2026: sua loi bao mat thuc te (phat hien qua kiem thu da to chuc trong CUNG 1 tab trinh
// duyet) - `queryClient` la 1 THE DUY NHAT song suot phien lam viec cua tab (khoi tao 1 lan o
// main.tsx), cac query "lay toan bo 1 lan" (users/projects/tasks/folders...) dung chung 1 query
// key KHONG gan organizationId (vd ['users','all']) va co staleTime vai chuc giay/vai phut. Truoc
// ban sua nay, dang nhap/dang ky/dang xuat chi doi Zustand auth store (setSession/clearSession),
// KHONG dong cham gi toi queryClient - nen neu 1 nguoi dang nhap to chuc A trong tab, roi dang
// xuat va dang nhap/dang ky to chuc B trong CUNG tab do, cac trang doc du lieu qua React Query
// (thanh vien, tim kiem tong hop o Topbar, du an, cong viec, thu muc...) hien NGAY du lieu CU cua
// to chuc A tu cache (chua het han, khong bi coi la loi thoi) truoc khi kip goi lai API that -
// ro ri du lieu xuyen to chuc ngay tren giao dien, du API backend van loc dung organizationId khi
// goi that su. Goi queryClient.clear() o CA 3 diem chuyen doi phien (dang nhap/dang ky/dang xuat)
// xoa SACH toan bo cache, dam bao khong con du lieu cua phien truoc song sot sang phien sau.
export function useLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (data) => {
      queryClient.clear();
      setSession(data);
      // Neu co trang redirect tu state cua window.history thi dieu huong ve do, mac dinh ve /dashboard
      const from = (window.history.state?.usr as { from?: { pathname: string; search?: string } })?.from;
      const redirectTarget = from ? `${from.pathname}${from.search || ''}` : '/dashboard';
      navigate(redirectTarget, { replace: true });
    },
    onError: (error) => {
      toast.error(t('auth:hooks.login.errorTitle'), extractErrorMessage(error, t('auth:hooks.login.errorFallback')));
    },
  });
}

export function useRegisterOrganization() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: RegisterOrganizationPayload) => registerOrganization(payload),
    onSuccess: (data) => {
      queryClient.clear();
      const userWithOrg = {
        ...data.user,
        organizationName: data.organization?.name || undefined,
      };
      setSession({
        accessToken: data.accessToken,
        user: userWithOrg,
      });
      toast.success(t('auth:hooks.register.successTitle'), t('auth:hooks.register.successDescription', { fullName: data.user.fullName }));
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      toast.error(t('auth:hooks.register.errorTitle'), extractErrorMessage(error));
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return useMutation({
    mutationFn: async () => {
      // 25/07/2026: logoutApi() khong con nhan tham so - backend doc refresh token that tu httpOnly
      // cookie, gia tri "refreshToken" o day chi la co (flag) client-side (xem auth.store.ts) nen
      // van giu dieu kien if() de tranh goi API dang xuat khi ro rang chua co phien dang nhap nao.
      if (refreshToken) {
        await logoutApi().catch(() => undefined);
      }
    },
    onSettled: () => {
      queryClient.clear();
      clearSession();
      disconnectNotificationSocket();
      disconnectAnalyticsSocket();
      navigate('/login', { replace: true });
    },
  });
}
