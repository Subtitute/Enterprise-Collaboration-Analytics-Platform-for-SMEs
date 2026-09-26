import { defineConfig, devices } from '@playwright/test';

// 28/07/2026: workspace E2E moi (nang cap "chat luong frontend" - xem Technical_Spec.md muc 10,
// truoc day ghi "E2E / contract testing - Ngoai pham vi MVP"). Chay tren trinh duyet Chromium
// THAT, nham thang vao container "web" (Nginx phuc vu SPA + proxy /api/v1, /ws/ toi Gateway) dang
// chay qua Docker Compose - di qua DUNG moi tang trung gian (Nginx, Gateway, tung service) giong
// nguoi dung that, khong phai dev server rieng / mock API.
//
// Dieu kien tien quyet de chay bo test nay (KHONG tu dong hoa trong file nay - xem e2e/README.md):
//   1) `docker compose up -d` (toan bo stack, xem infra/docker-compose.yml) dang chay va healthy.
//   2) `npm run seed:e2e` da chay it nhat 1 lan - cac test dung lai tai khoan Org Admin cua 1 to
//      chuc E2E RIENG (admin@e2e-test.local, xem scripts/seed-e2e.js) thay vi tu dang ky to chuc
//      moi. 25/09/2026: doi tu `npm run seed`/to chuc demo (admin@demo-sme.vn) sang to chuc rieng
//      nay - tranh du lieu rac cac test tu tao tich luy vinh vien vao to chuc dung de demo/trinh
//      bay that, xem e2e/tests/helpers.ts.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // 28/07/2026: cac spec dung CHUNG 1 to chuc/tai khoan seed (vd danh sach thanh vien o
  // admin-members.spec.ts) - chay tuan tu giua cac spec de tranh 2 spec doc/ghi cheo nhau cung
  // luc, du moi spec tu chon ten/email duy nhat (uniqueName() trong helpers.ts) de khong trung.
  fullyParallel: false,
  // 28/07/2026: sua loi thuc te phat hien khi chay that - `fullyParallel: false` CHI dam bao cac
  // test TRONG CUNG 1 file khong chay song song; Playwright mac dinh van chay NHIEU FILE spec
  // song song tren nhieu worker. Vi tat ca spec dung chung 1 IP nguon (may chay test) va Gateway
  // co rate-limit theo IP (Technical_Spec.md muc 8), chay nhieu file cung luc de cong don request
  // vao chung 1 khoa rate-limit, gay 429 ngau nhien cho cac PATCH/POST xen giua (quan sat thuc te:
  // task doi trang thai bi rollback ve trang thai cu do optimistic update trong
  // useUpdateTaskStatus() bi onError hoan tac sau khi PATCH nhan 429). Ep 1 worker duy nhat de
  // TOAN BO cac file spec chay tuan tu, giu tong luu luong request trong pham vi an toan.
  workers: 1,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
