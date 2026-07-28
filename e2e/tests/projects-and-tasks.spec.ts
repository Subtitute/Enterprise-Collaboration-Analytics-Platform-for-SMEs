import { test, expect } from '@playwright/test';
import { loginAsAdmin, uniqueName } from './helpers';

// 28/07/2026: luong "vang" Du an & Cong viec - tao du an, tao cong viec, mo chi tiet cong viec,
// doi trang thai qua Select (tuong duong nghiep vu voi keo-tha Kanban nhung on dinh hon cho E2E
// vi khong phu thuoc toa do chuot/thu vien @hello-pangea/dnd), xac nhan cot Kanban "Hoan thanh"
// phan anh dung cong viec vua doi trang thai.
test('tao du an, tao cong viec, doi trang thai va thay cot Kanban cap nhat dung', async ({ page }) => {
  await loginAsAdmin(page);

  const projectName = uniqueName('Du an E2E');
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Dự án mới' }).click();
  await page.getByLabel('Tên dự án').fill(projectName);
  await page.getByRole('button', { name: 'Tạo dự án', exact: true }).click();

  const projectCard = page.getByText(projectName, { exact: true });
  await expect(projectCard).toBeVisible();
  await projectCard.click();
  await page.waitForURL('**/projects/**');

  const taskTitle = uniqueName('Cong viec E2E');
  // 28/07/2026: exact:true - du an moi tao rong nen EmptyState cung co 1 nut "Tạo công việc mới"
  // (chua "Công việc mới" nhu 1 chuoi con), khong exact se bam nham/mo hon 1 phan tu.
  await page.getByRole('button', { name: 'Công việc mới', exact: true }).click();
  await page.getByLabel('Tiêu đề').fill(taskTitle);
  await page.getByRole('button', { name: 'Tạo công việc', exact: true }).click();

  const taskCard = page.getByText(taskTitle, { exact: true });
  await expect(taskCard).toBeVisible();

  // Mo chi tiet cong viec, doi trang thai "Can lam" -> "Dang lam" -> "Hoan thanh", roi dong modal.
  // 28/07/2026: sua loi GIA DINH SAI trong chinh test nay (khong phai loi ung dung) - phat hien
  // qua debug truc tiep response mang: backend co chu dich CHAN chuyen thang TODO -> DONE (tra ve
  // 400 "Khong the chuyen trang thai cong viec tu TODO sang DONE", dung theo state machine da dinh
  // nghia - xem task-status.util.ts), buoc phai di qua DOING truoc. Test truoc do bo qua buoc nay.
  // Scope nut "Đóng" theo dialog (Modal.tsx gan aria-label = title = ten cong viec) - cac toast
  // thanh cong tich luy qua tung buoc cung co nut dong ten "Đóng", khong scope se bam nham.
  await taskCard.click();
  const taskDialog = page.getByRole('dialog', { name: taskTitle });
  const statusSelect = taskDialog.getByLabel('Trạng thái');
  await statusSelect.selectOption({ label: 'Đang làm' });
  // 28/07/2026: doi cap nhat optimistic (useUpdateTaskStatus - onMutate ghi thang vao cache) phan
  // anh xong trong DOM truoc khi doi tiep - 2 lan selectOption ban dau doi khi flaky (thinh thoang
  // that bai lan dau, qua o lan retry) do goi lien tiep qua nhanh.
  await expect(statusSelect).toHaveValue('DOING');
  await statusSelect.selectOption({ label: 'Hoàn thành' });
  await taskDialog.getByRole('button', { name: 'Đóng' }).click();

  // Cot Kanban co tieu de "Hoàn thành" gio phai chua dung cong viec nay.
  const doneColumn = page.locator('div.rounded-xl:has-text("Hoàn thành")');
  await expect(doneColumn.getByText(taskTitle, { exact: true })).toBeVisible();
});
