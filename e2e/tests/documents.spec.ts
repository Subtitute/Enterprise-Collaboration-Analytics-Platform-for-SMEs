import { test, expect } from '@playwright/test';
import { loginAsAdmin, uniqueName } from './helpers';

// 28/07/2026: luong "vang" Tai lieu - tai len 1 tep, mo xem truc tiep ("Xem tệp", mo tab moi) va
// chia se voi 1 thanh vien khac. Diem quan trong nhat can bao ve o day la hanh vi mo tab moi: fix
// truoc do (22/07/2026) chuyen window.open() ra khoi onSuccess cua mutation vao thang trong onClick
// dong bo, vi trinh duyet chi cho phep mo tab moi trong pham vi 1 user-gesture dong bo - neu ai do
// vo tinh sua lai thanh goi window.open() sau 1 await, popup blocker se lai am tham chan no va CHI
// e2e test that (dieu khien trinh duyet that, co popup blocker that) moi phat hien duoc dieu nay -
// unit test (jsdom) khong the mo phong hanh vi popup blocker cua trinh duyet that.
test('tai len tep, mo xem truc tiep (khong bi popup blocker chan) va chia se voi thanh vien khac', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/documents');

  // 28/07/2026: dung PNG (khong phai .txt) - allowed-mime-types.ts (Document Service) BUOC
  // disposition=attachment cho moi mime khong xac minh duoc bang magic-byte (text/plain, text/csv
  // - fix bao mat cung dot review nay), bat ke client yeu cau inline hay khong; dung .txt se khien
  // buoc "mo xem truc tiep" ben duoi LUON that bai (trinh duyet tai file thay vi dieu huong) - DUNG
  // hanh vi, khong phai loi. PNG la 1 trong cac dinh dang co magic-byte duoc xac minh nen van ho
  // tro dung inline nhu thiet ke.
  const fileName = `${uniqueName('e2e-test').replace(/\s+/g, '-')}.png`;
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  await page.getByRole('button', { name: 'Tải lên', exact: true }).click();
  // 28/07/2026: nut "Tai len" trong modal TRUNG chu voi nut mo modal o dau trang (van con tren
  // DOM khi modal dang mo) - can scope theo dialog (Modal.tsx gan aria-label = title cho dialog)
  // de khong bam nham nut mo modal lan 2.
  const uploadDialog = page.getByLabel('Tải lên tài liệu');
  await uploadDialog.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await uploadDialog.getByRole('button', { name: 'Tải lên', exact: true }).click();

  const fileRow = page.getByRole('row', { name: new RegExp(fileName) });
  await expect(fileRow).toBeVisible();

  // "Xem tệp" (click ten tep) phai mo 1 tab/popup MOI thanh cong, khong bi chan.
  // 28/07/2026: openFile() mo tab TRONG (about:blank) dong bo truoc, roi gan location.href = url
  // that SAU KHI mutation (goi API lay presigned URL) hoan tat - waitForLoadState() cu bi false
  // positive vi about:blank tu no "domcontentloaded" gan nhu ngay lap tuc, truoc khi dieu huong
  // that xay ra. Doi URL thuc su roi khoi about:blank (bat dau bang http) moi la kiem tra dung.
  const popupPromise = page.waitForEvent('popup');
  await fileRow.getByText(fileName, { exact: true }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/^http/, { timeout: 15_000 });
  expect(popup.url()).not.toBe('about:blank');
  await popup.close();

  // Chia se voi 1 thanh vien bat ky khac trong to chuc demo.
  // 28/07/2026: cuon hang nay ve giua man hinh truoc khi mo dropdown - Dropdown.tsx dinh vi panel
  // theo toa do VIEWPORT (position: fixed, getBoundingClientRect() cua nut trigger luc bam) va
  // KHONG tu kiem tra/lat lai neu khong du cho ben duoi; to chuc demo sau nhieu lan seed tich luy
  // rat nhieu thu muc/tep nen bang tep thuc nam gan cuoi trang dai - neu khong chu dong cuon, panel
  // co the render nam ngoai viewport (khong bam duoc "Chia sẻ" du element ve mat DOM van "visible").
  await fileRow.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await fileRow.getByRole('button', { name: 'Tùy chọn tệp' }).click();
  await page.getByRole('button', { name: 'Chia sẻ' }).click();
  const shareUserSelect = page.getByLabel('Chia sẻ với');
  // 28/07/2026: doi danh sach thanh vien (useOrgUsersQuery) tai xong truoc khi chon - ngay sau khi
  // modal mo, <Select> chi co dung 1 option placeholder "Chọn thành viên…", selectOption({index:1})
  // goi qua som se khong chon duoc gi (option chua ton tai) khien nut "Chia sẻ" o duoi giu nguyen
  // trang thai disabled (thieu userId) va click() phia sau bi timeout cho toi khi actionable.
  await expect(shareUserSelect.locator('option')).not.toHaveCount(1);
  await shareUserSelect.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  await expect(page.getByText(/Đã chia sẻ/i)).toBeVisible();
});
