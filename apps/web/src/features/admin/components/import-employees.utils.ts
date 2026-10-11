import type { Department, RoleWithPermissions } from '@/types';

// 24/09/2026: tinh nang "Nhap Excel hang loat" cho trang Thanh vien (yeu cau nguoi dung: "quick add
// employees") - tai su dung NGUYEN VEN POST /users/invite da co (khong doi backend), goi LAP LAI
// tung dong tu frontend giong het cach useInviteUser() (hooks.ts) goi cho 1 nguoi - xem chu thich
// day du trong ke hoach (khong tao endpoint bulk-import moi de tranh trung logic validate/RBAC/
// outbox da co san trong UsersService.invite()).

// Ten cot co dinh cua file Excel (vua dung de sinh mau, vua dung de doc lai file da dien) - day
// la 1 HOP DONG DU LIEU (schema cot), khong phai van ban giao dien can dich theo ngon ngu dang
// chon - giu co dinh tieng Viet giong quy uoc du lieu nghiep vu (ten phong ban...) xuyen suot du
// an. i18n-lint-ignore (24/09/2026)
export const TEMPLATE_HEADERS = ['Họ và tên', 'Email', 'Mật khẩu', 'Phòng ban', 'Vai trò'];

// Mat khau mac dinh khi o "Mat khau" de trong trong file Excel - CUNG mat khau demo dung xuyen
// suot scripts/seed.js, de nhat quan voi quy uoc du lieu demo cua du an.
export const DEFAULT_PASSWORD = 'Password123!';
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRow {
  rowNumber: number;
  fullName: string;
  email: string;
  initialPassword: string;
  passwordWasDefaulted: boolean;
  departmentName: string;
  departmentId?: string;
  roleName: string;
  roleId?: string;
  error?: string;
}

export type RowOutcome = { rowNumber: number; status: 'success' | 'error'; message: string };

export function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

export function findByName<T extends { id: string; name: string }>(list: T[], name: string): T | undefined {
  const target = name.trim().toLowerCase();
  return list.find((item) => item.name.trim().toLowerCase() === target);
}

export function buildRows(
  raw: Record<string, unknown>[],
  departments: Department[],
  roles: RoleWithPermissions[],
  canManageRoles: boolean,
): ParsedRow[] {
  // Cac khoa tra cuu duoi day khop CHINH XAC voi TEMPLATE_HEADERS o tren - cung 1 hop dong du
  // lieu, khong phai van ban giao dien. i18n-lint-ignore (24/09/2026)
  return raw.map((record, index) => {
    const fullName = normalize(record['Họ và tên']); // i18n-lint-ignore (24/09/2026)
    const email = normalize(record['Email']).toLowerCase();
    const rawPassword = normalize(record['Mật khẩu']); // i18n-lint-ignore (24/09/2026)
    const departmentName = normalize(record['Phòng ban']); // i18n-lint-ignore (24/09/2026)
    const roleName = normalize(record['Vai trò']); // i18n-lint-ignore (24/09/2026)

    const row: ParsedRow = {
      rowNumber: index + 2, // +2: dong 1 la header, du lieu bat dau tu dong 2 trong Excel
      fullName,
      email,
      initialPassword: rawPassword || DEFAULT_PASSWORD,
      passwordWasDefaulted: !rawPassword,
      departmentName,
      roleName,
    };

    if (!fullName) {
      row.error = 'missingFullName';
      return row;
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      row.error = 'invalidEmail';
      return row;
    }
    if (rawPassword && rawPassword.length < 8) {
      row.error = 'passwordTooShort';
      return row;
    }
    if (departmentName) {
      const dept = findByName(departments, departmentName);
      if (!dept) {
        row.error = 'departmentNotFound';
        return row;
      }
      row.departmentId = dept.id;
    }
    if (roleName && canManageRoles) {
      const role = findByName(roles, roleName);
      if (!role) {
        row.error = 'roleNotFound';
        return row;
      }
      row.roleId = role.id;
    }

    return row;
  });
}

