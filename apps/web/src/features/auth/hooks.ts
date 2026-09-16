import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { disconnectAnalyticsSocket, disconnectNotificationSocket } from '@/lib/socket';
import { extractErrorMessage } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { toast } from '@/stores/toast.store';
import { forgotPassword, login, logout as logoutApi, registerOrganization, resetPassword } from './api';
import type { ForgotPasswordPayload, LoginPayload, RegisterOrganizationPayload, ResetPasswordPayload } from './api';

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
      // 16/09/2026: "Super Admin" (tinh nang moi) - khong thuoc to chuc nghiep vu nao, dieu huong
      // thang ve khu vuc rieng /platform-admin, bo qua hoan toan logic "trang redirect"/dashboard
      // ben duoi (danh cho nguoi dung thuong thuoc 1 to chuc that).
      if (data.user.isSuperAdmin) {
        navigate('/platform-admin', { replace: true });
        return;
      }
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

/**
 * 15/09/2026: "Quen mat khau" (phan hoi GVHD, muc 4) - forgotPassword() BACKEND luon tra ve thanh
 * cong chung chung (chong do email, xem chu thich AuthService.forgotPassword()) nen o day KHONG
 * co nhanh loi "nghiep vu" nao de hien thi - chi con loi MANG/HA TANG that su (vd Gateway sap,
 * mat ket noi) can bao cho nguoi dung, dung extractErrorMessage() nhu moi mutation khac.
 */
export function useForgotPassword() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => forgotPassword(payload),
    onError: (error) => {
      toast.error(t('auth:hooks.forgotPassword.errorTitle'), extractErrorMessage(error));
    },
  });
}

export function useResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
    onSuccess: () => {
      toast.success(t('auth:hooks.resetPassword.successTitle'), t('auth:hooks.resetPassword.successDescription'));
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      toast.error(t('auth:hooks.resetPassword.errorTitle'), extractErrorMessage(error, t('auth:hooks.resetPassword.errorFallback')));
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
