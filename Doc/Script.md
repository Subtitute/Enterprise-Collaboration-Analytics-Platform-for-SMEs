# Script.md — Kế hoạch phối hợp nhóm 3 người

> Trạng thái: **ĐANG ÁP DỤNG (v2, 25/10/2026)** — phân công cả 3 thành viên đã chốt: backend/frontend
> (Quang/Tiến) áp dụng từ bản v1; vai trò của Thiều Quang Thành chốt 25/10/2026 sau khi merge
> nhánh `test-cdc` (§3.3) kèm danh sách gói việc cụ thể (§3.4). Riêng định hướng ứng dụng đồng bộ dữ
> liệu (§7) vẫn để ngỏ. Chi tiết lịch sử đầy đủ: xem `RevisionHistory.md`.

> Tài liệu mô tả cách nhóm 3 người phối hợp làm việc trên đồ án, kể từ khi dự án mở rộng từ hình thức 1 người thực hiện sang nhóm 3 người. Bản v1 (đưa lên Git ngày 12/08/2026) còn để ngỏ vai trò của thành viên thứ 3; bản v2 (25/10/2026) chốt vai trò này và giao việc cụ thể tại §3.4 — Thành dùng trực tiếp §3.4 làm danh sách công việc của mình.

## 1. Giới thiệu nhóm

| Thành viên | Vai trò | Nhánh làm việc | Phạm vi chính |
|---|---|---|---|
| **Dương Minh Quang** | Base code & kiến trúc hệ thống | `main` | Toàn bộ backend (6 service + Gateway), 2 package dùng chung, hạ tầng Docker, 3 tài liệu kỹ thuật hiện có |
| **Nguyễn Lê Tiến** | Phát triển giao diện (HTML/CSS/JS/TypeScript) | Nhánh riêng (đề xuất: `frontend`) | `apps/web` — toàn bộ frontend React/TypeScript |
| **Thiều Quang Thành** | Phụ trách CDC (Debezium), kiểm thử hiệu năng và kiểm thử e2e (chốt 25/10/2026, xem §3.3–§3.4) | `test-cdc` (đã merge vào `main` 25/10/2026); từ nay mỗi gói việc 1 nhánh riêng cắt từ `main` (§3.4) | CDC (`scripts/cdc-*.ps1`, `infra/debezium/`), đo hiệu năng, `e2e/`; tuỳ chọn: dự báo xu hướng trong `apps/ml-service`, vài việc backend nhỏ |

## 2. Bối cảnh

Hệ thống đã đạt trạng thái hoạt động đầy đủ (MVP + 4 đợt nâng cấp: chất lượng Frontend, Dead Letter Queue, access-control tài liệu, KPI theo phòng ban) trước khi dự án mở rộng thành nhóm 3 người. Tài liệu này xác định:

- Ai làm phần nào, trên nhánh nào.
- Cách một thành viên không trực tiếp làm việc với backend/hạ tầng (Tiến) vẫn có đủ môi trường để code frontend mà không cần tự cài đặt database/message queue.
- Ranh giới module rõ ràng để chia việc mà không giẫm chân nhau, giảm xung đột merge.
- Tài liệu kỹ thuật hiện có (`General_idea.md`/`Technical_Spec.md`/`Wireframe.md`) sẽ được điều chỉnh/mở rộng thế nào khi có thêm người phụ trách chuyên môn khác (giao diện, kiểm thử...).
- Định hướng mở rộng sau khi phần web hoàn thiện (§7).

## 3. Phân chia công việc

### 3.1 Dương Minh Quang — Base code & kiến trúc (nhánh `main`)

Chịu trách nhiệm toàn bộ backend (kiến trúc microservices, Kafka event backbone, RBAC, các service nghiệp vụ), hạ tầng Docker Compose, và tính đúng đắn tổng thể của hệ thống. `main` là nhánh nguồn chân lý (source of truth) — mọi nhánh khác cuối cùng đều hợp nhất trở lại đây.

### 3.2 Nguyễn Lê Tiến — Giao diện (HTML/CSS/JS/TypeScript)

