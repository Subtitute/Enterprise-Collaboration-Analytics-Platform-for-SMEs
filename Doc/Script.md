# Script.md — Kế hoạch phối hợp nhóm 3 người

> Tài liệu mô tả cách nhóm 3 người phối hợp làm việc trên đồ án, kể từ khi dự án mở rộng từ hình thức 1 người thực hiện sang nhóm 3 người. Đây là bản nháp đầu tiên (v1) — các mục còn để ngỏ (đặc biệt là vai trò của thành viên thứ 3) sẽ được cập nhật dần khi nhóm thống nhất cụ thể hơn.

## 1. Giới thiệu nhóm

| Thành viên | Vai trò | Nhánh làm việc | Phạm vi chính |
|---|---|---|---|
| **Dương Minh Quang** | Base code & kiến trúc hệ thống | `main` | Toàn bộ backend (6 service + Gateway), 2 package dùng chung, hạ tầng Docker, 3 tài liệu kỹ thuật hiện có |
| **Nguyễn Lê Tiến** | Phát triển giao diện (HTML/CSS/JS/TypeScript) | Nhánh riêng (đề xuất: `frontend`) | `apps/web` — toàn bộ frontend React/TypeScript |
| **Thiều Quang Thành** | CDC (Debezium) và dự báo xu hướng ML/thống kê (phân công tạm thời, xem mục 3.3) | Chưa xác định | Analytics Service — 2 hạng mục mở rộng chưa triển khai (CDC, dự báo xu hướng) |

## 2. Bối cảnh

Hệ thống đã đạt trạng thái hoạt động đầy đủ (MVP + 4 đợt nâng cấp: chất lượng Frontend, Dead Letter Queue, access-control tài liệu, KPI theo phòng ban) trước khi dự án mở rộng thành nhóm 3 người. Tài liệu này xác định:

- Ai làm phần nào, trên nhánh nào.
- Cách một thành viên không trực tiếp làm việc với backend/hạ tầng (Tiến) vẫn có đủ môi trường để code frontend mà không cần tự cài đặt database/message queue.
- Ranh giới module rõ ràng để chia việc mà không giẫm chân nhau, giảm xung đột merge.
- Tài liệu kỹ thuật hiện có (`General_idea.md`/`Technical_Spec.md`/`Wireframe.md`) sẽ được điều chỉnh/mở rộng thế nào khi có thêm người phụ trách chuyên môn khác (giao diện, kiểm thử...).
- Định hướng mở rộng sau khi phần web hoàn thiện (mục 7).

## 3. Phân chia công việc

### 3.1 Dương Minh Quang — Base code & kiến trúc (nhánh `main`)

Chịu trách nhiệm toàn bộ backend (kiến trúc microservices, Kafka event backbone, RBAC, các service nghiệp vụ), hạ tầng Docker Compose, và tính đúng đắn tổng thể của hệ thống. `main` là nhánh nguồn chân lý (source of truth) — mọi nhánh khác cuối cùng đều hợp nhất trở lại đây.

### 3.2 Nguyễn Lê Tiến — Giao diện (HTML/CSS/JS/TypeScript)

Phụ trách toàn bộ `apps/web` (React 18 + TypeScript + Vite + Tailwind). Làm việc trên một nhánh riêng, không cần trực tiếp chỉnh sửa mã nguồn backend — chỉ cần chạy được backend qua Docker (xem mục 5) để có API thật gọi vào. Xem mục 6 để biết chia nhỏ theo từng khu vực trong `apps/web` nếu cần giao việc chi tiết hơn.

### 3.3 Thiều Quang Thành — CDC & Dự báo xu hướng (phân công tạm thời)

Phân công tạm thời, áp dụng cho tới khi có xác nhận cụ thể hơn về vai trò: phụ trách 2 hạng mục mở rộng còn lại trong `General_idea.md` mục 3 mà chưa được triển khai và không nằm trong phạm vi của Backend (Quang) hay Frontend (Tiến) hiện tại:

- **CDC (Change Data Capture) bằng Debezium** — thay thế cơ chế Outbox polling đơn giản hiện tại (`Technical_Spec.md` §4.1) bằng CDC đọc trực tiếp write-ahead log của Postgres/MongoDB, giảm độ trễ và tải polling khi hệ thống mở rộng.
- **Dự báo xu hướng bằng mô hình thống kê/ML** trong Analytics Service — hướng mở rộng tiếp theo sau tính năng "Nhận xét AI" đã triển khai (`Technical_Spec.md` §4.7), ví dụ cảnh báo rủi ro trễ hạn dự án dựa trên xu hướng dữ liệu lịch sử.

Cả 2 hạng mục đều chưa bắt đầu triển khai code. Phạm vi và cách chia nhỏ công việc sẽ cập nhật lại tại đây khi có xác nhận cụ thể.

