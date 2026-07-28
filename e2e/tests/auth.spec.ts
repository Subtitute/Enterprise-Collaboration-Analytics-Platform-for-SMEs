import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from './helpers';

// 28/07/2026: luong "vang" xac thuc - dang nhap dung, dang nhap sai, dang xuat + chan truy cap
// sau khi dang xuat. Day la mang luoi bat regression cho AuthController/ProtectedRoute/auth.store,
// noi da co nhieu lan sua loi thuc te (cookie refresh token, revoke logout...) trong qua trinh
// lam do an nhung chua tung co kiem thu tren trinh duyet that.
test.describe('Xac thuc', () => {
  test('dang nhap thanh cong dua ve Dashboard, xem duoc Ho so ca nhan cua chinh minh', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/profile');
    // 28/07/2026: trang Ho so hien email o 2 cho (dong phu de o dau trang + muc chi tiet "Email")
    // - .first() la du de xac nhan trang render dung du lieu cua chinh nguoi dang dang nhap.
    await expect(page.getByText(ADMIN_EMAIL).first()).toBeVisible();
  });

  test('dang nhap sai mat khau hien thong bao tieng Viet, khong chuyen trang', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Mật khẩu').fill('SaiMatKhauChacChan123!');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // 28/07/2026: chi kiem tra co thong bao loi hien ra (khong gan chat vao 1 cau chu the) - IAM
    // co chu dich tra thong bao GIONG NHAU cho ca 2 truong hop sai mat khau/khong ton tai email
    // (chong do tham nguoi dung, xem AuthService.login() + DUMMY_PASSWORD_HASH), noi dung chinh
    // xac khong quan trong bang viec no la tieng Viet va KHONG chuyen huong. Toast tieu de dung
    // tieng Viet co dau ("Đăng nhập thất bại") nhung noi dung loi tu backend theo quy uoc khong
    // dau cua codebase ("khong dung") - khop ca 2 kieu.
    await expect(page.locator('body')).toContainText(/thất bại|không đúng|khong dung|không hợp lệ/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('dang xuat xoa phien - truy cap lai trang can bao ve se ve /login', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Menu tài khoản' }).click();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await page.waitForURL('**/login');

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
