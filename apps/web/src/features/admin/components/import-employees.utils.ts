import { unzipSync } from 'fflate';
import type { Department, FaceInspectResult, FaceStatus, RoleWithPermissions, User } from '@/types';
import { EMPLOYEE_CODE_RE, normalizeVietnamesePhone } from '@/lib/phone';

// 24/09/2026: tinh nang "Nhap Excel hang loat" cho trang Thanh vien (yeu cau nguoi dung: "quick add
// employees") - tai su dung NGUYEN VEN POST /users/invite da co (khong doi backend), goi LAP LAI
// tung dong tu frontend giong het cach useInviteUser() (hooks.ts) goi cho 1 nguoi.
//
// 26/10/2026: mo rong thanh trinh nhap Excel + ZIP anh nhan dien (Technical_Spec.md muc 27.9,
// Wireframe muc 16.4): cot moi (So dien thoai, Ma nhan vien, Tep anh), mat khau TUY CHON (bo mat khau
// mac dinh dung chung - de trong thi gui email kich hoat), email da co -> cap nhat SDT/ma NV/anh (khong
// doi ho ten/phong ban/vai tro), anh trong ZIP ghep theo cot "Tep anh" hoac theo email. Tep Excel/ZIP
// KHONG BAO GIO len server - chi xu ly trong trinh duyet; file nay chi chua logic THUAN de test duoc.

