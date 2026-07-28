import { test, expect } from '@playwright/test';
import { loginAsAdmin, uniqueEmail, uniqueName } from './helpers';

// 28/07/2026: luong "vang" Quan tri > Thanh vien - moi thanh vien moi, vo hieu hoa, roi kich hoat
// lai. "Kich hoat lai" la 1 fix (khong phai tinh nang co san tu dau) tu dot review 22/07/2026 -
// truoc do 1 tai khoan bi vo hieu hoa KHONG CO duong nao quay lai qua giao dien du backend co ho
// tro; test nay la mang luoi bat regression truc tiep cho dung luong do (moi -> vo hieu hoa ->
// kich hoat lai), khong chi kiem tra tung API rieng le.
test('moi thanh vien moi, vo hieu hoa roi kich hoat lai thanh cong', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/members');

  const fullName = uniqueName('Thanh vien E2E');
  const email = uniqueEmail('e2e-member');
  await page.getByRole('button', { name: 'Mời thành viên' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Họ và tên').fill(fullName);
  await page.getByLabel('Mật khẩu ban đầu').fill('Password123!');
  await page.getByRole('button', { name: 'Gửi lời mời' }).click();

  const row = page.getByRole('row', { name: new RegExp(email) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Đang hoạt động', { exact: true })).toBeVisible();

  // Vo hieu hoa.
  await row.getByRole('button', { name: 'Tùy chọn thành viên' }).click();
  await page.getByRole('button', { name: 'Vô hiệu hoá', exact: true }).click();
  await page.getByRole('button', { name: 'Vô hiệu hoá', exact: true }).click(); // xac nhan trong ConfirmDialog
  await expect(row.getByText('Đã vô hiệu hoá', { exact: true })).toBeVisible();

  // Kich hoat lai.
  await row.getByRole('button', { name: 'Tùy chọn thành viên' }).click();
  await page.getByRole('button', { name: 'Kích hoạt lại', exact: true }).click();
  await expect(row.getByText('Đang hoạt động', { exact: true })).toBeVisible();
});