Phụ trách toàn bộ `apps/web` (React 18 + TypeScript + Vite + Tailwind). Làm việc trên một nhánh riêng, không cần trực tiếp chỉnh sửa mã nguồn backend — chỉ cần chạy được backend qua Docker (xem §5) để có API thật gọi vào. Xem §6 để biết chia nhỏ theo từng khu vực trong `apps/web` nếu cần giao việc chi tiết hơn.

### 3.3 Thiều Quang Thành — CDC (Debezium) *(cập nhật 25/10/2026)*

Phân công ban đầu (tạm thời) giao cho Thành 2 hạng mục mở rộng chưa ai làm trong `General_idea.md` §3: **CDC bằng Debezium** thay cho Outbox polling (`Technical_Spec.md` §4.1) và **dự báo xu hướng bằng thống kê/ML**. Thành chọn làm CDC trước; phần dự báo xu hướng chưa bắt đầu và nay chuyển thành gói việc tuỳ chọn (§3.4, Gói 4).

**Phần Thành đã xây dựng** — nhánh `test-cdc`, 3 commit ngày 05/09/2026 và 25/09/2026 (tài khoản GitHub `thieuquangthanh1`):

- Connector Debezium Postgres kèm Outbox Event Router đọc bảng `outbox_events` của `project-task-service` (`infra/debezium/register-pt-connector.json`): định tuyến sang topic `project-task.events`, key `organization_id`, các trường envelope `eventId`/`eventType`/`organizationId`/`producer`/`occurredAt` và `payload` jsonb được mở rộng — đúng định dạng `DomainEvent` mà các consumer đang dùng.
- Service `debezium/connect:2.7.3.Final` trong `infra/docker-compose.yml`, bật `wal_level=logical` cho `postgres-pt`, cờ `ENABLE_OUTBOX_POLLING` để tắt polling trong `OutboxPublisherJob`, script đăng ký connector và mục hướng dẫn trong `README.md`.

**Nhận xét khi merge:** kiến trúc (Outbox + CDC đọc WAL) và cách ánh xạ cột là đúng, consumer không phải sửa gì. Tuy vậy bản thử nghiệm chưa đưa được sự kiện nào đi trọn luồng tới consumer, do 2 chi tiết cấu hình:

1. `transforms.outbox.table.field.event.timestamp=occurred_at` — SMT đòi trường kiểu INT64, còn `occurred_at` là `timestamptz`, nên task của connector chuyển `FAILED` ngay ở sự kiện đầu tiên.
2. Các biến `KEY_/VALUE_CONVERTER_SCHEMAS_ENABLE` không được image đọc, nên mọi message bị bọc thêm `{"schema", "payload"}`; `analytics-service`/`notification-service` coi là sai định dạng và đẩy vào DLQ.

Ngoài ra, README hướng dẫn đặt `OUTBOX_POLLING_ENABLED` trong khi code đọc `ENABLE_OUTBOX_POLLING`, và commit `package-lock.json` tạo bằng npm phiên bản cũ làm mất 13 mục `"libc"`.

**Điều chỉnh khi merge** (commit `51dcf6b`, 25/10/2026): sửa 2 lỗi cấu hình trên; đưa `debezium` vào profile tuỳ chọn `cdc` (tắt mặc định, giới hạn heap/RAM, cổng chỉ mở `127.0.0.1`); `snapshot.mode=no_data`, đặt tên slot/publication rõ ràng, mật khẩu DB lấy từ `infra/.env` qua config provider thay vì ghi cứng; thay script đăng ký bằng 2 script một lệnh `scripts/cdc-on.ps1`/`scripts/cdc-off.ps1` có thứ tự bước bảo đảm không mất sự kiện; giữ nguyên `package-lock.json` của `main`. Sau đó 2 người rà soát chéo (1 kiểm thử sống dưới tải, 1 rà soát tĩnh + CI) xác nhận thêm 9 vấn đề, đã sửa trong commit `775c518` — trong đó có 1 lỗi có từ trước, không do CDC gây ra: Kafka chưa bao giờ ghi dữ liệu vào volume (`Technical_Spec.md` §26.6).

**Trạng thái hiện tại:** **ĐÃ MERGE, ĐÃ XÁC MINH SỐNG** — CDC chạy được như một chế độ tuỳ chọn cho demo ngắn. Độ trễ tới Analytics qua CDC 0,40–0,62 giây (polling khoảng 2,0 giây); 1.862 sự kiện dưới tải không mất sự kiện nào, không trùng lặp nào lộ ra với người dùng. Chi tiết kỹ thuật: `Technical_Spec.md` §26; cách dùng: mục "CDC Debezium" trong `README.md`.

