const GMT7_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * 04/11/2026: ngay vao lam gui cho hrm-service (`joinedAt` trong USER_REGISTERED/USER_DEPARTMENT_CHANGED):
 * ngay tao tai khoan quy ve lich GMT+7, dang 'YYYY-MM-DD'. Khong co gia tri thi tra undefined de field bi
 * bo khoi JSON - ben nhan khong xoa gia tri da co.
 */
export function toJoinedAt(createdAt?: Date | string | null): string | undefined {
  if (!createdAt) return undefined;
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return undefined;
  return new Date(time + GMT7_OFFSET_MS).toISOString().slice(0, 10);
}
