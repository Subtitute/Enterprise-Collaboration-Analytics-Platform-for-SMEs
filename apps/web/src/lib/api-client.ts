import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthSession } from '@/stores/auth.store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * withCredentials: true - bat buoc de trinh duyet gui/nhan httpOnly cookie refresh token
 * (`ecap_refresh_token`, set boi IAM Service qua Gateway) - Technical_Spec.md muc 6, muc 9
 * (bo sung 21/07/2026). Gateway phai cau hinh CORS voi origin cu the (khong wildcard) +
 * credentials: true de dieu nay hoat dong (xem apps/gateway/src/main.ts).
 */
/** Client dung cho moi request nghiep vu - co interceptor gan token + tu dong refresh khi 401. */
export const apiClient = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

/** Client "tran" (khong interceptor) danh rieng cho cac endpoint /auth/* de tranh vong lap refresh. */
export const authClient = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

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

/**
 * Goi /auth/refresh KHONG kem body - refresh token khong con duoc luu o phia client (localStorage
 * hay memory), trinh duyet tu dong gui kem qua httpOnly cookie nho withCredentials: true o tren
 * (Technical_Spec.md muc 6, bo sung 21/07/2026: refresh token chuyen tu JSON body sang httpOnly cookie).
 */
async function refreshAccessToken(): Promise<string | null> {
  const { setSession, clearSession } = useAuthStore.getState();
  try {
    const { data } = await authClient.post<AuthSession>('/auth/refresh');
    setSession(data);
    return data.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

/**
 * Silent-refresh dung luc ung dung khoi dong (xem App.tsx) - cung mot co che voi interceptor
 * 401 o duoi day, tach rieng thanh ham export de App.tsx khong can tu goi authClient truc tiep.
 */
export function silentRefresh(): Promise<string | null> {
  return refreshAccessToken();
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
