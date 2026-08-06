# E2E (Playwright)

Bộ kiểm thử end-to-end chạy trên trình duyệt Chromium thật, nhắm thẳng vào container `web` (SPA + Nginx proxy) của stack Docker đang chạy - khác với các test Jest ở từng service (unit/integration, chạy trên DB test riêng, không cần trình duyệt).

## Điều kiện tiên quyết

1. Toàn bộ stack đang chạy và healthy: `docker compose -f ../infra/docker-compose.yml --env-file ../infra/.env up -d`
2. Đã seed dữ liệu demo ít nhất 1 lần (các test dùng lại tài khoản Org Admin `admin@demo-sme.vn`): `npm run seed` (chạy ở thư mục gốc repo).

## Chạy test

```bash
npm install          # 1 lần, cài @playwright/test
npx playwright install chromium --with-deps   # 1 lần, tải trình duyệt Chromium cho Playwright
npm run test:e2e            # chạy toàn bộ
npm run test:e2e:ui         # chế độ UI trực quan, hợp khi debug từng bước
npm run test:e2e:report     # mở lại báo cáo HTML của lần chạy gần nhất
```

Mặc định nhắm vào `http://localhost` (cổng host của container `web`). Đổi bằng biến môi trường `E2E_BASE_URL` nếu cần (vd chạy Playwright từ máy khác, hoặc nhắm vào `vite preview`).

## Phạm vi và giới hạn có chủ đích

- Các test **không dọn dẹp dữ liệu đã tạo** (dự án/công việc/tệp/thành viên được mời qua các flow) - mỗi test tự đặt tên/email duy nhất (hàm `uniqueName()`/timestamp trong `tests/helpers.ts`) để không trùng lặp giữa các lần chạy, nhưng dữ liệu sẽ tích luỹ dần trong tổ chức demo qua thời gian. Chấp nhận được vì đây là môi trường demo/đồ án, không phải production - đơn giản hoá đáng kể so với xây dựng cơ chế dọn dẹp/rollback đầy đủ.
- Chỉ bao phủ **luồng vàng** (golden path) của từng module, không phải mọi nhánh lỗi/cạnh biên - mục tiêu là mạng lưới bắt regression cho các luồng người dùng chính, không thay thế cho unit/integration test đã có ở từng service.
- Chưa tích hợp vào pipeline CI (`Technical_Spec.md` mục 11) vì CI hiện tại không dựng stack Docker đầy đủ (không có môi trường staging) - chạy thủ công hoặc từ máy phát triển có stack đang bật.