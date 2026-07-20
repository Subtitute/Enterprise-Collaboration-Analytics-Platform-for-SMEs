import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@/types';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthState {
  /** Chi luu trong bo nho (khong persist) vi ly do bao mat - xem README/backend contract. */
  accessToken: string | null;
  /** Duoc persist vao localStorage de reload trang khong bat dang nhap lai (danh doi MVP hop ly). */
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
          refreshToken: session.refreshToken,
          user: session.user,
        }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
      setBootstrapped: () => set({ isBootstrapping: false }),
    }),
    {
      name: 'ecap-auth',
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
    },
  ),
);

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => Boolean(s.accessToken));
}
