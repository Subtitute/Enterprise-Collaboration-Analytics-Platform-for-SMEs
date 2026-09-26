import type { Page } from '@playwright/test';

// 25/09/2026: tai khoan Org Admin cua to chuc E2E RIENG (`npm run seed:e2e`, xem
// scripts/seed-e2e.js) - KHONG con dung to chuc demo mac dinh (admin@demo-sme.vn) nhu truoc day.
// Ly do: moi lan chay E2E tao du lieu rac ("Thanh vien E2E <timestamp>", "Khach hang E2E
// <timestamp>"...) thang vao to chuc dang dung de demo/trinh bay that, tich luy vinh vien qua
// nhieu lan chay - nguoi dung da phan anh nhieu lan. Co the ghi de qua E2E_ADMIN_EMAIL/
// E2E_ADMIN_PASSWORD neu can (vd chay nhieu to chuc E2E song song).
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@e2e-test.local';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Password123!';

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