## 4. Quy trình Git & nhánh làm việc

Thư mục mã nguồn (`Enterprise Collaboration and Analytics Platform for SMEs/`) đã là một Git repository có lịch sử commit, với remote `origin` trỏ tới GitHub. Nhánh `main` hiện đang theo dõi `origin/main`. File `.gitignore` đã có sẵn và đủ dùng (loại trừ `node_modules/`, `dist/`, `.env`, `coverage/`...).

Quy trình đề xuất cho việc mở rộng nhóm:

1. Tạo nhánh `frontend` (tên đề xuất, có thể đổi) rẽ ra từ `main` cho Tiến.
2. Thêm Tiến (và Thành, nếu công việc có liên quan tới code) làm collaborator trên GitHub repo để có quyền push.
3. Tiến làm việc trên `frontend`, định kỳ đồng bộ ngược từ `main` (`git merge main` hoặc `git rebase main`) để tránh lệch quá xa, giảm xung đột lớn khi hợp nhất.
4. Khi hoàn thành một phần việc, mở Pull Request/merge nhánh `frontend` về `main` để rà soát trước khi gộp.
5. Nhánh cho Thành sẽ quyết định sau khi rõ vai trò (mục 3.3) — nếu công việc thiên về tài liệu/điều phối thì có thể không cần nhánh code riêng.

**Bảo vệ nhánh `main` khỏi lỗi phát sinh từ nhánh khác:** hai lớp bảo vệ độc lập được áp dụng:

- **Kiến trúc:** container `web` (frontend) không được bất kỳ service backend nào khai báo `depends_on` trong `infra/docker-compose.yml` — lỗi build hoặc crash của `web` không ảnh hưởng tới Gateway hay 6 service nghiệp vụ khi chạy `docker compose up`.
- **Quy trình:** workflow CI (`.github/workflows/ci.yml`) chạy `typecheck`/`lint`/`build`/`test` cho toàn bộ workspace (bao gồm `apps/web`) trên mọi Pull Request — lỗi từ nhánh `frontend` bị chặn lại ở bước review thay vì lọt vào `main`.

Để lớp CI ở trên thực sự bắt buộc (chặn merge khi CI báo lỗi), cần bật thêm branch protection cho `main` trên GitHub (Settings → Branches → yêu cầu status check + review trước khi merge) — đây là thao tác cấu hình repository, cần thực hiện bởi người có quyền quản trị.

## 5. Môi trường phát triển — chạy dự án bằng Docker

Toàn bộ backend + database (3 Postgres, TimescaleDB, MongoDB, Redis, MinIO, Kafka) + 6 service nghiệp vụ + Gateway đã được đóng gói sẵn bằng Docker Compose, cho phép bắt đầu code giao diện mà không cần tự cài đặt hay hiểu chi tiết về database/hạ tầng phía sau.

```powershell
cd infra
docker compose --env-file .env up -d --build
```

Sau khi toàn bộ container ở trạng thái "healthy" (kiểm tra bằng `docker ps`), có 2 cách để làm việc với frontend:

- **Xem bản đã build sẵn:** mở `http://localhost` (cổng 80) — đây là bản `web` đã đóng gói qua Nginx, không có hot-reload khi sửa code.
- **Code có hot-reload (khuyến nghị khi phát triển giao diện):**
  ```powershell
  cd apps/web
  npm install
  npm run dev
  ```
  Mở `http://localhost:5173` — Vite dev server tự gọi API qua Gateway (container `gateway`, cổng 3000) đang chạy ở bước Docker phía trên.

Để có dữ liệu mẫu (tài khoản demo, phòng ban, dự án, công việc...) phục vụ code/test giao diện:

```powershell
npm run seed
```

Tài khoản Org Admin demo mặc định: `admin@demo-sme.vn` / `Password123!` (xem `scripts/seed.js` nếu cần đổi).

## 6. Ranh giới module — chia việc theo thư mục

Mục tiêu: mỗi người làm việc trong phạm vi thư mục riêng, giảm tối đa xung đột merge giữa các nhánh.

