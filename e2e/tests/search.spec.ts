import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// 28/07/2026: luong "vang" tim kiem tong hop tren Topbar - day la tinh nang tung bi bao loi
// "khong hoat dong" (22/07/2026, o chua tung duoc noi voi bat ky nguon du lieu nao) roi sau do co
// them 1 regression rieng ve viec chi kich hoat SAU lan focus dau tien (tranh goi 4 query ngay khi
// Topbar mount o moi trang). Test nay xac nhan ca 2: go vao O sau khi focus co goi duoc ket qua,
// va bam vao ket qua dieu huong dung trang.
test('tim kiem tong hop tim thay du an co san va dieu huong dung khi bam vao ket qua', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/dashboard');

  const searchBox = page.getByPlaceholder('Tìm kiếm dự án, tài liệu, công việc…');
  await searchBox.click(); // focus lan dau - kich hoat useGlobalSearch (xem hasInteracted)
  await searchBox.fill('Website ban hang SME');

  // 28/07/2026: role "option" (khong phai "button") - dot nang cap kha nang tiep can cung ngay da
  // gan role="option" cho moi ket qua (ngu nghia listbox/combobox dung hon), ghi de role "button"
  // ngam dinh cua the <button>; cap nhat locator cho khop. exact:true + .first() van can thiet vi
  // "Website ban hang SME" khop CA du an (danh muc "Dự án", dung dau tien theo thu tu render) LAN
  // cac task/thu muc thuoc du an do (sublabel cua chung cung chua ten du an).
  const result = page.getByRole('option', { name: /Website b[aá]n h[aà]ng SME/i }).first();
  await expect(result).toBeVisible();
  await result.click();
  await page.waitForURL('**/projects/**');
});
