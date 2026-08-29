import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

/**
 * Refresh token KHONG con di qua JSON body / localStorage - IAM Service set no qua httpOnly
 * cookie (`ecap_refresh_token`), trinh duyet tu dong gui kem nho `withCredentials: true` tren
 * axios instance (xem lib/api-client.ts) - Wireframe.md muc 1, Technical_Spec.md muc 6
 * (bo sung 21/07/2026). Vi vay AuthSession (du lieu tra ve tu API) khong con truong refreshToken.
 */
export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

/** Gia tri co dinh, KHONG phai bi mat - chi dung de bao toan hanh vi truthy-check o noi khac. */
const COOKIE_SESSION_FLAG = 'cookie';

interface AuthState {
  /** Chi luu trong bo nho (khong persist) vi ly do bao mat - xem README/backend contract. */
  accessToken: string | null;
  /**
   * KHONG con luu refresh token that (da chuyen sang httpOnly cookie o tren) - gia tri o day
   * chi la mot co (flag) khong nhay cam, luon la COOKIE_SESSION_FLAG khi co phien dang nhap va
   * null khi khong, GIU LAI de tuong thich voi cac noi con dung kieu "if (refreshToken)" de biet
   * co phien hay khong (vd goi API dang xuat). KHONG bao gio persist xuong localStorage.
   */
  refreshToken: string | null;
  user: AuthUser | null;
  /** True cho toi khi lan thu silent-refresh dau tien (luc app khoi dong) hoan tat. */
  isBootstrapping: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  setBootstrapped: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isBootstrapping: true,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          refreshToken: COOKIE_SESSION_FLAG,
          user: session.user,
        }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
      setBootstrapped: () => set({ isBootstrapping: false }),
    }),
    {
      name: 'ecap-auth',
      // Persist ca user va accessToken de giu phien on dinh, khong bi vang khoi trang khi F5/reload
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    },
  ),
);

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => Boolean(s.accessToken));
}