### 3.4 Gói việc của Thiều Quang Thành *(giao 25/10/2026)*

Các gói việc xếp theo mức ưu tiên: **P1** cần xong trước buổi bảo vệ, **P2** nên làm, **P3** tuỳ chọn (chỉ nhận khi P1 đã xong). Mỗi gói làm trên 1 nhánh riêng và merge qua Pull Request (xem quy tắc làm việc ở cuối mục này).

#### Gói 1 — Phụ trách CDC (P1)

- **Mục tiêu:** làm chủ hoàn toàn phần CDC: demo chạy trơn tru và tự trình bày, tự trả lời câu hỏi về CDC trước hội đồng.
- **Phạm vi:**
  - Diễn tập bật/tắt CDC bằng `scripts/cdc-on.ps1`/`scripts/cdc-off.ps1` trên đúng máy sẽ dùng để demo.
  - Viết phần CDC trong kịch bản demo (khoảng 2 phút).
  - Trình bày CDC tại buổi bảo vệ.
  - *(Tuỳ chọn)* mở rộng CDC sang 1 service thứ 2 theo cùng mẫu (ví dụ `document-service`, vốn cũng có bảng `outbox_events`).
- **File/khu vực:** `scripts/cdc-common.ps1`, `scripts/cdc-on.ps1`, `scripts/cdc-off.ps1`, `infra/debezium/`, phần `debezium`/`postgres-pt` trong `infra/docker-compose.yml` (sửa file này cần Quang duyệt), mục "CDC Debezium" trong `README.md`, `Technical_Spec.md` §26. `Doc/DemoScript.md` không commit lên Git (`.gitignore`), nên phần kịch bản CDC gửi trực tiếp cho Quang hoặc đặt trong mô tả Pull Request để ghép vào.
- **Sản phẩm bàn giao:**
  - Biên bản diễn tập: ít nhất 3 vòng ON/OFF, ghi thời gian từng bước và kết quả.
  - Phần kịch bản demo CDC (thao tác trên màn hình + lời thuyết minh).
  - Dàn ý trình bày kèm bộ câu hỏi–đáp dự kiến: vì sao cần CDC, vì sao không mất sự kiện, đánh đổi về RAM/dung lượng image, giới hạn đã biết.
  - *(Tuỳ chọn)* connector thứ 2 cùng phần mở rộng script.
- **Tiêu chí nghiệm thu:**
  - Trên máy demo, chạy `cdc-on.ps1` → đổi trạng thái 1 công việc → sự kiện tới Analytics dưới 1 giây → chạy `cdc-off.ps1` → `pg_replication_slots` rỗng, container `debezium` đã dừng, polling hoạt động lại.
  - Đối chiếu `outbox_events` với `fact_task_events` không thiếu sự kiện nào.
  - Giải thích được thứ tự bước ON/OFF và lý do không mất sự kiện mà không cần đọc tài liệu.
  - *(Tuỳ chọn)* service thứ 2 qua đúng bài kiểm tra trên, CI xanh.
- **Lưu ý:** mỗi lần chuyển chế độ đều tạo lại `project-task-service`, và trên máy Docker Desktop/WSL `localhost` có thể treo khoảng 90 giây sau khi tạo lại container → chuyển chế độ **trước** khi bắt đầu demo, không chuyển giữa chừng (`Technical_Spec.md` §26.8).

#### Gói 2 — Kiểm thử hiệu năng (P1)

- **Mục tiêu:** có số đo thật cho phần yêu cầu phi chức năng (NFR) trong báo cáo, thay cho các con số ước lượng.
- **Phạm vi:**
  - Độ trễ end-to-end polling so với CDC: tính từ lúc `PATCH /api/v1/tasks/:id/status` trả về tới lúc bản ghi tương ứng xuất hiện trong `fact_task_events` (TimescaleDB). Đo ít nhất 30 mẫu mỗi chế độ, báo cáo trung vị/p95/max. Mốc tham chiếu đo nhanh 25/10/2026: polling khoảng 2,0 giây, CDC 0,40–0,62 giây (6 mẫu).
  - Độ trễ và thông lượng Gateway: vài endpoint đọc/ghi tiêu biểu với 1/10/50 người dùng đồng thời, báo cáo p50/p95/p99, số request/giây, tỷ lệ lỗi. Gateway giới hạn 300 request/phút cho mỗi người dùng (`Technical_Spec.md` §8): dùng nhiều tài khoản demo, hoặc ghi rõ ảnh hưởng của giới hạn này lên kết quả.
