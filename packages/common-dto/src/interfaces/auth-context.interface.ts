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
}

/** Payload ky trong JWT access token, phat hanh boi IAM Service. */
export interface JwtAccessPayload {
  sub: string; // userId
  organizationId: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string; // userId
  tokenId: string; // id cua ban ghi RefreshToken, dung de thu hoi
  iat?: number;
  exp?: number;
}

export const INTERNAL_AUTH_HEADERS = {
  ORG_ID: 'x-org-id',
  USER_ID: 'x-user-id',
  EMAIL: 'x-user-email',
  ROLES: 'x-roles',
  PERMISSIONS: 'x-permissions',
} as const;
