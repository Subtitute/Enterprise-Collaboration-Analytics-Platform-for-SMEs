/**
 * Thong tin nguoi dung duoc API Gateway trich xuat tu JWT va forward qua header noi bo
 * (x-org-id, x-user-id, x-roles, x-permissions) - Technical_Spec.md muc 6.
 */
export interface AuthContext {
  userId: string;
  organizationId: string;
  email: string;
  roles: string[];
  permissions: string[];
  // 28/07/2026: bo sung departmentId (nang cap access-control tai lieu theo pham vi to chuc -
  // xem apps/document-service/src/folders/folders.service.ts, FolderShare) - truoc day chuoi
  // xac thuc (JWT -> header noi bo -> AuthContext) chi mang organizationId ma KHONG mang
  // departmentId cua nguoi goi, nen mot service phia sau (Document) khong the tu kiem tra "nguoi
  // nay co thuoc phong ban duoc chia se hay khong" ma khong goi ngang sang IAM Service (chua co
  // co che goi noi bo giua cac service). `null` neu nguoi dung chua duoc gan phong ban nao.
  departmentId: string | null;
}

/** Payload ky trong JWT access token, phat hanh boi IAM Service. */
export interface JwtAccessPayload {
  sub: string; // userId
  organizationId: string;
  email: string;
  roles: string[];
  permissions: string[];
  // 28/07/2026: xem ghi chu departmentId tai AuthContext o tren - cung ly do, dua thang vao JWT
  // de Gateway forward duoc qua header noi bo ma khong can IAM Service lam gi them luc verify.
  departmentId: string | null;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string; // userId
  tokenId: string; // id cua ban ghi RefreshToken, dung de thu hoi
  iat?: number;
  exp?: number;
}

/** 15/09/2026: "Quen mat khau" - ky rieng bang jwt.resetSecret (KHAC access/refresh secret). */
export interface JwtResetPayload {
  sub: string; // userId
  tokenId: string; // id cua ban ghi PasswordResetToken, dung de xac minh CHUA dung + chua het han
  iat?: number;
  exp?: number;
}

export const INTERNAL_AUTH_HEADERS = {
  ORG_ID: 'x-org-id',
  USER_ID: 'x-user-id',
  EMAIL: 'x-user-email',
  ROLES: 'x-roles',
  PERMISSIONS: 'x-permissions',
  // 28/07/2026: header noi bo moi mang departmentId - xem ghi chu tai AuthContext o tren.
  DEPARTMENT_ID: 'x-department-id',
} as const;