| Thư mục | Người phụ trách | Ghi chú |
|---|---|---|
| `apps/gateway/`, `apps/iam-service/`, `apps/project-task-service/`, `apps/document-service/`, `apps/notification-service/`, `apps/analytics-service/`, `apps/crm-service/`, `apps/hrm-service/` | Quang | Backend — 8 service nghiệp vụ + Gateway (`crm-service`/`hrm-service` bổ sung 05/08/2026) |
| `apps/ml-service/` | Quang | Anomaly Detection (bổ sung 24/09/2026) — service **Python/FastAPI đầu tiên** của dự án (8 service còn lại đều Node/NestJS), tự xây read-model riêng qua Kafka giống các service khác, không đụng DB service khác |
| `packages/common-dto/`, `packages/common-guard/`, `packages/common-metrics/` | Quang | Mã dùng chung giữa các service — đổi ở đây ảnh hưởng toàn bộ backend, cần cẩn trọng |
| `infra/` | Quang | Docker Compose, biến môi trường, script khởi tạo TimescaleDB |
| `apps/web/` | Tiến | Toàn bộ frontend — xem chia nhỏ theo tính năng bên dưới |
| `e2e/` | Chưa gán cố định | Kiểm thử Playwright — chưa có người phụ trách cụ thể |
| `Doc/` | Quang (hiện tại) | Xem mục 8 — quyền phụ trách từng phần có thể mở rộng khi vai trò của Tiến/Thành rõ hơn |

Nếu cần chia việc chi tiết hơn ngay trong `apps/web/`, các khu vực tính năng đã tách sẵn theo thư mục (mỗi thư mục độc lập tương đối, có thể giao cho từng người/đợt việc khác nhau mà ít đụng chạm nhau):

```
apps/web/src/features/
├── admin/          — Quản trị (thành viên, phòng ban, vai trò & phân quyền, sự kiện lỗi hệ thống)
├── analytics/       — Báo cáo & Phân tích
├── auth/            — Đăng nhập/đăng xuất
├── crm/             — Khách hàng & cơ hội bán hàng (bổ sung 05/08/2026)
├── dashboard/        — Dashboard tổng quan
├── documents/        — Quản lý tài liệu (thư mục, chia sẻ, ACL)
├── hrm/             — Chấm công (photo-proof) & nghỉ phép (bổ sung 05/08/2026)
├── notifications/     — Thông báo
├── profile/          — Hồ sơ cá nhân
├── projects/         — Dự án & Công việc (Kanban)
└── search/           — Tìm kiếm tổng hợp
```

## 7. Định hướng mở rộng — ứng dụng đồng bộ dữ liệu với web

Phần giao diện web (`apps/web`) là điểm khởi đầu, không phải điểm dừng của dự án. Kế hoạch tiếp theo bao gồm xây dựng thêm một ứng dụng (app) riêng, có khả năng đồng bộ dữ liệu với web — nền tảng/công nghệ cụ thể cho ứng dụng này chưa được quyết định.

Về mặt kiến trúc, hướng đi này đã được hỗ trợ sẵn: toàn bộ nghiệp vụ đi qua một lớp API Gateway duy nhất (`apps/gateway`), không có logic nghiệp vụ nào nằm riêng trong frontend web. Khi ứng dụng mới được phát triển, nó sẽ gọi cùng một lớp API này thay vì một backend riêng biệt — đảm bảo web và app luôn dùng chung một nguồn dữ liệu duy nhất, không cần xây dựng cơ chế đồng bộ dữ liệu thủ công giữa hai backend khác nhau.

## 8. Tài liệu dự án sẽ thay đổi theo

`General_idea.md`, `Technical_Spec.md`, `Wireframe.md` hiện do một người viết và duy trì. Khi nhóm có thêm chuyên môn khác (giao diện, kiểm thử...), các tài liệu này được kỳ vọng sẽ thay đổi theo một trong hai hướng (chưa quyết định hướng nào, sẽ chọn khi cần thiết):

- **Mở rộng tại chỗ:** mỗi tài liệu có thêm phần do người phụ trách chuyên môn tương ứng viết/cập nhật (ví dụ: bổ sung chi tiết `Wireframe.md` theo đúng những gì đã code, khác với mô tả ban đầu mang tính định hướng).
- **Tách file riêng theo chuyên môn:** ví dụ tách một tài liệu mô tả riêng cho frontend/giao diện nếu nội dung `Wireframe.md` trở nên quá lớn để dùng chung.

Việc này không cần quyết định ngay — chỉ cần ghi nhận trước để không ai bất ngờ khi cấu trúc tài liệu thay đổi.

## 9. Việc cần quyết định trước khi bắt đầu thực tế

- **Tên nhánh của Tiến:** tài liệu đề xuất `frontend` — có thể đổi theo ý muốn của nhóm.
- **Quyền truy cập GitHub repo:** cần thêm Tiến (và Thành, nếu liên quan tới code) làm collaborator để có quyền push nhánh riêng.
- **Vai trò cụ thể của Thiều Quang Thành:** cần trao đổi thêm giữa cả nhóm rồi cập nhật lại mục 3.3 và bảng ở mục 6.
- **Nền tảng cho ứng dụng đồng bộ dữ liệu (mục 7):** chưa quyết định (di động/desktop, framework cụ thể).