// Ten cot co dinh cua file Excel (vua dung de sinh mau, vua dung de doc lai file da dien) - day
// la 1 HOP DONG DU LIEU (schema cot), khong phai van ban giao dien can dich theo ngon ngu dang
// chon. i18n-lint-ignore (24/09/2026)
export const COLUMNS = {
  fullName: 'Họ và tên', // i18n-lint-ignore (26/10/2026)
  email: 'Email',
  phone: 'Số điện thoại', // i18n-lint-ignore (26/10/2026)
  employeeCode: 'Mã nhân viên', // i18n-lint-ignore (26/10/2026)
  department: 'Phòng ban', // i18n-lint-ignore (26/10/2026)
  role: 'Vai trò', // i18n-lint-ignore (26/10/2026)
  password: 'Mật khẩu', // i18n-lint-ignore (26/10/2026)
  photo: 'Tệp ảnh', // i18n-lint-ignore (26/10/2026)
} as const;
export const TEMPLATE_HEADERS = Object.values(COLUMNS);
// Cot bao cao loi them vao cuoi cot goc (cung la hop dong du lieu tieng Viet co dinh). i18n-lint-ignore (26/10/2026)
export const REPORT_COLUMNS = ['Kết quả tài khoản', 'Kết quả ảnh', 'Lý do']; // i18n-lint-ignore (26/10/2026)

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Gioi han (muc 27.9): Excel <= 2MB va <= 300 dong; ZIP <= 500 tep, tong giai nen <= 200MB (kiem tra
// KICH THUOC KHAI BAO truoc khi giai nen - chong zip bomb), moi anh goc <= 5MB, chi .jpg/.jpeg/.png.
export const LIMITS = {
  excelBytes: 2 * 1024 * 1024,
  rows: 300,
  zipBytes: 200 * 1024 * 1024,
  zipEntries: 500,
  zipTotalUncompressed: 200 * 1024 * 1024,
  photoBytes: 5 * 1024 * 1024,
};
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

export type RowAction = 'invite' | 'update' | 'outOfScope';
export type StepStatus = 'pending' | 'ok' | 'skipped' | 'error';

export interface StepResult {
  status: StepStatus;
  /** Ma ly do (khoa i18n admin:importWizard.reasons.* hoac errors.*) hoac thong diep da dich tu server. */
  message?: string;
}

export interface ImportRow {
  rowNumber: number;
  /** Gia tri cot goc (de xuat lai trong bao cao loi - KHONG gom mat khau). */
  raw: Record<string, string>;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  employeeCode: string;
  departmentName: string;
  departmentId?: string;
  roleName: string;
  roleId?: string;
  password: string;
  photoColumn: string;
  /** Loi chan ca dong (ma i18n). */
  errors: string[];
  /** Ghi chu cot bi bo qua (ma i18n). */
  notes: string[];
  action?: RowAction;
  userId?: string;
  photo?: {
    fileName?: string;
    blob?: Blob;
    error?: string;
    inspect?: FaceInspectResult;
    skipReason?: string;
  };
  account: StepResult;
  photoStep: StepResult;
}

export function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

export function findByName<T extends { id: string; name: string }>(list: T[], name: string): T | undefined {
  const target = name.trim().toLowerCase();
  return list.find((item) => item.name.trim().toLowerCase() === target);
}

/** Buoc 1: doc dong Excel -> kiem tra phia client (email, so dien thoai, ma NV, trung trong file). */
export function parseRows(records: Record<string, unknown>[]): ImportRow[] {
  const rows = records.map((record, index): ImportRow => {
    const raw: Record<string, string> = {};
    for (const col of TEMPLATE_HEADERS) raw[col] = col === COLUMNS.password ? '' : normalize(record[col]);
    const phoneRaw = normalize(record[COLUMNS.phone]);
    const employeeCode = normalize(record[COLUMNS.employeeCode]);
    const password = normalize(record[COLUMNS.password]);
    const row: ImportRow = {
      rowNumber: index + 2, // +2: dong 1 la header, du lieu bat dau tu dong 2 trong Excel
      raw,
      fullName: normalize(record[COLUMNS.fullName]),
      email: normalize(record[COLUMNS.email]).toLowerCase(),
      phoneNumber: phoneRaw ? normalizeVietnamesePhone(phoneRaw) : null,
      employeeCode,
      departmentName: normalize(record[COLUMNS.department]),
      roleName: normalize(record[COLUMNS.role]),
      password,
      photoColumn: normalize(record[COLUMNS.photo]),
      errors: [],
      notes: [],
      account: { status: 'pending' },
      photoStep: { status: 'pending' },
    };
    if (!row.email || !EMAIL_REGEX.test(row.email)) row.errors.push('invalidEmail');
    if (phoneRaw && !row.phoneNumber) row.errors.push('invalidPhone');
    if (employeeCode && !EMPLOYEE_CODE_RE.test(employeeCode)) row.errors.push('invalidEmployeeCode');
    if (password && password.length < 8) row.errors.push('passwordTooShort');
    return row;
  });
  markDuplicates(rows, (r) => r.email, 'duplicateEmailInFile');
  markDuplicates(rows, (r) => r.employeeCode.toUpperCase(), 'duplicateEmployeeCodeInFile');
  return rows;
}

// 26/10/2026 (phat hien qua kiem thu): CHI danh loi tu lan xuat hien THU 2 tro di - dong dau tien van
// nhap binh thuong (truoc day ca 2 dong deu bi loi, nguoi dung phai sua ca dong dung).
function markDuplicates(rows: ImportRow[], key: (r: ImportRow) => string, code: string) {
  const seen = new Set<string>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    if (seen.has(k) && !r.errors.includes(code)) r.errors.push(code);
    seen.add(k);
  }
}

/**
 * Buoc 2: phan loai Moi moi / Cap nhat / Ngoai pham vi. `orgEmails`: email -> userId cua MOI nguoi
 * trong to chuc (GET /users); `scopeIds`: userId trong pham vi nguoi goi (GET /users/directory).
 * Email da co: chi cap nhat SDT/ma NV (Org Admin) + anh; ho ten/phong ban/vai tro/mat khau bi bo qua.
 */
