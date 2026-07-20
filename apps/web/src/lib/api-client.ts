import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthSession } from '@/stores/auth.store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/** Client dung cho moi request nghiep vu - co interceptor gan token + tu dong refresh khi 401. */
export const apiClient = axios.create({ baseURL: API_BASE_URL });

/** Client "tran" (khong interceptor) danh rieng cho cac endpoint /auth/* de tranh vong lap refresh. */
export const authClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Nhieu request co the 401 gan nhu dong thoi (vd nhieu query chay song song luc vao trang) -
// dedupe lai thanh MOT lan goi /auth/refresh duy nhat, cac request con lai "an theo" ket qua.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await authClient.post<AuthSession>('/auth/refresh', { refreshToken });
    setSession(data);
    return data.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }

      redirectToLogin();
    }

    return Promise.reject(error);
  },
);

/** Trich xuat thong diep loi tu response API (Technical_Spec.md muc 7: { message, ... }). */
export function extractErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    if (error.message) return error.message;
  }
  return fallback;
}
