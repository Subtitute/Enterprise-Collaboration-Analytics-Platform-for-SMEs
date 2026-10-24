# Nâng cấp dự án — theo dõi hạng mục review toàn diện

> Trạng thái: **HỖN HỢP — TIER 1–2 VÀ TIER 5 ĐÃ TRIỂN KHAI, TIER 3–4 CHƯA TRIỂN KHAI** — Tier 1 (chi
> phí thấp) và Tier 2 (testing/hạ tầng) đã hoàn tất, xác minh sống từ 22/08/2026; Tier 5 (Chatbot nội
> bộ RAG + tool-calling) đã triển khai và xác minh sống 24/10/2026 (`Technical_Spec.md` §23); Tier 3,
> Tier 4 (Analytics nâng cao) là các hạng mục cố ý để dành cho tương lai. Chi tiết lịch sử đầy đủ:
> xem `RevisionHistory.md`.

Nguồn gốc: 1 đợt review toàn dự án (vai trò giảng viên phản biện, theo `ClaudeRule.md` mục 6) thực hiện ngày 22/08/2026, chia thành 3 nhóm theo mức ưu tiên/chi phí. File này chỉ để **tra cứu nhanh trạng thái từng hạng mục** — chi tiết kỹ thuật đầy đủ (file:line, cách xác minh, số liệu trước/sau) nằm ở `Technical_Spec.md` → mục "Lịch sử thay đổi tài liệu", 2 đoạn ngày 22/08/2026.

**Xem thêm:** `Doc/RevisionHistory.md` gộp TOÀN BỘ dòng thời gian rà soát/sửa lỗi của dự án (kể cả trước và sau 3 Tier ở đây) thành 1 file duy nhất — bao gồm đợt rà soát ngày 22/08/2026 gốc ra 3 tier này, VÀ đợt rà soát tiếp theo ngày 24/08/2026 (độc lập với 3 tier, nhắm riêng vào lỗi có thể treo/sập hệ thống — 7 lỗi Nghiêm trọng + ~13 lỗi Nghiêm trọng vừa, tất cả đã sửa).

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

## Tier 4 — Analytics nâng cao, phần chưa triển khai của đợt 24/09/2026

**⏳ Chưa triển khai — cố ý chưa làm, ghi nhận là phạm vi tương lai** (xem `Technical_Spec.md` §19 để biết phần ĐÃ triển khai cùng đợt: Diagnostic drill-down, Anomaly Detection, Recommendation Engine, nhập Excel hàng loạt)

- [ ] **Layer 4 — Predictive/Forecasting:** dự báo xu hướng KPI (vd số công việc hoàn thành tuần tới) — không triển khai NeuralForecast/mô hình deep learning như định hướng ban đầu vì dữ liệu demo quá nhỏ để mô hình có ý nghĩa; nếu làm sau này nên bắt đầu bằng phương pháp thống kê nhẹ (vd trung bình trượt/hồi quy tuyến tính đơn giản) trước khi cân nhắc mô hình phức tạp hơn.
- [ ] **Layer 6 — What-if Simulation:** mô phỏng "nếu thay đổi X thì Y đổi thế nào" (vd thêm người vào phòng ban thì tỷ lệ hoàn thành đổi ra sao) — cần Layer 4 làm nền trước.
- [ ] **Demo Data Scenario Generator:** tính năng cho Org Admin chọn 1 trong nhiều kịch bản demo dựng sẵn (vd "đội nhóm đang quá tải", "phòng ban hoạt động tốt") kèm 1 seed số để sinh dữ liệu tái lập được — hiện dữ liệu demo vẫn dựa vào `scripts/seed.js` cố định, không có giao diện chọn kịch bản.

## Tier 5 — Chatbot nội bộ (RAG + tool-calling lai), kế hoạch 24/10/2026, triển khai 24/10/2026

**✅ Đã triển khai, xác minh sống 24/10/2026** (xem `Technical_Spec.md` §23 — §23.2 ghi rõ các điểm
khác kế hoạch ban đầu, §23.8 ghi kết quả kiểm thử chéo và giới hạn đã biết)

- [x] Hội thoại + permission `chatbot:use` — **khác kế hoạch:** đặt trong module `chatbot/` của `analytics-service` (3 bảng mới trong TimescaleDB), KHÔNG tạo `apps/chatbot-service` riêng để tiết kiệm RAM
- [x] RAG thật cho Tài liệu đặt trong `document-service` (giữ logic phân quyền tài liệu đúng 1 nơi), endpoint `POST /files/search-chunks` — **khác kế hoạch:** vector lưu dạng mảng số thực, so cosine trong bộ nhớ (không `pgvector`); lập chỉ mục bằng job quét định kỳ (không qua sự kiện Kafka)
- [x] Tool-calling cho dữ liệu "sống" (5 tool: `search_documents`, `get_my_tasks`, `get_project_status`, `get_my_leave_balance`, `get_my_attendance_today`) — gọi API Gateway bằng JWT người hỏi
- [x] Nhúng văn bản qua Gemini `gemini-embedding-001` (`text-embedding-004` đã bị Google ngừng), sinh câu trả lời qua `gemini-flash-lite-latest`, dự phòng Groq
- [x] Frontend: nút chat nổi toàn app, không streaming
- [x] Trần 30 câu hỏi/người/ngày (GMT+7)
- [x] Giới hạn tần suất tìm kiếm tài liệu theo người dùng (40 lần/10 phút, bổ sung sau rà soát cuối 24/10/2026)
- [ ] Còn để ngỏ: ngưỡng liên quan tốt hơn 0,6, phân trang danh sách tin nhắn, bộ lọc "giao cho tôi" phía `project-task-service` cho `get_my_tasks`

---

## Lịch sử thay đổi file này

- **22/08/2026** — Khởi tạo file, ghi nhận trạng thái Tier 1 và Tier 2 (đã hoàn tất, xác minh sống) cùng Tier 3 (cố ý chưa làm, hướng phát triển) từ đợt review toàn dự án cùng ngày.
- **24/09/2026** — Bổ sung Tier 4: phần cố ý chưa làm của đợt nâng cấp Analytics 24/09/2026 (Layer 4 Forecasting, Layer 6 What-if Simulation, Demo Data Scenario Generator) — xem `Technical_Spec.md` §19 cho phần đã triển khai cùng đợt.
- **24/10/2026** — Bổ sung Tier 5: kế hoạch Chatbot nội bộ (RAG + tool-calling lai), chốt sau khi bàn bạc trực tiếp trước khi code — xem `Technical_Spec.md` §23 cho đặc tả kỹ thuật đầy đủ.
- **24/10/2026 (tiếp)** — Tier 5 chuyển sang đã triển khai: đánh dấu hoàn thành từng hạng mục, ghi rõ các điểm khác kế hoạch (không service mới, không `pgvector`, job quét định kỳ) và các hạng mục còn để ngỏ.
