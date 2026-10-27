/**
 * 26/10/2026: so dien thoai Viet Nam (Technical_Spec.md muc 27.10) - CUNG quy tac voi
 * normalizeVietnamesePhone() o packages/common-dto (web khong import truc tiep goi CJS do, xem
 * constants/permissions.ts). Server van la noi kiem tra cuoi cung (PHONE_INVALID).
 */
export function normalizeVietnamesePhone(raw: string): string | null {
  let digits = raw.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (/^84\d{9,10}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return /^0[35789]\d{8}$/.test(digits) || /^02\d{9}$/.test(digits) ? digits : null;
}

/** Hien thi: di dong "0912 345 678", co dinh "028 3812 3456". */
export function formatPhone(phone?: string | null): string {
  if (!phone) return '—';
  if (phone.length === 10) return `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
  if (phone.length === 11) return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7)}`;
  return phone;
}

export const EMPLOYEE_CODE_RE = /^[A-Za-z0-9._-]{1,32}$/;
