import type { Page } from '@playwright/test';

// 28/07/2026: tai khoan Org Admin demo co san sau `npm run seed` (xem scripts/seed.js,
// DEMO_ADMIN_EMAIL/DEMO_ADMIN_PASSWORD) - dung lai thay vi tu dang ky to chuc moi trong moi
// lan chay E2E, giu cac test don gian va nhanh.
export const ADMIN_EMAIL = 'admin@demo-sme.vn';
export const ADMIN_PASSWORD = 'Password123!';

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  // 21/08/2026: getByLabel('Mật khẩu') tro thanh mo ho sau khi PasswordInput them nut "Hien mat
  // khau" (aria-label="Hien mat khau" - chua chuoi con "mat khau") - ca o nhap va nut deu khop.
  // Loc theo role=textbox de chi lay o nhap, khong lay nut (role=button).
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(ADMIN_PASSWORD);
  // 24/09/2026: sau khi trang dang nhap co them the "Tai khoan trai nghiem & Demo" voi nut
  // "Dang nhap ngay ->" (auth.json demoAccount.quickLogin), getByRole('button', {name:'Dang nhap'})
  // khop CA 2 nut (nut submit form that su + nut demo). Them exact:true de chi lay nut submit.
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/dashboard');
}

/** Ten/email duy nhat theo lan chay - tranh trung du lieu giua nhieu lan chay E2E lien tiep. */
export function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}@demo-sme.vn`;
}