- **File/khu vực:** thư mục mới `perf/` (script đo + kết quả thô + `perf/README.md` mô tả phương pháp). File báo cáo tốt nghiệp không nằm trên Git, nên bảng số liệu và biểu đồ gửi cho Quang để ghép vào mục "Đánh giá yêu cầu phi chức năng" của báo cáo.
- **Sản phẩm bàn giao:**
  - Script đo chạy lại được.
  - File kết quả (CSV/JSON).
  - Bảng số liệu và 1–2 biểu đồ trong báo cáo.
  - Mô tả môi trường đo: cấu hình máy, máy ảo Docker giới hạn 5GB, số container đang chạy.
- **Tiêu chí nghiệm thu:**
  - Chạy lại cho kết quả lệch không quá khoảng 20%, phương pháp đo ghi rõ.
  - Dọn sạch dữ liệu thử sau khi đo: không để lại công việc/sự kiện rác trong tổ chức demo, không sửa dữ liệu seed.
  - Không chạy đo song song với build/test nặng (quy ước khoá lệnh nặng, `Technical_Spec.md` §25).
- **Lưu ý kỹ thuật:**
  - Gọi API bằng `fetch` của Node, không dùng `Invoke-RestMethod` của PowerShell cho `PATCH` có body: PowerShell 5.1 gửi kèm `Expect: 100-continue`, Gateway trả về 401 gây hiểu nhầm.
  - Dùng `127.0.0.1` thay cho `localhost`.

#### Gói 3 — Kiểm thử e2e Playwright (P2)

- **Mục tiêu:** đưa bộ e2e trở lại trạng thái xanh và phủ thêm các tính năng mới.
- **Phạm vi:**
  - Sửa 6/17 test đang lỗi do selector cũ sau đợt tách component frontend (nhánh Frontend2).
  - Thêm e2e cho chatbot nội bộ (`Technical_Spec.md` §23), chấm công có nhận diện khuôn mặt (§24 — dùng camera giả của Chromium, `--use-fake-device-for-media-stream`) và Danh mục sản phẩm & Kho (§22).
  - Ưu tiên selector ổn định (`getByRole`, `data-testid`).
- **File/khu vực:** `e2e/tests/`, `e2e/tests/helpers.ts`, `e2e/playwright.config.ts`, `e2e/README.md`. Thêm `data-testid` vào `apps/web` chỉ khi đã báo Tiến.
- **Sản phẩm bàn giao:** toàn bộ suite xanh, 3 file spec mới, hướng dẫn chạy cập nhật trong `e2e/README.md`.
- **Tiêu chí nghiệm thu:**
  - Chạy 3 lần liên tiếp đều xanh (không test chập chờn).
  - Test tự dọn dữ liệu đã tạo (bài học dữ liệu rác E2E ngày 25/09/2026, `Technical_Spec.md` §19.6).
  - Không sửa logic nghiệp vụ chỉ để test pass.

#### Gói 4 — Dự báo xu hướng (P3, tuỳ chọn)

- **Điều kiện:** chỉ nhận nếu đã quen Python và thống kê.
- **Mục tiêu:** triển khai Layer 4 — Predictive/Forecasting đang để ngỏ ở `Doc/Upgrade.md` Tier 4.
- **Phạm vi:**
  - Trong `apps/ml-service` (Python/FastAPI): dự báo số công việc hoàn thành tuần tới theo tổ chức/phòng ban bằng phương pháp thống kê nhẹ (trung bình trượt, hồi quy tuyến tính hoặc ETS/Holt-Winters), có khoảng tin cậy.
  - Lấy dữ liệu từ read-model riêng của `ml-service` (`fact_task_events` trong `postgres-ml`), không đọc DB của service khác.
  - Công bố endpoint qua Gateway; phần hiển thị phối hợp với Tiến.