export function classifyRows(
  rows: ImportRow[],
  ctx: {
    orgEmails: Map<string, string>;
    scopeIds: Set<string>;
    departments: Department[];
    roles: RoleWithPermissions[];
    canManageUsers: boolean;
    faceStatusById?: Record<string, FaceStatus>;
  },
): ImportRow[] {
  for (const row of rows) {
    if (row.errors.length) continue;
    if (!ctx.canManageUsers && (row.phoneNumber || row.employeeCode)) row.notes.push('managerContactIgnored');
    const existingId = ctx.orgEmails.get(row.email);
    if (existingId) {
      row.userId = existingId;
      if (!ctx.scopeIds.has(existingId)) {
        row.action = 'outOfScope';
        row.errors.push('outOfScope');
        continue;
      }
      row.action = 'update';
      if (row.fullName || row.departmentName || row.roleName || row.password) row.notes.push('updateIgnoresFields');
      if (ctx.faceStatusById?.[existingId] === 'WITHDRAWN' && row.photo?.blob) row.photo.skipReason = 'photoWithdrawn';
      continue;
    }
    row.action = 'invite';
    if (!row.fullName) row.errors.push('missingFullName');
    if (row.departmentName && ctx.canManageUsers) {
      const dept = findByName(ctx.departments, row.departmentName);
      if (dept) row.departmentId = dept.id;
      else row.errors.push('departmentNotFound');
    }
    if (row.roleName && ctx.canManageUsers) {
      const role = findByName(ctx.roles, row.roleName);
      if (role) row.roleId = role.id;
      else row.errors.push('roleNotFound');
    }
    if (!ctx.canManageUsers && (row.roleName || row.departmentName)) row.notes.push('managerRoleDepartmentIgnored');
    // Manager: chi tai anh cho nguoi DA CO (muc 27.7) - nguoi moi tu dang ky/duoc tai sau.
    if (!ctx.canManageUsers && row.photo?.blob) row.photo.skipReason = 'managerPhotoExistingOnly';
  }
  return rows;
}

export interface ZipIndex {
  /** ten tep (chu thuong, bo thu muc) -> du lieu, hoac 'duplicate' neu 2 thu muc co cung ten tep. */
  files: Map<string, Uint8Array | 'duplicate'>;
  oversized: Set<string>;
  unsupported: Set<string>;
}

export class ZipLimitError extends Error {}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function isIgnoredEntry(path: string): boolean {
  return path.endsWith('/') || path.startsWith('__MACOSX/') || path.includes('/__MACOSX/') || baseName(path).startsWith('.');
}

/**
 * Doc ZIP trong bo nho trinh duyet. Kiem tra so tep + tong kich thuoc KHAI BAO (originalSize) trong
 * bo loc cua fflate TRUOC khi giai nen tung tep -> zip bomb bi chan som; chi lay ten tep (bo thu muc,
 * khong ghi gi ra dia nen khong co "zip-slip"); bo __MACOSX va tep an.
 */
export function readPhotoZip(data: Uint8Array): ZipIndex {
  let count = 0;
  let total = 0;
  const oversized = new Set<string>();
  const unsupported = new Set<string>();
  const extracted = unzipSync(data, {
    filter: (file) => {
      if (isIgnoredEntry(file.name)) return false;
      count += 1;
      total += file.originalSize;
      if (count > LIMITS.zipEntries) throw new ZipLimitError('zipTooManyFiles');
      if (total > LIMITS.zipTotalUncompressed) throw new ZipLimitError('zipTooLarge');
      const name = baseName(file.name).toLowerCase();
      if (!PHOTO_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        unsupported.add(name);
        return false;
      }
      if (file.originalSize > LIMITS.photoBytes) {
        oversized.add(name);
        return false;
      }
      return true;
    },
  });
  const files = new Map<string, Uint8Array | 'duplicate'>();
  for (const [path, bytes] of Object.entries(extracted)) {
    const name = baseName(path).toLowerCase();
    files.set(name, files.has(name) ? 'duplicate' : bytes);
  }
  return { files, oversized, unsupported };
}

/** Ten tep ung vien cua 1 dong: cot "Tep anh", de trong thi <email>.jpg/.jpeg/.png. */
export function photoCandidates(row: Pick<ImportRow, 'photoColumn' | 'email'>): string[] {
  if (row.photoColumn) return [baseName(row.photoColumn).toLowerCase()];
  return PHOTO_EXTENSIONS.map((ext) => `${row.email}${ext}`);
}

export type PhotoMatch = { fileName: string; bytes: Uint8Array } | { fileName?: string; error: string } | null;

