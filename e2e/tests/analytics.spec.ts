import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// 22/08/2026: e2e smoke cho trang "Bao cao & Phan tich" (AnalyticsPage.tsx) - mot audit gan day
// phat hien module Analytics/Reports chua co bat ky Playwright coverage nao. Trang nay KHONG co
// "the KPI" rieng - noi dung that su la: bo loc khoang thoi gian/phong ban, 1 the "Nhan xet AI"
// (chi goi khi bam nut, khong tu dong), 2 bieu do Recharts (tien do du an - BarChart, hoat dong
// tai lieu - AreaChart) va 1 bang chi so du an sortable/phan trang (ProjectProgressTable). Vi
// Recharts ve SVG thuan tuy (khong co gia tri text on dinh de doc lai tu DOM ngoai qua Tooltip
// chi hien khi hover), test nay CO Y khong assert vao du lieu/pixel ben trong bieu do - thay vao
// do xac nhan: (1) trang tai xong that su (khong con ket qua "loi" cho ca 2 bieu do + bang, day la
// dieu quan trong nhat vi trang nay tung khong duoc kiem thu nen loi tich hop API se khong bi phat
// hien), (2) bang chi so hien 1 du an co san tu du lieu seed (scripts/seed.js - danh sach PROJECTS
// co dinh "Website ban hang SME") kem gia tri Hoan thanh/Tong cong viec la SO THUC (khong rong),
// va (3) ca 2 bieu do da render ra khung that (div.recharts-wrapper, 1-1 voi so bieu do) thay vi
// bi ket o trang thai rong/loi - do la muc "co container bieu do, khong kiem tra noi dung ben
// trong" ma khong phu thuoc vao gia tri so lieu chinh xac (co the doi khi seed chay lai).
test('trang Bao cao & Phan tich tai du lieu that: khong loi, bang chi so va bieu do co du lieu', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/analytics');

  // Tieu de trang - xac nhan dung route/dung trang (i18n/locales/vi/analytics.json: page.title).
  await expect(page.getByRole('heading', { name: 'Báo cáo & Phân tích' })).toBeVisible();

  // Bo loc khoang thoi gian/phong ban phai hien dien va co san lua chon (khong bi ket o loading).
  await expect(page.getByLabel('Khoảng thời gian')).toBeVisible();
  // 24/09/2026: getByLabel('Phòng ban') (substring, khong phan biet hoa/thuong theo mac dinh cua
  // Playwright) khop CA 2 phan tu: nut loc that su VA 1 tooltip chu thich (aria-label chua cum
  // "...theo phòng ban..." - projectProgressTable.footnote). Dung role=button de chi lay dung nut loc.
  await expect(page.getByRole('button', { name: 'Phòng ban' })).toBeVisible();

  // Khong co the trang thai loi nao trong ca 2 bieu do lan bang chi so - day la dieu audit trang
  // "khong duoc kiem thu" muon phat hien som nhat (vi du: sai contract API, endpoint tra 500...).
  await expect(page.getByText('Không thể tải tiến độ dự án')).toHaveCount(0);
  await expect(page.getByText('Không thể tải hoạt động tài liệu')).toHaveCount(0);
  await expect(page.getByText('Không thể tải bảng chỉ số dự án')).toHaveCount(0);

  // Bang "Bang chi so theo du an": kiem tra HANG DAU TIEN dang hien thi (bat ke ten du an) da tai
  // xong thuc su (khong con loading/rong) va co gia tri Hoan thanh/Tong cong viec la so thuc.
  //
  // 22/08/2026: sua loi thuc te phat hien khi chay lai nhieu lan trong CUNG 1 ngay - ban dau locator
  // nay tim theo TEN CU THE cua du an seed co dinh ("Website ban hang SME", scripts/seed.js). Bang
  // nay mac dinh sap xep theo "Tien do" GIAM DAN, phan trang 10 dong/trang, toan bo tren du lieu da
  // tai HET phia client (ProjectProgressTable.tsx) - moi lan chay projects-and-tasks.spec.ts (spec
  // khac trong CUNG bo test) tao 1 du an E2E moi VOI 1 cong viec duy nhat, chuyen thang sang "Hoan
  // thanh" ngay (tien do 100%). Chay lai bo test nhieu lan lien tiep (nhu da xay ra thuc te trong
  // phien lam viec nay) tich luy du du an 100% tien do de day "Website ban hang SME" (tien do that
  // < 100%) ra khoi trang 1 - test that bai KHONG PHAI vi loi code, ma vi to chuc demo dai han khong
  // reset du lieu giua cac lan chay e2e (moi trung khac voi CI dung DB tam thoi/xoa sau moi lan).
  // Sua bang cach BO PHU THUOC vao ten du an cu the - chi can 1 hang BAT KY dang hien co so lieu
  // that la du de xac nhan "bang tai du lieu that thanh cong", dung dung tinh than "khong assert
  // vao gia tri cu the co the doi khi seed chay lai" da neu trong chu thich dau file.
  const projectRow = page.locator('table tbody tr').first();
  await expect(projectRow).toBeVisible({ timeout: 10_000 });

  const cells = projectRow.locator('td');
  const completedTasksText = await cells.nth(2).innerText();
  const totalTasksText = await cells.nth(3).innerText();
  const totalTasks = Number(totalTasksText.trim());
  const completedTasks = Number(completedTasksText.trim());
  expect(Number.isFinite(totalTasks)).toBe(true);
  expect(Number.isFinite(completedTasks)).toBe(true);
  expect(totalTasks).toBeGreaterThan(0);
  expect(completedTasks).toBeGreaterThanOrEqual(0);
  expect(completedTasks).toBeLessThanOrEqual(totalTasks);

  // Thanh tien do (ProgressBar, role="progressbar") cua hang nay phai co gia tri hop le 0-100 -
  // xac nhan dong bo voi 2 cot so lieu vua kiem tra o tren, khong doc noi dung SVG/bieu do.
  const progressValue = await projectRow.locator('[role="progressbar"]').getAttribute('aria-valuenow');
  expect(Number(progressValue)).toBeGreaterThanOrEqual(0);
  expect(Number(progressValue)).toBeLessThanOrEqual(100);

  // Ca 2 bieu do Recharts (tien do du an + hoat dong tai lieu) da render ra khung bieu do that
  // (Recharts luon boc MOI chart trong 1 <div class="recharts-wrapper"> duy nhat) thay vi bi ket
  // o trang thai rong (EmptyState) hoac loi/loading (Spinner). Dung ".recharts-wrapper" thay vi
  // "svg.recharts-surface" - da kiem chung thuc te la Legend cua bieu do "Xu huong hoat dong tai
  // lieu" (2 muc "Tai len"/"Chia se") cung dung lai class "recharts-surface" cho tung icon nho
  // (8x8px), khien dem svg.recharts-surface ra 4 thay vi 2 va gay nham lan/de vo khi so luong muc
  // Legend thay doi - ".recharts-wrapper" la container cap cao nhat, on dinh, dung 1-1 voi so
  // bieu do, khong phu thuoc chi tiet ben trong (Legend, so luong Bar/Area...).
  await expect(page.locator('.recharts-wrapper')).toHaveCount(2, { timeout: 10_000 });
});

