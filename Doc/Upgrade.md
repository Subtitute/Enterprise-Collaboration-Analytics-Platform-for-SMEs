# Nâng cấp dự án — theo dõi hạng mục review toàn diện

Nguồn gốc: 1 đợt review toàn dự án (vai trò giảng viên phản biện, theo `ClaudeRule.md` mục 6) thực hiện ngày 22/08/2026, chia thành 3 nhóm theo mức ưu tiên/chi phí. File này chỉ để **tra cứu nhanh trạng thái từng hạng mục** — chi tiết kỹ thuật đầy đủ (file:line, cách xác minh, số liệu trước/sau) nằm ở `Technical_Spec.md` → mục "Lịch sử thay đổi tài liệu", 2 đoạn ngày 2026-08-22.

---

## Tier 1 — chi phí thấp, ảnh hưởng rõ

**✅ Đã hoàn tất — 22/08/2026**

- [x] `npm audit fix` (13 → 7 lỗ hổng phụ thuộc; 7 lỗ hổng còn lại đòi breaking change, cố ý để lại)
- [x] Xác minh `infra/.env` chưa từng lộ lên Git (rà `git log --all --full-history` toàn bộ lịch sử repo đã push)
- [x] Phân trang thật cho danh sách Dự án và Khách hàng (trước đó cứng `limit: 100`, không xem tiếp được)
- [x] Quản lý focus bàn phím cho `Dropdown.tsx` (menu tài khoản, chuông thông báo, hành động theo dòng)

## Tier 2 — hạng mục lớn hơn (testing, cứng hoá backend, hạ tầng)

**✅ Đã hoàn tất — 22/08/2026**

**Testing**
- [x] Unit test service-level cho `crm-service` (`customers`/`deals`) và `hrm-service` (`attendance`/`leave-requests`) — 2 service từng gần như không có coverage
- [x] 3 e2e spec mới (CRM, HRM, Analytics) — 3 module trước đây chưa có bất kỳ coverage Playwright nào
- [x] `coverageThreshold` enforced cho 8 service backend + 3 package dùng chung (đặt theo số liệu đo thực, làm sàn chặn thụt lùi); `apps/web` chỉ bật báo cáo, không đặt ngưỡng (coverage ~10%, chưa đủ ý nghĩa để chặn CI); CI đổi sang chạy `npm run test:coverage`

**Cứng hoá backend**
- [x] `/health` của cả 8 service chuyển từ liveness-only sang `@nestjs/terminus` (ping thật Postgres/TimescaleDB/MongoDB/Redis)
- [x] Chặn brute-force đăng nhập theo tài khoản (5 lần sai/15 phút), tách riêng khỏi rate-limit theo IP đã có
- [x] Correlation ID xuyên suốt Gateway → 7 service, có trong cả log lỗi lẫn body response

**Hạ tầng**
- [x] Alertmanager + 4 luật cảnh báo (service mất kết nối, lỗi 5xx cao, độ trễ p95 cao, Kafka lag cao) — đã xác minh sống, không chỉ cấu hình đọc được
- [x] Ghim 6 image trước dùng tag `:latest` trôi sang đúng digest sha256
- [x] `scripts/backup.js`/`scripts/restore.js` cho cả 8 nguồn dữ liệu (5 Postgres + TimescaleDB + MongoDB + MinIO) — đã xác minh bằng 1 vòng backup → restore thật
- [x] Sửa lại mô tả "cách ly qua `internal-net`" ở README.md cho đúng bản chất (không công bố port ra host, không phải cô lập mạng)

*(2 lỗi thật phát hiện ngoài kế hoạch trong lúc làm Tier 2, đã sửa luôn: `ioredis` treo vô thời hạn khi mất kết nối thay vì từ chối ngay, ảnh hưởng cả health check lẫn `rate-limit.middleware.ts` — đã bọc timeout ở mọi nơi dùng.)*

## Tier 3 — hướng phát triển hợp lý, không nên vội

**⏳ Chưa triển khai — cố ý chưa làm, ghi nhận là phạm vi tương lai**

- [ ] Audit trail / soft-delete — hiện mọi thao tác xoá đều là hard delete trên toàn dự án
- [ ] Mobile (`ecap-mobile`): chưa có push notification (chỉ polling), chưa có offline cache, chỉ build Android (không có thư mục `ios/`), coverage gần như 0 (2 test), chưa từng chạy trên thiết bị thật
- [ ] Nâng cấp TypeORM 0.3 → 1.0 — là 1 dự án migration thật sự (breaking change), **không làm trước khi bảo vệ đồ án**
- [ ] Nâng cấp React 18→19, Vite 5→8, ESLint 8→10 — mỗi thư viện lệch 1-3 major, chấp nhận được ở quy mô đồ án, chỉ đáng quan tâm nếu dự án còn tiếp tục sau khi tốt nghiệp

---

## Lịch sử thay đổi file này

- **2026-08-22** — Khởi tạo file, ghi nhận trạng thái Tier 1 và Tier 2 (đã hoàn tất, xác minh sống) cùng Tier 3 (cố ý chưa làm, hướng phát triển) từ đợt review toàn dự án cùng ngày.