export function matchPhoto(row: Pick<ImportRow, 'photoColumn' | 'email'>, zip: ZipIndex | null): PhotoMatch {
  const candidates = photoCandidates(row);
  if (!zip) return row.photoColumn ? { fileName: candidates[0], error: 'photoNoZip' } : null;
  for (const name of candidates) {
    if (zip.oversized.has(name)) return { fileName: name, error: 'photoTooLarge' };
    if (zip.unsupported.has(name)) return { fileName: name, error: 'photoUnsupported' };
    const entry = zip.files.get(name);
    if (entry === 'duplicate') return { fileName: name, error: 'photoDuplicateName' };
    if (entry) return { fileName: name, bytes: entry };
  }
  if (row.photoColumn) {
    const name = candidates[0];
    const ext = name.slice(name.lastIndexOf('.'));
    return { fileName: name, error: PHOTO_EXTENSIONS.includes(ext) ? 'photoNotFound' : 'photoUnsupported' };
  }
  return null;
}

/** Tep anh trong ZIP khong khop dong nao (hien canh bao o buoc Xem truoc). */
export function unmatchedPhotos(rows: ImportRow[], zip: ZipIndex | null): string[] {
  if (!zip) return [];
  const used = new Set(rows.map((r) => r.photo?.fileName).filter(Boolean) as string[]);
  return [...zip.files.keys()].filter((name) => !used.has(name));
}

export function rowIsWritable(row: ImportRow): boolean {
  return row.errors.length === 0 && (row.action === 'invite' || row.action === 'update');
}

export function photoIsWritable(row: ImportRow): boolean {
  return Boolean(row.photo?.blob && !row.photo.error && !row.photo.skipReason && row.photo.inspect?.ok !== false);
}

/** 26/10/2026: dong co loi/thanh cong mot phan - cung dieu kien voi buildReportRows(). */
export function rowNeedsReport(row: ImportRow): boolean {
  return row.errors.length > 0 || row.account.status === 'error' || row.photoStep.status === 'error' || Boolean(row.photo?.error);
}

/** 26/10/2026: chi hien nut "Tai bao cao loi" khi that su co dong loi. */
export function hasReportableRows(rows: ImportRow[]): boolean {
  return rows.some(rowNeedsReport);
}

export type PhotoDisplayState = 'none' | 'error' | 'skipped' | 'notChecked' | 'checking' | 'ok';

/**
 * 26/10/2026: trang thai o "Anh nhan dien" o buoc Xem truoc. Dong loi (khong ghi) KHONG duoc kiem tra
 * anh qua server -> 'notChecked' (truoc day hien "Dang kiem tra..." mai mai).
 */
export function photoDisplayState(row: ImportRow): PhotoDisplayState {
  if (!row.photo) return 'none';
  if (row.photo.error) return 'error';
  if (row.photo.skipReason) return 'skipped';
  if (!rowIsWritable(row)) return 'notChecked';
  return row.photo.inspect ? 'ok' : 'checking';
}

/** Bao cao loi .xlsx = cot goc (khong mat khau) + Ket qua tai khoan + Ket qua anh + Ly do. */
export function buildReportRows(rows: ImportRow[], translate: (code: string) => string): string[][] {
  const out: string[][] = [[...TEMPLATE_HEADERS, ...REPORT_COLUMNS]];
  for (const row of rows) {
    if (!rowNeedsReport(row)) continue;
    // 26/10/2026: bo ly do trung (loi anh vua nam o photo.error vua o photoStep.message).
    const reasons = [
      ...new Set(
        [
          ...row.errors.map((e) => translate(e)),
          row.account.status === 'error' ? row.account.message ?? '' : '',
          row.photo?.error ? translate(row.photo.error) : '',
          row.photoStep.status === 'error' ? row.photoStep.message ?? '' : '',
        ].filter(Boolean),
      ),
    ];
    out.push([
      ...TEMPLATE_HEADERS.map((col) => row.raw[col] ?? ''),
      translate(`step.${row.account.status}`),
      translate(`step.${row.photoStep.status}`),
      reasons.join('; '),
    ]);
  }
  return out;
}

/** Map nhanh email -> userId tu GET /users (moi nguoi trong to chuc, ke ca ngoai pham vi). */
export function emailIndex(users: User[]): Map<string, string> {
  return new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
}