// 24/09/2026: Layer 2 Diagnostic drill-down - kiem tra TRUC TIEP endpoint GET /analytics/drill-down
// (khong qua UI) bang chinh accessToken cua phien dang nhap that (zustand persist localStorage key
// 'ecap-auth', xem apps/web/src/stores/auth.store.ts). Chon cach nay (thay vi bam vao 1 thanh SVG
// cua Recharts) vi file nay CO CHU DICH khong assert vao noi dung/vi tri ben trong bieu do (xem chu
// thich dau file) - phan logic MOI/phuc tap nhat (CTE SQL tinh overdue/topAssignee, phan quyen theo
// vai tro) nam o BACKEND, kiem tra truc tiep endpoint xac nhan dung dieu do voi du lieu THAT dang
// chay, khong phu thuoc vao cau truc DOM noi bo cua Recharts (de vo khi thu vien doi phien ban).
test('GET /analytics/drill-down tra ve dung cau truc du lieu cho scope=department voi du lieu that', async ({ page }) => {
  await loginAsAdmin(page);

  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('ecap-auth');
    if (!raw) return null;
    return (JSON.parse(raw)?.state?.accessToken as string | undefined) ?? null;
  });
  expect(token).toBeTruthy();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const deptRes = await page.request.get('/api/v1/departments', { params: { limit: 200 }, headers: authHeaders });
  expect(deptRes.ok()).toBe(true);
  const deptBody = await deptRes.json();
  const departments: Array<{ id: string }> = Array.isArray(deptBody) ? deptBody : deptBody.data;
  expect(departments.length).toBeGreaterThan(0);
  const departmentId = departments[0].id;

  const drillRes = await page.request.get('/api/v1/analytics/drill-down', {
    params: { scope: 'department', scopeId: departmentId, range: '30d' },
    headers: authHeaders,
  });
  expect(drillRes.ok()).toBe(true);
  const result = await drillRes.json();

  expect(result.scope).toBe('department');
  expect(result.scopeId).toBe(departmentId);
  expect(typeof result.totalTasks).toBe('number');
  expect(typeof result.notDoneTasks).toBe('number');
  expect(typeof result.overdueTasks).toBe('number');
  // Ve mat toan hoc: qua han la tap con cua chua xong, chua xong la tap con cua tong - xem CTE
  // trong AnalyticsService.getDrillDown().
  expect(result.notDoneTasks).toBeLessThanOrEqual(result.totalTasks);
  expect(result.overdueTasks).toBeLessThanOrEqual(result.notDoneTasks);
  // topAssignee: hoac null (khong co task nao dang giao trong pham vi), hoac 1 object hop le.
  if (result.topAssignee !== null) {
    expect(typeof result.topAssignee.userId).toBe('string');
    expect(typeof result.topAssignee.notDoneTaskCount).toBe('number');
    expect(result.topAssignee.notDoneTaskCount).toBeGreaterThan(0);
  }
});

