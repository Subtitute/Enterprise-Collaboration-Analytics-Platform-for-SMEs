import { useMemo } from 'react';
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

/**
 * 17/09/2026: giai ma phan payload (base64url, doan giua) cua JWT access token PHIA CLIENT - CHI
 * de doc du lieu hien/an UI, KHONG xac minh chu ky (viec xac minh la trach nhiem cua backend tren
 * tung API, xem packages/common-guard). AuthUser (JSON body /auth/login|register|refresh) KHONG
 * mang permissions (chi { id, name } cho moi role - xem apps/iam-service/src/auth/auth.service.ts
 * toPublicUser()), nhung accessToken THAT SU co mang permissions[] duoc IAM Service ky luc phat
 * hanh token (JwtAccessPayload.permissions, packages/common-dto/src/interfaces/
 * auth-context.interface.ts) - nen phai doc tu chinh JWT thay vi tu AuthUser.
 */
function decodeAccessTokenPermissions(token: string | null): string[] {
  if (!token) return [];
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return [];
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    const payload = JSON.parse(json) as { permissions?: unknown };
    return Array.isArray(payload.permissions) ? payload.permissions.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    // Token khong dung dinh dang JWT (vd du lieu test/mock) - fail closed ve mang rong, xem
    // canAccessAdminArea (lib/utils.ts) ve ly do fail-closed la lua chon co chu y o day.
    return [];
  }
}

/**
 * Danh sach quyen (permission key, vd 'user:invite') cua nguoi dang dang nhap - dung cho
 * canAccessAdminArea() va cac kiem tra quyen khac o client (CHI de an/hien UI - backend van la
 * noi thuc thi RBAC that su tren tung API, xem packages/common-guard/PermissionsGuard). Doc lai
 * tu accessToken (khong luu rieng trong store) de LUON dong bo voi token hien hanh, ke ca sau khi
 * refresh() xoay vong token hoac sau khi F5 (accessToken duoc persist, xem partialize o tren).
 */
export function usePermissions(): string[] {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useMemo(() => decodeAccessTokenPermissions(accessToken), [accessToken]);
}