- **Sản phẩm bàn giao:** endpoint kèm unit test (`pytest`), đánh giá sai số (MAE/MAPE) bằng backtest trên dữ liệu demo, mô tả rõ giới hạn (dữ liệu demo nhỏ).
- **Tiêu chí nghiệm thu:** test pass, CI xanh, cập nhật `Doc/Upgrade.md` Tier 4 và `Technical_Spec.md`.

#### Gói 5 — Việc backend nhỏ (P3, tuỳ chọn)

- **Mục tiêu:** sửa 2 điểm nhỏ đã ghi nhận nhưng chưa ai làm.
- **Phạm vi:**
  1. **Trạng thái `CANCELLED` riêng cho đơn nghỉ phép.** Hiện `PATCH /api/v1/leave-requests/:id/cancel` chuyển đơn sang `REJECTED` và phát `LEAVE_REQUEST_REJECTED`, nên chính người hủy nhận thông báo "đơn bị từ chối" và Analytics đếm đơn đó là bị từ chối. Cần thêm trạng thái `CANCELLED` và sự kiện riêng, cập nhật notification, analytics, i18n vi/en/ja; bổ sung `errorCode` cho lỗi 403 khi hủy đơn của người khác.
  2. **Bộ lọc "giao cho tôi" cho API công việc.** `GET /api/v1/tasks` hiện chỉ lọc theo `projectId`/`status` (`TaskQueryDto`); cần thêm bộ lọc theo người được giao để tool của chatbot (`apps/analytics-service/src/chatbot/chatbot-tools.service.ts`) trả lời được câu hỏi "việc của tôi".
- **File/khu vực:** `apps/hrm-service`, `packages/common-dto`, `apps/notification-service`, `apps/analytics-service`, `apps/project-task-service/src/tasks`, file i18n trong `apps/web`. Đây là vùng của Quang (§6), mọi Pull Request cần Quang duyệt.
- **Tiêu chí nghiệm thu:** có unit test mới, coverage không tụt dưới ngưỡng của từng workspace, CI xanh, cập nhật `Technical_Spec.md`.

#### Quy tắc làm việc

1. **Mỗi gói việc 1 nhánh riêng, cắt từ `main` mới nhất:** `git switch main`, `git pull`, rồi `git switch -c thanh/<gói-việc>` (ví dụ `thanh/cdc-demo`, `thanh/perf`, `thanh/e2e`).
2. **Commit message có nghĩa:** nêu thay đổi gì và vì sao (không dùng tên chung chung như "ch"). Không commit `package-lock.json` khi không thêm/bỏ dependency — file lock tạo bằng npm khác phiên bản sẽ làm mất các mục `"libc"` như lần merge `test-cdc`.
3. **Đồng bộ `main` mỗi tuần** (`git merge main` vào nhánh đang làm), xử lý xung đột sớm khi còn nhỏ.
4. **Tài liệu và comment theo quy ước chung của dự án:** mỗi lần thêm/sửa module, giao diện hay cấu hình đều có comment tiếng Việt ghi ngày thay đổi (dd/mm/yyyy) và nội dung thay đổi, viết theo góc nhìn người làm dự án; chuỗi hiển thị trên giao diện dùng tiếng Việt có dấu qua i18n; cập nhật tài liệu liên quan (`Technical_Spec.md`, `README.md`, ...) trong cùng nhánh, thêm mục vào "Lịch sử thay đổi tài liệu" của file đã sửa.
5. **Merge qua Pull Request vào `main`:** Quang review trước khi gộp. CI phải xanh (`typecheck`, `lint`, `lint:i18n-strings`, `test:coverage`, `build`); nên tự chạy trước ở máy với `TZ=UTC` như runner CI.
6. **Dữ liệu demo:** không sửa dữ liệu seed; mọi dữ liệu thử tự tạo phải được dọn sau khi dùng.

## 4. Quy trình Git & nhánh làm việc

Thư mục mã nguồn (`Enterprise Collaboration and Analytics Platform for SMEs/`) đã là một Git repository có lịch sử commit, với remote `origin` trỏ tới GitHub. Nhánh `main` hiện đang theo dõi `origin/main`. File `.gitignore` đã có sẵn và đủ dùng (loại trừ `node_modules/`, `dist/`, `.env`, `coverage/`...).

