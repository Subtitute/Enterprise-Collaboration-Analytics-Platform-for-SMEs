import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { disconnectAnalyticsSocket, disconnectNotificationSocket } from '@/lib/socket';
import { extractErrorMessage } from '@/lib/api-client';
import { toast } from '@/stores/toast.store';
import { login, logout as logoutApi, registerOrganization } from './api';
import type { LoginPayload, RegisterOrganizationPayload } from './api';

export function useLogin() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (data) => {
      setSession(data);
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      toast.error('Đăng nhập thất bại', extractErrorMessage(error, 'Email hoặc mật khẩu không đúng.'));
    },
  });
}

export function useRegisterOrganization() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (payload: RegisterOrganizationPayload) => registerOrganization(payload),
    onSuccess: (data) => {
      setSession(data);
      toast.success('Tạo tổ chức thành công', `Chào mừng ${data.user.fullName} đến với ECAP for SMEs.`);
      navigate('/dashboard', { replace: true });
    },
    onError: (error) => {
      toast.error('Không thể tạo tổ chức', extractErrorMessage(error));
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await logoutApi(refreshToken).catch(() => undefined);
      }
    },
    onSettled: () => {
      clearSession();
      disconnectNotificationSocket();
      disconnectAnalyticsSocket();
      navigate('/login', { replace: true });
    },
  });
}
