import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { loginAsAdmin, uniqueEmail, uniqueName } from './helpers';

// 24/09/2026: luong "vang" Quan tri > Thanh vien > Nhap tu Excel - tao file .xlsx voi 1 dong hop
// le + 1 dong loi (thieu ho ten) ngay trong test (dung lai chinh thu vien `xlsx` ma tinh nang
// dung, hoisted len node_modules goc qua npm workspaces), xac nhan bang xem truoc dem dung so dong
// hop le/loi, nhap thanh cong dong hop le, va nhan vien moi xuat hien that trong danh sach.
test('nhap nhan vien hang loat tu file Excel', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/members');

  const fullName = uniqueName('NV Excel');
  const email = uniqueEmail('e2e-import');

  const sheet = XLSX.utils.aoa_to_sheet([
    ['Họ và tên', 'Email', 'Mật khẩu', 'Phòng ban', 'Vai trò'],
    [fullName, email, '', '', ''],
    ['', uniqueEmail('e2e-import-invalid'), '', '', ''],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Nhan vien');
  const filePath = path.join(os.tmpdir(), `e2e-import-employees-${Date.now()}.xlsx`);
  XLSX.writeFile(workbook, filePath);

  try {
    await page.getByRole('button', { name: 'Nhập từ Excel' }).click();
    await page.locator('#import-employees-file').setInputFiles(filePath);

    await expect(page.getByText('1 dòng hợp lệ')).toBeVisible();
    await expect(page.getByText('1 dòng có lỗi')).toBeVisible();
    await expect(page.getByText('Thiếu họ và tên')).toBeVisible();

    // 24/09/2026: khong assert truc tiep vao noi dung toast - toast tu dong bien mat sau 4.5s
    // (Toast.tsx) nen de dua vao thoi diem chinh xac request hoan tat, dan den flaky. Trang thai
    // "Đã tạo" trong CHINH dong xem truoc thi ON DINH (khong tu bien mat) va phan anh dung ket qua
    // that su tu server (khong phai lac quan/optimistic).
    await page.getByRole('button', { name: 'Nhập 1 nhân viên' }).click();
    await expect(page.getByRole('cell', { name: 'Đã tạo' })).toBeVisible();

    // Modal co 2 nut cung ten hien thi "Đóng": nut X o goc (aria-label) va nut footer (chu). Nut
    // footer dung sau trong DOM -> .last().
    await page.getByRole('button', { name: 'Đóng', exact: true }).last().click();

    await page.getByPlaceholder('Tìm theo tên hoặc email…').fill(email);
    await expect(page.getByRole('row', { name: new RegExp(email) })).toBeVisible();
  } finally {
    fs.unlinkSync(filePath);
  }
});
