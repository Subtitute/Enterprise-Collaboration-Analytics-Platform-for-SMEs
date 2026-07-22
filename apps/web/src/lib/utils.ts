export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Mot so endpoint co the tra ve mang tho [] hoac { data: [] } tuy service - ham nay chuan hoa
 * ca hai dang de UI khong vo neu quy uoc response cua tung service lech nhau chut it.
 */
export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

// 22/07/2026: them timeZone: 'Asia/Ho_Chi_Minh' vao ca 2 ham render ngay/gio tuyet doi ben duoi -
// ClaudeRule.md muc 4 va Wireframe.md muc 0 deu quy dinh gio hien thi phai la GMT+7. Truoc ban sua
// nay, Intl.DateTimeFormat khong duoc truyen timeZone nen tu dong dung timezone cua may/trinh
// duyet nguoi xem - vi du 1 nguoi dung xem trang tu mot may dat gio UTC hoac US se thay ngay/gio
// SAI LECH so voi gio Viet Nam that su (co the lech ca ngay o cac moc gan nua dem), du du lieu
// server tra ve la dung.
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return 'vừa xong';
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return `${diffDay} ngày trước`;
  return formatDate(value);
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// Backend contract khong tra ve permissionKeys trong AuthUser (JWT context) - chi { id, name }
// cho moi role - nen khong the kiem tra quyen chinh xac 100% o client. Day la heuristic don gian
// (khong chan chac chan, backend van la noi thuc thi RBAC that su o tung API): an muc "Quan tri"
// tren Sidebar neu KHONG co role nao trung ten "quan tri/admin/owner", VA lam dieu kien cho
// route-guard thuc su cua /admin/* (xem components/layout/ProtectedRoute.tsx, bo sung 21/07/2026).
// Fail CLOSED khi khong/chua co du lieu vai tro (roles rong/undefined) - truoc day fail-open
// (coi nhu la admin) la mot lo hong: bat ky user nao co roles=[] (vd du lieu dang tai dang do,
// hoac user khong duoc gan role nao) se duoc coi la admin va vao duoc /admin/*.
const ADMIN_ROLE_PATTERN = /admin|quản\s*trị|quan\s*tri|owner/i;

export function hasAdminRole(roles?: Array<{ name: string }>): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => ADMIN_ROLE_PATTERN.test(r.name));
}

export function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Chuoi mau on dinh theo hash don gian cua id/ten - dung cho Avatar. */
export function stringToColorClass(seed: string): string {
  const palette = [
    'bg-primary-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-violet-500',
    'bg-cyan-600',
    'bg-fuchsia-500',
    'bg-lime-600',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}
