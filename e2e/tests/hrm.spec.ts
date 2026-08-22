import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { loginAsAdmin, uniqueName } from './helpers';

// 22/08/2026: HRM-lite (cham cong + nghi phep) chua co e2e coverage nao - bo sung tai day.
//
// Dung DUY NHAT tai khoan Org Admin demo (admin@demo-sme.vn) cho ca 2 luong, KHONG dung tai khoan
// Employee rieng: DEFAULT_ROLE_PERMISSIONS.ORG_ADMIN = Object.values(PERMISSIONS)
// (packages/common-dto/src/enums/permission.enum.ts) nen Org Admin co CA 5 quyen HRM
// (ATTENDANCE_CHECKIN/VIEW, LEAVE_REQUEST_CREATE/VIEW/APPROVE) - tu cham cong cho chinh minh VA tu
// duyet duoc yeu cau nghi phep cua chinh minh deu hop le (LeaveRequestsService.decide() chi kiem
// tra status hien tai la PENDING, KHONG cam approverId === userId). Nhan vien do seed.js tao
// (scripts/seed.js, mang EMPLOYEES) co email hau to timestamp ngau nhien MOI LAN seed va khong co
// cach nao tra cuu lai tu ben ngoai script, nen KHONG phu hop de dung lam tai khoan on dinh cho
// e2e; check-in/check-out cung khong gan voi "ho so nhan vien" nao ca (chi gan voi userId dang
// dang nhap - AttendancePage.tsx/hooks.ts), nen tai khoan Org Admin dung tot y het 1 Employee.
//
// Camera: CheckInCamera.tsx dung navigator.mediaDevices.getUserMedia() that (component camera dau
// tien trong repo, xac nhan qua grep) - can bat --use-fake-device-for-media-stream (cung cap 1
// "camera" gia lap khong can phan cung that) + --use-fake-ui-for-media-stream (tu dong chap nhan
// prompt cap quyen camera cua Chromium) khi khoi dong trinh duyet, cong voi permissions: ['camera']
// de Playwright cap quyen truoc (khong qua hop thoai that). Thay doi launchOptions qua test.use()
// o cap file se khien Playwright dung 1 worker rieng cho file nay - khong vi pham gia dinh
// workers:1 cua playwright.config.ts (van chi 1 worker CHAY tai 1 thoi diem).
//
// Vi tri GPS: getCurrentLocationSoft() (CheckInCamera.tsx) CO Y KHONG bao gio throw/chan luong
// check-in du xin quyen that bai - chi la tin hieu THEM cho huy hieu "on-site"/"off-site"
// (AttendanceService.computeIsOnSite() o backend). Van cap quyen geolocation + toa do gia lap o day
// de luong chay dut khoat/nhanh (khong phai doi 5s timeout noi bo cua getCurrentLocationSoft() khi
// trinh duyet tu choi ngam quyen chua duoc cap), nhung CO Y khong assert cu the on-site hay
// off-site vi ban kinh van phong that dang cau hinh o backend, khong biet truoc tu test.
test.use({
  permissions: ['camera', 'geolocation'],
  geolocation: { latitude: 21.0285, longitude: 105.8048 },
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

/** Ngay 'YYYY-MM-DD' cach hom nay `days` ngay - dung dien vao <input type="date">. */
function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Di qua modal "Chụp ảnh chấm công" (dung chung cho ca check-in va check-out) - doi camera gia lap
 * san sang ("Chụp ảnh" tu disabled sang enabled) roi chup + xac nhan. Modal tu dong dong sau khi
 * mutation check-in/check-out thanh cong (setCameraMode(null) trong AttendancePage.tsx), khong can
 * bam nut dong rieng.
 */
async function confirmAttendancePhoto(page: Page) {
  const dialog = page.getByLabel('Chụp ảnh chấm công');
  const captureButton = dialog.getByRole('button', { name: 'Chụp ảnh', exact: true });
  await expect(captureButton).toBeEnabled({ timeout: 10_000 });
  await captureButton.click();
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('cham cong: check-in va check-out trong ngay, trang thai cap nhat dung', async ({ page }) => {
  await loginAsAdmin(page);

  // 22/08/2026: sua loi thuc te phat hien khi chay lai (lan 2 trong CUNG 1 ngay, sau khi hom truoc
  // da check-in+check-out xong): AttendancePage duoc lazy-load (React.lazy() trong App.tsx) VA
  // todayRecord tinh truc tiep tu attendanceQuery.data (KHONG doi isLoading, xem AttendancePage.tsx
  // dong 52) - trong khoang tu luc mount toi khi attendanceQuery.data VE THAT (data con undefined),
  // todayRecord tam thoi la undefined nen nut "Check-in" LOE ra du that ra hom nay da cham cong roi.
  // Cho "1 trong 3 trang thai" xuat hien (nhu ban dau sua) KHONG du: neu trang thai that la "da
  // xong hom nay", nut "Check-in" gia (tu flash) van la trang thai KHOP DAU TIEN voi ".or()" (xuat
  // hien truoc ca khi du lieu that ve), khien assertion pass tren trang thai SAI va click() ngay sau
  // do bam vao 1 nut sap bien mat (React se go bo no ngay khi du lieu that ve) - Playwright cho
  // actionability tren phan tu da bi detach mai khong duoc, treo den khi test timeout (thay vi loi
  // ro rang). Neo THANG vao response API that (GET .../attendance/me) thay vi doan qua trang thai
  // DOM trung gian - loai bo hoan toan cua so flash noi tren vi luc nay chac chan da co du lieu that.
  const attendanceMeLoaded = page.waitForResponse((res) => res.request().method() === 'GET' && res.url().includes('/attendance/me'));
  await page.goto('/attendance');
  await attendanceMeLoaded;

  const checkInButton = page.getByRole('button', { name: 'Check-in', exact: true });
  const checkOutButton = page.getByRole('button', { name: 'Check-out', exact: true });
  const doneBadge = page.getByText('Đã hoàn tất hôm nay');

  // Response da ve nhung React co the can 1 nhip render nua de commit state - doi 1 trong 3 trang
  // thai loai tru nhau THAT SU xuat hien (expect().toBeVisible() co retry/poll) truoc khi doc trang
  // thai bang isVisible() (chup nhanh, khong retry) ben duoi.
  await expect(checkInButton.or(checkOutButton).or(doneBadge)).toBeVisible();

  // To chuc demo dung LAI cung 1 tai khoan Org Admin xuyen suot nhieu lan seed/chay e2e (script
  // idempotent - xem scripts/seed.js) nen NEU test nay da chay truoc do trong CUNG ngay hom nay,
  // admin co the da check-in (hoac da check-in+check-out) roi - kiem tra trang thai thuc te thay vi
  // gia dinh luon bat dau tu "chua cham cong" de test khong flaky khi chay lai nhieu lan/ngay.
  if (await checkInButton.isVisible()) {
    await checkInButton.click();
    await confirmAttendancePhoto(page);
    await expect(page.getByText('Đã vào làm lúc')).toBeVisible();
  }

  if (await checkOutButton.isVisible()) {
    await checkOutButton.click();
    await confirmAttendancePhoto(page);
  }

  await expect(doneBadge).toBeVisible();

  // Lich su chinh minh phai co it nhat 1 dong (dong cua hom nay, vua tao/co san).
  await expect(page.getByText('Chưa có lịch sử chấm công')).toBeHidden();
});

test('nghi phep: tao yeu cau moi va tu duyet (Org Admin co quyen leave_request:approve)', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/leave-requests');

  const reason = uniqueName('E2E nghi phep');
  const startDate = isoDateOffset(10);
  const endDate = isoDateOffset(11);

  await page.getByRole('button', { name: 'Yêu cầu mới', exact: true }).click();
  const newRequestDialog = page.getByLabel('Tạo yêu cầu nghỉ phép');
  await newRequestDialog.getByLabel('Ngày bắt đầu').fill(startDate);
  await newRequestDialog.getByLabel('Ngày kết thúc').fill(endDate);
  await newRequestDialog.getByLabel('Lý do').fill(reason);

  // 22/08/2026: sua loi thuc te phat hien khi chay chung ca bo e2e (khong flaky khi chay rieng file
  // nay - chi lo ra khi he thong da xu ly nhieu request/event nen tren tu cac spec khac chay truoc):
  // cho `toBeHidden()`/dong "Chờ duyệt" xuat hien THUAN theo thoi gian UI se doi khi mutation tao yeu
  // cau + lan invalidateQueries ke tiep cham hon binh thuong. Neo THANG vao response POST that cua
  // API (mirror cach da sua o test cham cong phia tren trong file nay) truoc khi doc trang thai UI.
  const createResponse = page.waitForResponse(
    (res) => res.request().method() === 'POST' && res.url().includes('/leave-requests') && res.status() === 201,
  );
  await newRequestDialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
  await createResponse;
  await expect(newRequestDialog).toBeHidden();

  // Yeu cau vua tao phai xuat hien trong "Yêu cầu của tôi" voi trang thai "Chờ duyệt".
  const myRow = page.locator('.rounded-lg', { hasText: reason });
  await expect(myRow.getByText('Chờ duyệt', { exact: true })).toBeVisible();

  // 22/08/2026: khong cam self-approve o backend (LeaveRequestsService.decide() chi kiem tra
  // status PENDING, khong so sanh approverId voi userId) nen yeu cau cua chinh Org Admin cung xuat
  // hien trong khoi "Chờ duyệt" toan to chuc (findAll() khong loai tru nguoi tao). Loc rieng dong
  // trong khoi cho duyet (co nut "Duyệt") de tranh nham voi dong cung reason ben "Yêu cầu của tôi".
  const pendingRow = page
    .locator('.rounded-lg', { hasText: reason })
    .filter({ has: page.getByRole('button', { name: 'Duyệt', exact: true }) });

  // 22/08/2026: sua tiep loi thuc te lan 2 (van flaky sau lan sua dau, chi doi PATCH .../approve):
  // useApproveLeaveRequest() (features/hrm/hooks.ts) invalidateQueries({queryKey: ['leave-requests']})
  // - khop TIEN TO nen kich hoat lai CA HAI query dang mo tren cung trang ("Yêu cầu của tôi" VA
  // "Cho duyet toan to chuc") gan nhu dong thoi, nhung do la 2 request GET rieng biet chay song song
  // sau khi PATCH thanh cong - request nao ve truoc khong dam bao. Doi PATCH xong roi doc UI ngay co
  // the trung dung luc GET .../leave-requests/me (nguon du lieu cua `myRow`) CHUA ve kip, du GET
  // .../leave-requests?status=PENDING (nguon cua `pendingRow`) da ve du de assertion truoc do pass.
  // Doi ca 2 response that (PATCH + GET .../leave-requests/me ke tiep) truoc khi doc UI, thay vi chi
  // 1 trong 2 - loai tru hoan toan khoang ho giua 2 request song song noi tren.
  const approveResponse = page.waitForResponse(
    (res) => res.request().method() === 'PATCH' && res.url().includes('/approve') && res.status() === 200,
  );
  const myListRefetched = page.waitForResponse(
    (res) => res.request().method() === 'GET' && res.url().includes('/leave-requests/me'),
  );
  await pendingRow.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await approveResponse;
  await myListRefetched;
  await expect(pendingRow).toBeHidden();

  // Sau khi duyet, dong trong "Yêu cầu của tôi" phai chuyen sang "Đã duyệt".
  await expect(myRow.getByText('Đã duyệt', { exact: true })).toBeVisible();
});