Quy trình đề xuất cho việc mở rộng nhóm:

1. Tạo nhánh `frontend` (tên đề xuất, có thể đổi) rẽ ra từ `main` cho Tiến.
2. Thêm Tiến (và Thành, nếu công việc có liên quan tới code) làm collaborator trên GitHub repo để có quyền push.
3. Tiến làm việc trên `frontend`, định kỳ đồng bộ ngược từ `main` (`git merge main` hoặc `git rebase main`) để tránh lệch quá xa, giảm xung đột lớn khi hợp nhất.
4. Khi hoàn thành một phần việc, mở Pull Request/merge nhánh `frontend` về `main` để rà soát trước khi gộp.
5. ~~Nhánh cho Thành sẽ quyết định sau khi rõ vai trò (§3.3)~~ — *(cập nhật 25/10/2026)* Thành làm CDC trên nhánh `test-cdc`, đã merge vào `main` (commit `51dcf6b`, sửa bổ sung `775c518`). Từ nay Thành không làm tiếp trên `test-cdc`: mỗi gói việc ở §3.4 dùng 1 nhánh mới cắt từ `main` mới nhất (`thanh/<gói-việc>`) và merge qua Pull Request (quy tắc ở cuối §3.4).

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
| `infra/` | Quang | Docker Compose, biến môi trường, script khởi tạo TimescaleDB (trừ `infra/debezium/` ở dòng dưới) |
| `infra/debezium/`, `scripts/cdc-common.ps1`, `scripts/cdc-on.ps1`, `scripts/cdc-off.ps1` | Thành | CDC Debezium, profile tuỳ chọn `cdc` (bổ sung 25/10/2026). Phần `debezium`/`postgres-pt` nằm trong `infra/docker-compose.yml` dùng chung nên sửa file đó cần Quang duyệt |
| `perf/` (thư mục mới, khi làm Gói 2 ở §3.4) | Thành | Script đo hiệu năng và kết quả thô (bổ sung 25/10/2026) |
| `apps/web/` | Tiến | Toàn bộ frontend — xem chia nhỏ theo tính năng bên dưới |
| `e2e/` | Thành *(từ 25/10/2026)* | Kiểm thử Playwright — Gói 3 ở §3.4; thêm `data-testid` vào `apps/web` cần báo Tiến |
| `Doc/` | Quang (hiện tại) | Xem §8 — quyền phụ trách từng phần có thể mở rộng khi vai trò của Tiến/Thành rõ hơn |

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
- ~~**Vai trò cụ thể của Thiều Quang Thành:** cần trao đổi thêm giữa cả nhóm rồi cập nhật lại §3.3 và bảng ở §6.~~ — **đã chốt 25/10/2026:** xem §3.3 (phần đã làm) và §3.4 (gói việc), bảng §6 đã cập nhật.
- **Nền tảng cho ứng dụng đồng bộ dữ liệu (§7):** chưa quyết định (di động/desktop, framework cụ thể).
- **Branch protection cho `main` (§4):** nên bật trước khi Thành mở Pull Request đầu tiên, để CI xanh là điều kiện bắt buộc khi merge.

## Lịch sử thay đổi tài liệu

- **12/08/2026** — Khởi tạo tài liệu (bản nháp v1, ngày đưa lên Git): phân công Quang/Tiến, phân công tạm thời cho Thành (CDC + dự báo xu hướng), quy trình Git, ranh giới module.
- **25/10/2026 (merge `test-cdc` + giao việc cho Thành)** — Bản v2. §1/§3.3: ghi nhận phần CDC Thành đã xây dựng trên nhánh `test-cdc` (05/09 và 25/09/2026), 2 lỗi cấu hình đã sửa khi merge (`51dcf6b`), 9 vấn đề sửa sau rà soát chéo (`775c518`) và trạng thái đã xác minh sống. §3.4 mới: 5 gói việc có mục tiêu, phạm vi, file, sản phẩm, tiêu chí nghiệm thu, mức ưu tiên, kèm quy tắc làm việc. §4/§6/§9 cập nhật nhánh làm việc, quyền phụ trách `infra/debezium/`, `scripts/cdc-*`, `perf/`, `e2e/`. Chi tiết: `RevisionHistory.md` mục 25/10/2026 (tiếp).
