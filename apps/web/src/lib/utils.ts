import i18n from '@/i18n';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// 20/08/2026: rollout i18n - anh xa ngon ngu app (i18n.language: 'vi'|'en'|'ja') sang tag locale
// chuan cua Intl. Dung 'en-GB' (khong phai 'en-US') cho tieng Anh de GIU NGUYEN thu tu ngay/thang
// (DD/MM/YYYY) nhat quan voi tieng Viet - doi sang 'en-US' se doi thu tu thanh MM/DD/YYYY, gay
// nham lan khi nguoi dung chuyen qua lai giua ngon ngu tren cung 1 du lieu.
const INTL_LOCALE_MAP: Record<string, string> = { vi: 'vi-VN', en: 'en-GB', ja: 'ja-JP' };

function currentIntlLocale(): string {
  return INTL_LOCALE_MAP[i18n.language] ?? 'vi-VN';
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
  return new Intl.DateTimeFormat(currentIntlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(
    d,
  );
}

export function formatShortDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(currentIntlLocale(), {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(currentIntlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(currentIntlLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
}

// 20/08/2026: chuyen sang Intl.RelativeTimeFormat (co san node/trinh duyet, du lieu CLDR chinh
// thuc) thay vi tu ghep chuoi tieng Viet tay - da xac minh truc tiep: Intl.RelativeTimeFormat('vi',
// {numeric:'auto'}) tra ve DUNG "5 giây trước"/"3 phút trước"/... khop 100% voi chuoi cu, nen doi
// sang day KHONG lam thay doi hien thi tieng Viet, chi them mien phi ban Anh/Nhat. Nguong "vua
// xong" (<5 giay) van tu code rieng vi RelativeTimeFormat khong co "just now" o cap giay.
export function formatRelativeTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 5) return i18n.t('common:relativeTime.justNow');

  const rtf = new Intl.RelativeTimeFormat(currentIntlLocale(), { numeric: 'auto' });
  if (diffSec < 60) return rtf.format(-diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 30) return rtf.format(-diffDay, 'day');
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
const ADMIN_ROLE_PATTERN = /admin|quản\s*trị|quan\s*tri|owner/i; // i18n-lint-ignore: pattern doi chieu ten vai tro, khong phai chuoi hien thi

export function hasAdminRole(roles?: Array<{ name: string }>): boolean {
  if (!roles || roles.length === 0) return false;
  return roles.some((r) => ADMIN_ROLE_PATTERN.test(r.name));
}

// 20/08/2026: dung cho PasswordInput (components/ui/Input.tsx) - phat hien go NHAM dau tieng
// Viet vao o mat khau (bo go Unikey/EVKey... doi khi tu dong ghep dau du nguoi dung go phim
// thuong, KHONG nhan ra vi o mat khau che ky tu, khong xem lai duoc gi da go that su) de HIEN THI
// canh bao, KHONG chan/loc bo ky tu - han che bo ky tu mat khau lam giam do manh mat khau, day chi
// la tin hieu THEM giup nguoi dung tu nhan ra, khong phai co che thuc thi.
// `normalize('NFD')` tach ky tu co dau thanh chu cai goc + dau ghep rieng (dai U+0300-U+036F) -
// bat duoc hau het nguyen am co dau. "đ/Đ" la 1 chu cai La-tinh MO RONG rieng (khong phai chu cai
// + dau ghep) nen NFD khong tach duoc, phai kiem tra rieng.
export function containsVietnameseDiacritics(value: string): boolean {
  // i18n-lint-ignore: 2 pattern doi chieu dau tieng Viet trong mat khau ngay duoi, khong phai chuoi hien thi
  return /[\u0300-\u036f]/.test(value.normalize('NFD')) || /[đĐ]/.test(value);
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

/**
 * Loại bỏ dấu tiếng Việt và chuẩn hóa chuỗi về dạng chữ thường không dấu:
 * - Chuẩn hóa ký tự Đ/đ -> d
 * - Tách tổ hợp dấu Unicode NFD và loại bỏ các ký tự dấu
 * - Ví dụ: "Tiến" -> "tien", "Đồ án" -> "do an"
 */
export function removeVietnameseTones(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Kiểm tra xem chuỗi nguồn (target) có chứa từ khóa tìm kiếm (searchQuery) hay không:
 * - So khớp cả trường hợp có dấu lẫn không dấu, không phân biệt hoa thường.
 * - Ví dụ: "Dự án Website" khớp với "du an", "dự", "website", "Tiến" khớp với "tien", "Tien", "tiến".
 */
export function matchesVietnameseSearch(target?: string | null, searchQuery?: string | null): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;
  if (!target) return false;
  const normalizedTarget = removeVietnameseTones(target);
  const normalizedQuery = removeVietnameseTones(searchQuery);
  return (
    target.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    normalizedTarget.includes(normalizedQuery)
  );
}

/**
 * Tính toán tổng số ngày làm việc giữa 2 mốc ngày (loại trừ Thứ Bảy và Chủ Nhật).
 * Nếu khoảng ngày rơi vào cuối tuần hoặc cùng ngày, tính tối thiểu số ngày làm việc tương ứng.
 */
export function calculateWorkingDays(startDateStr?: string | null, endDateStr?: string | null): number {
  if (!startDateStr || !endDateStr) return 0;
  const startParts = startDateStr.split('T')[0].split('-').map(Number);
  const endParts = endDateStr.split('T')[0].split('-').map(Number);
  if (startParts.length < 3 || endParts.length < 3) return 0;

  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  if (start > end) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dayOfWeek = cur.getDay();
    // 0 = Chủ nhật, 6 = Thứ bảy
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  // Trường hợp chọn trong ngày cuối tuần: trả về số ngày thực tế chênh lệch để không bị hiển thị 0 ngày
  if (count === 0 && start <= end) {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  return count;
}
