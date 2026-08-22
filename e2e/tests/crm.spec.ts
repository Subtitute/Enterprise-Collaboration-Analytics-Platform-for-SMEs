import { test, expect } from '@playwright/test';
import { loginAsAdmin, uniqueName } from './helpers';

// 22/08/2026: luong "vang" CRM (Khach hang & Deal pipeline) - module nay truoc do CHUA co bat ky
// e2e coverage nao (khac voi auth/documents/projects-and-tasks/admin-members/search). Tao khach
// hang moi, mo chi tiet, tao deal cho khach hang do, roi keo-tha deal tu cot "Mới" sang "Đã liên hệ"
// tren Kanban pipeline va xac nhan cot dich phan anh dung.
//
// Khac voi trang thai Cong viec (projects-and-tasks.spec.ts) - noi doi trang thai qua <select> trong
// TaskDetailModal - giai doan (stage) cua Deal CHI doi duoc qua keo-tha tren Kanban (xem
// DealDetailModal.tsx: "Doi giai doan (stage) CHI thuc hien qua keo-tha tren Kanban ... tranh 2 noi
// cung sua 1 gia tri theo 2 co che khac nhau"), khong co <select> nao thay the. @hello-pangea/dnd
// dung sensor CHUOT (mousedown/mousemove/mouseup) chu khong dung HTML5 Drag-and-Drop API goc, va can
// vuot qua 1 nguong di chuyen toi thieu ("sloppy click threshold") truoc khi coi la bat dau keo -
// Locator.dragTo() di chuyen thang 1 buoc toi dich nen KHONG kich hoat duoc trang thai DRAGGING cua
// thu vien nay tren thuc te (da thu truoc khi chuyen sang mo phong page.mouse thu cong ben duoi).
test('tao khach hang, tao deal va keo-tha deal sang giai doan moi tren Kanban', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/customers');

  const customerName = uniqueName('Khach hang E2E');
  // 22/08/2026: exact:true - khi danh sach khach hang dang rong, EmptyState cung co 1 nut "Thêm
  // khách hàng mới" chua "Khách hàng mới" nhu 1 chuoi con (mirror ly do exact:true cua nut "Công
  // việc mới" trong projects-and-tasks.spec.ts) - khong exact se bam nham/mo hon 1 phan tu.
  await page.getByRole('button', { name: 'Khách hàng mới', exact: true }).click();
  const newCustomerDialog = page.getByRole('dialog', { name: 'Thêm khách hàng mới' });
  await newCustomerDialog.getByLabel('Tên khách hàng').fill(customerName);
  // Scope theo dialog + exact:true - nut "Thêm khách hàng mới" cua EmptyState (neu co) van con tren
  // DOM phia sau modal va chua "Thêm khách hàng" nhu 1 chuoi con.
  await newCustomerDialog.getByRole('button', { name: 'Thêm khách hàng', exact: true }).click();

  const customerCard = page.getByText(customerName, { exact: true });
  await expect(customerCard).toBeVisible();
  await customerCard.click();
  await page.waitForURL('**/customers/**');

  const dealTitle = uniqueName('Deal E2E');
  // 22/08/2026: exact:true - khach hang vua tao chua co deal nao nen EmptyState cung co 1 nut "Tạo
  // deal mới" chua "Deal mới" nhu 1 chuoi con, cung ly do nhu tren.
  await page.getByRole('button', { name: 'Deal mới', exact: true }).click();
  const newDealDialog = page.getByRole('dialog', { name: 'Tạo deal mới' });
  await newDealDialog.getByLabel('Tiêu đề').fill(dealTitle);
  await newDealDialog.getByRole('button', { name: 'Tạo deal', exact: true }).click();

  const dealCard = page.getByText(dealTitle, { exact: true });
  await expect(dealCard).toBeVisible();

  // Keo deal tu cot "Mới" (giai doan mac dinh khi tao) sang "Đã liên hệ" - day la 1 lan chuyen giai
  // doan hop le (DEAL_STAGE_TRANSITIONS trong packages/common-dto cho phep NEW -> bat ky giai doan
  // active/dong nao khac). Dung diem toa do cua chinh khung Droppable (data-rfd-droppable-id do
  // @hello-pangea/dnd tu gan) lam dich tha, thay vi doan CSS ước luong, de dam bao tha dung vung.
  const dropZone = page.locator('[data-rfd-droppable-id="CONTACTED"]');
  const source = await dealCard.boundingBox();
  const target = await dropZone.boundingBox();
  if (!source || !target) throw new Error('Khong lay duoc toa do de keo-tha deal tren Kanban');

  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  const endX = target.x + target.width / 2;
  const endY = target.y + Math.min(target.height / 2, 60);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Di chuyen 1 khoang nho truoc (vuot nguong "sloppy click") de @hello-pangea/dnd dang ky bat dau
  // keo, cho 1 nhip de sensor kip cap nhat trang thai DRAGGING, roi moi keo tiep qua nhieu buoc nho
  // toi cot dich - keo thang 1 buoc lon tu diem bat dau toi dich (nhu Locator.dragTo()) khong du de
  // thu vien nhan dien day la 1 thao tac keo-tha hop le.
  await page.mouse.move(startX + 10, startY + 10, { steps: 5 });
  await page.waitForTimeout(200);
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.waitForTimeout(200);
  await page.mouse.up();

  // Cot Kanban co tieu de "Đã liên hệ" gio phai chua dung deal vua keo sang.
  const contactedColumn = page.locator('div.rounded-xl:has-text("Đã liên hệ")');
  await expect(contactedColumn.getByText(dealTitle, { exact: true })).toBeVisible();
});
