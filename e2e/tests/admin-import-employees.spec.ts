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
    // 04/11/2026: o chon tep Excel khong con id rieng (ImportEmployeesModal co them o chon .zip anh) -
    // chon theo accept de khong nham sang o .zip.
    await page.locator('input[type="file"][accept=".xlsx,.xls"]').setInputFiles(filePath);

    // 04/11/2026: form nhap nay chia buoc (Tep -> Xem truoc -> Dang nhap -> Ket qua) - sang buoc Xem truoc
    // roi moi co so dong hop le va ly do loi.
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await expect(page.getByText(/Tổng 2 · Mời mới 1 · Cập nhật 0 · Cảnh báo 0 · Lỗi 1/)).toBeVisible();
    await expect(page.getByText('Thiếu họ và tên')).toBeVisible();

    // 24/09/2026: khong assert truc tiep vao noi dung toast - toast tu dong bien mat sau 4.5s
    // (Toast.tsx) nen de dua vao thoi diem chinh xac request hoan tat, dan den flaky. Trang thai
    // "Đã tạo" trong CHINH dong xem truoc thi ON DINH (khong tu bien mat) va phan anh dung ket qua
    // that su tu server (khong phai lac quan/optimistic).
    await page.getByRole('button', { name: /Nhập 1 dòng hợp lệ/ }).click();
    await expect(page.getByText(/Hoàn tất: 1 thành công/)).toBeVisible({ timeout: 20_000 });

    // Modal co 2 nut cung ten hien thi "Đóng": nut X o goc (aria-label) va nut footer (chu). Nut
    // footer dung sau trong DOM -> .last().
    await page.getByRole('button', { name: 'Đóng', exact: true }).last().click();

    await page.getByPlaceholder('Tên, email, mã NV, SĐT…').fill(email);
    await expect(page.getByRole('row', { name: new RegExp(email) })).toBeVisible();
  } finally {
    fs.unlinkSync(filePath);
  }
});
