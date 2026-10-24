import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthSession } from '@/stores/auth.store';
import i18n from '@/i18n';

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

interface ErrorResponseData {
  message?: string | string[];
  errorCode?: string;
  errorParams?: Record<string, string | number>;
  details?: { code: string; params?: Record<string, string | number> }[];
  // 24/10/2026: apps/ml-service (FastAPI/Python) tra ve loi dang `{ detail: string }`, KHAC han
  // dinh dang `{ message, errorCode, ... }` cua moi service Node (Technical_Spec.md muc 7) - phat
  // hien qua kiem thu song tinh nang Face recognition (lan dau co 1 luong tu-phuc-vu thuong xuyen
  // goi toi ml-service, truoc day chi co /ml/anomalies, it ai cham toi loi nghiep vu cua no).
  // Thieu field nay khien MOI loi tu ml-service roi qua nhanh `error.message` cuoi cung, hien
  // nguyen van chuoi tieng Anh cua axios ("Request failed with status code 400") thay vi ly do
  // thuc su, bat ke ngon ngu dang chon.
  detail?: string;
}

/**
 * Trich xuat thong diep loi tu response API (Technical_Spec.md muc 7: { message, ... }).
 *
 * 20/08/2026: nang cap cho rollout i18n (xem
 * packages/common-dto/src/constants/error-codes.constant.ts) - uu tien dich qua i18next bang
 * errorCode/details khi backend da gan ma cho diem loi do, LUON co defaultValue la chinh message
 * tieng Viet cu (dang chua kip gan ma, hoac key dich con thieu) nen KHONG bao gio "vo" - hanh vi
 * cu (chi doc message) giu nguyen 100% khi khong co field moi nao.
 */
// 26/08/2026: fallback mac dinh chuyen sang t('common:genericError') thay vi chuoi tieng Viet
// cung - phat hien qua script scripts/check-hardcoded-vietnamese.js (moi them). Gia tri mac dinh
// cua tham so duoc tinh lai moi lan goi ham (khong phai 1 lan luc module load) nen luon bat dung
// ngon ngu hien tai cua nguoi dung, khong bi "dong bang" o ngon ngu luc app khoi dong.
export function extractErrorMessage(error: unknown, fallback = i18n.t('common:genericError')): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ErrorResponseData | undefined;
    // 22/08/2026: kiem tra them Array.isArray(data.details) - truoc day chi check "truthy" nen
    // details la object/string/number (BE gui sai dinh dang) se lam .map() ben duoi nem TypeError
    // ngay trong ham xu ly loi nay, mat het thong bao toast thay vi hien fallback an toan.
    if (data?.details && Array.isArray(data.details) && Array.isArray(data.message)) {
      const messages = data.message;
      return data.details.map((d, i) => i18n.t(`errors:${d.code}`, { ...d.params, defaultValue: messages[i] })).join(', ');
    }
    if (data?.errorCode && typeof data.message === 'string') {
      return i18n.t(`errors:${data.errorCode}`, { ...data.errorParams, defaultValue: data.message });
    }
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    if (data?.detail) return data.detail;
    if (error.message) return error.message;
  }
  return fallback;
}