// 24/09/2026: bam THAT vao 1 thanh cua bieu do de xac nhan panel mo dung - CHI dung Y-axis tick
// label (van ban that su, on dinh) de chon thanh nao can bam, khong dua vao thu tu/vi tri pixel
// cua <path>/<rect> ben trong Recharts SVG.
test('bam vao 1 thanh trong bieu do Nhan xet AI mo dung panel drill-down', async ({ page }) => {
  test.setTimeout(60_000); // goi API Gemini/Groq that qua Tao tom tat bao cao co the mat vai giay.
  await loginAsAdmin(page);
  await page.goto('/analytics');

  await page.getByRole('button', { name: 'Tạo tóm tắt báo cáo' }).click();
  await expect(page.getByText('Bấm vào 1 thanh (phòng ban/dự án) để xem chi tiết vì sao')).toBeVisible({
    timeout: 30_000,
  });

  // Chon 1 nhan Y-axis KHAC "Toàn tổ chức" (thanh do khong the bam - khong co scopeId cu the).
  // 24/09/2026: doi tuong SVG <text> KHONG phai HTMLElement - .innerText() nem loi "Node is not an
  // HTMLElement", phai dung .textContent() (hoat dong cho ca SVGElement).
  const tickLabels = page.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value');
  const count = await tickLabels.count();
  let targetIndex = -1;
  for (let i = 0; i < count; i++) {
    const text = ((await tickLabels.nth(i).textContent()) ?? '').trim();
    if (text !== 'Toàn tổ chức') {
      targetIndex = i;
      break;
    }
  }
  expect(targetIndex).toBeGreaterThanOrEqual(0);

  // 24/09/2026: sua loi flaky thuc te - Recharts animate thanh luc mount, lan render dau tien co
  // the co <g class="recharts-bar-rectangle"> RONG (chua co <path> con) khien click "outside of
  // the viewport" du da force:true. Cho <path> con THAT SU hien ra (bounding box khac 0) truoc khi
  // bam, thay vi bam thang vao <g> cha.
  const targetShape = page.locator('.recharts-bar-rectangle').nth(targetIndex).locator('path');
  await expect(targetShape).toBeVisible();
  await targetShape.click({ force: true });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText('Tổng công việc', { exact: true })).toBeVisible();
  // exact:true - "Chưa xong"/"Quá hạn" khong dau cung la substring cua cac dong khac trong panel
  // (vd "10 công việc chưa xong" o phan Top nguoi phu trach).
  await expect(dialog.getByText('Chưa xong', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Quá hạn', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Tập trung nhiều nhất ở', { exact: true })).toBeVisible();
});
