import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// 24/09/2026: Layer 3 Anomaly Detection - kiem tra TRUC TIEP endpoint POST /ml/anomalies (service
// Python/FastAPI dau tien cua du an, xem apps/ml-service) bang chinh accessToken cua phien dang
// nhap that, cung tinh than voi test drill-down trong analytics.spec.ts (khong assert vao du lieu
// cu the AI/model tra ve co the doi tuy du lieu demo hien co - chi xac nhan pipeline THAT SU chay
// het (Gateway -> ml-service -> Postgres rieng -> scikit-learn -> tra ve JSON hop le), khong loi/
// timeout/500).
test('POST /ml/anomalies tra ve dung cau truc du lieu voi du lieu that', async ({ page }) => {
  test.setTimeout(60_000); // lan dau IsolationForest chay tren du lieu demo co the mat vai giay.
  await loginAsAdmin(page);

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('ecap-auth');
    if (!raw) return null;
    return (JSON.parse(raw)?.state?.accessToken as string | undefined) ?? null;
  });
  expect(token).toBeTruthy();

  const res = await page.request.post('/api/v1/ml/anomalies', {
    params: { range: '30d' },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();

  expect(body.range).toBe('30d');
  expect(typeof body.generatedAt).toBe('string');
  expect(typeof body.sampleSize).toBe('number');
  expect(Array.isArray(body.anomalies)).toBe(true);

  for (const anomaly of body.anomalies) {
    expect(typeof anomaly.userId).toBe('string');
    expect(typeof anomaly.metrics.totalTasks).toBe('number');
    expect(typeof anomaly.metrics.completionRate).toBe('number');
    expect(typeof anomaly.metrics.overdueTasks).toBe('number');
    expect(typeof anomaly.metrics.attendanceRate).toBe('number');
    expect(['completionRate', 'overdueTasks', 'attendanceRate']).toContain(anomaly.topDeviation.metric);
    expect(['down', 'up']).toContain(anomaly.topDeviation.direction);
  }
});

// 24/09/2026: phan quyen - Employee (khong co ml:view theo DEFAULT_ROLE_PERMISSIONS, xem
// permission.enum.ts) bi tu choi ro rang (403), khong duoc coi la "khong co bat thuong" (200 rong -
// 2 y nghia khac han nhau: "da quet, khong thay gi" vs "khong duoc phep quet").
test('POST /ml/anomalies tu choi nguoi dung khong co quyen ml:view', async ({ page }) => {
  await loginAsAdmin(page);

  // 24/09/2026: sua loi flaky thuc te - truoc day tim thanh vien "Nhan vien" bang cach doc BANG
  // tren giao dien /admin/members (chi thay dong dau tien cua trang HIEN TAI) - danh sach nay bi
  // phan trang (15 dong/trang) va da tich luy rat nhieu thanh vien moi qua nhieu lan chay e2e khac
  // trong CUNG phien lam viec (admin-members.spec.ts/admin-import-employees.spec.ts...), day cac
  // thanh vien co vai tro "Nhan vien" (Employee) ra khoi trang 1. Doc TRUC TIEP qua API (khong bi
  // anh huong phan trang/thu tu hien thi) roi loc theo TEN VAI TRO THAT trong DB (tieng Anh
  // "Employee" - xem DefaultRoleName trong permission.enum.ts, khac nhan hien thi tieng Viet).
  const adminToken = await page.evaluate(() => {
    const raw = localStorage.getItem('ecap-auth');
    if (!raw) return null;
    return (JSON.parse(raw)?.state?.accessToken as string | undefined) ?? null;
  });
  expect(adminToken).toBeTruthy();
  const usersRes = await page.request.get('/api/v1/users', {
    params: { limit: 200 },
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(usersRes.ok()).toBe(true);
  const usersBody = await usersRes.json();
  const users: Array<{ email: string; roles: Array<{ name: string }> }> = Array.isArray(usersBody)
    ? usersBody
    : usersBody.data;
  const employee = users.find((u) => u.roles.some((r) => r.name === 'Employee'));
  expect(employee).toBeTruthy();
  const employeeEmail = employee!.email;

  // 24/09/2026: sua loi flaky thuc te - dieu huong thang toi /login trong luc VAN dang dang nhap
  // (Org Admin) bi tu dong redirect nguoc ve /dashboard (guard "da dang nhap thi khong vao lai
  // trang login"), khien o Email khong bao gio hien -> timeout. Phai dang xuat THAT truoc (mirror
  // dung pattern 2-lan-bam cua auth.spec.ts - co ConfirmDialog "Xac nhan dang xuat").
  await page.getByRole('button', { name: 'Menu tài khoản' }).click();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL('**/login');

  await page.getByLabel('Email').fill(employeeEmail);
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill('Password123!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/dashboard');

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('ecap-auth');
    if (!raw) return null;
    return (JSON.parse(raw)?.state?.accessToken as string | undefined) ?? null;
  });
  expect(token).toBeTruthy();

  const res = await page.request.post('/api/v1/ml/anomalies', {
    params: { range: '30d' },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(403);
});
