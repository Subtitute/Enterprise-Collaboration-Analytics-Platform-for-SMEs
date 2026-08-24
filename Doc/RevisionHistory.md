# Lịch sử rà soát & sửa lỗi — Enterprise Collaboration & Analytics Platform for SMEs

File này gộp lại **toàn bộ các đợt rà soát/sửa lỗi** của dự án (backend, frontend, hạ tầng, và
`ecap-mobile`) thành 1 dòng thời gian duy nhất, dễ tra cứu. Đây là bản **tóm tắt điều hướng** —
chi tiết kỹ thuật đầy đủ (file:line, kịch bản tái hiện, đoạn code trước/sau) vẫn nằm ở:
- `Doc/Technical_Spec.md` → mục "Lịch sử thay đổi tài liệu" (backend/frontend/hạ tầng), và
- `Doc/ECAP_Mobile.md` → mục "Lịch sử thay đổi tài liệu" (riêng `ecap-mobile`).

Mỗi mục dưới đây có dòng "Chi tiết:" trỏ tới đúng vị trí trong 2 file trên khi cần đào sâu.

---

## 2026-07-18 — Khởi tạo tài liệu kỹ thuật

Tạo `Technical_Spec.md`: kiến trúc tổng thể, tech stack, 6 service MVP, thiết kế event-driven
(Outbox + Kafka), schema DB, AuthN/AuthZ, quy ước API, hạ tầng Docker, bảo mật, kiểm thử, CI/CD,
NFR, cấu trúc repo.

## 2026-07-21 — Review toàn diện lần 1 (vai trò giảng viên phản biện)

- Bổ sung `TaskStatusHistory`, event `task.deleted`/`project.deleted`.
- Bucket MinIO chuyển sang **private**; làm rõ `FileShare` khi đó chỉ mang tính hiển thị.
- Xác thực nội bộ Gateway→Service qua `x-internal-secret`; thu hồi access token qua Redis khi
  deactivate; refresh token chuyển sang cookie httpOnly; RBAC guard áp dụng cho cả GET.
- Quy tắc mạng: chỉ `web`/`gateway` expose port ra host.
- **Bổ sung sau rebuild (cùng ngày):** 2 lỗi chỉ lộ ra khi chạy thật — Document Service dùng
  chung 1 endpoint MinIO cho cả nội bộ lẫn presigned URL (tách `MINIO_PUBLIC_ENDPOINT`); healthcheck
  `web` phân giải nhầm `::1` (IPv6) thay vì `127.0.0.1`.

*Chi tiết: Technical_Spec.md, mục "2026-07-21".*

## 2026-07-22 — 4 lỗi từ kiểm thử thật của người dùng

`PaginationQueryDto.limit` trần quá thấp (100→500); `GET /roles` thiếu `permissionKeys` (sập
trang Vai trò & Phân quyền); Notification Service thiếu field `id` (đánh dấu đã đọc luôn gọi
`id=undefined`); `fetchFolders()` giả định sai hình dạng response.

## 2026-07-22 (bổ sung) — Lệch hợp đồng field name Document Service ↔ Frontend

`parentFolderId` (BE) vs `parentId` (FE) cho thư mục; `fileName`/`sizeBytes`/`currentVersion` (BE)
vs `name`/`size`/`version` (FE) cho tệp — sửa bằng lớp chuẩn hoá `mapFolder`/`mapFile` ở frontend,
không đổi field backend. Phát hiện thêm: 4/5 service gọi `enableCors()` không tham số → wildcard
CORS kết hợp `credentials: true` vi phạm spec — gỡ khỏi 4 service, chỉ Gateway xử lý CORS.

## 2026-07-22 (bổ sung lần 2) — Dropdown bị cắt, xem/tải file, nút Back, tìm kiếm, hồ sơ cá nhân

Menu tệp không hiện (Dropdown bị `overflow` của bảng cha cắt mất) — chuyển sang React Portal;
thêm `disposition=inline|attachment` cho tải file; `currentFolderId` chuyển sang query param để
nút Back hoạt động đúng; xây `useGlobalSearch()` (tìm kiếm client-side); thêm trang Hồ sơ cá nhân
mới (`/profile`).

## 2026-07-22 (review toàn dự án) — 194/194 test qua

**Nghiêm trọng:** đăng xuất không thực sự thu hồi phiên (đọc token sai nguồn sau khi chuyển sang
cookie httpOnly); `GET /tasks` không bao giờ trả `assignees`; tên người viết bình luận không hiện
(field `authorUserId` vs `authorId`).

**Nghiêm trọng vừa:** race condition rotate refresh token; timing side-channel ở đăng nhập; thiếu
guard trên `GET /roles`; không có rào chắn tự-vô-hiệu-hoá; race condition đọc-ghi không khoá ở
`ProjectsService`/`TasksService`; race condition `uploadNewVersion`; MIME chỉ tin client khai báo;
KPI đếm cả entity đã xoá cứng; Kafka consumer chưa phân biệt lỗi tạm thời/vĩnh viễn;
`INTERNAL_SHARED_SECRET` fail-open về giá trị hardcode; `seed.js` không idempotent; validation
tiếng Anh trên toàn bộ 5 service; và một loạt lỗi UI/UX (popup blocker, Dropdown tự đóng khi
cuộn, múi giờ GMT+7, thông báo lỗi tải dữ liệu).

*Chi tiết: Technical_Spec.md, mục "2026-07-22 (review toàn dự án)".*

## 2026-07-25 — Review vòng 2 (298/298 test qua)

**Nghiêm trọng:** leo thang đặc quyền qua `POST /users/invite` (Manager tự đọc UUID vai trò Org
Admin qua `GET /users` rồi mời tài khoản mới với vai trò đó); Gateway có thể sập toàn tiến trình
do unhandled promise rejection trong `jwt-auth.middleware.ts` (nhánh sau verify JWT nằm ngoài
`try/catch`).

**Nghiêm trọng vừa:** rate-limit bị bypass qua giả mạo `X-Forwarded-For`; rủi ro sniff-XSS qua
`text/plain`/`text/csv`; KPI "tỷ lệ hoàn thành" có thể vượt 100% (không dùng phương pháp cohort);
WebSocket real-time Analytics phát trùng; thiếu `depends_on` cho Redis; `seed.js` tạo tổ chức
demo mới mỗi lần chạy; validation tiếng Anh.

*Chi tiết: Technical_Spec.md, mục "2026-07-25 (review vòng 2)".*

## 2026-07-28 — Nâng cấp chất lượng Frontend

Code splitting theo route (bundle chính 954KB → 347KB + chunk riêng); bộ E2E Playwright đầu tiên
(`e2e/`, 7 kịch bản) — **phát hiện ngay 1 lỗi thật đang chạy production**: `window.open()` kèm
`noopener/noreferrer` luôn trả `null` theo đặc tả WHATWG, khiến bản sửa popup-blocker ngày
22/07/2026 vô hiệu từ lúc viết ra. Đợt rà soát a11y: focus trap cho `Modal`, `aria-describedby`
cho form, skip-to-content, và 10 điểm nhỏ khác.

## 2026-07-28 — Dead Letter Queue

Kafka producer mới cho Analytics/Notification Service; giới hạn 5 lần retry; module
`failed-events` (MongoDB, `GET /api/v1/failed-events`, quyền `system:manage`). Phát hiện quan
trọng: subscribe theo `Object.values(KAFKA_TOPICS)` sẽ khiến consumer tự đọc lại DLQ của chính nó
— sửa bằng khai báo tường minh danh sách topic.

## 2026-07-28 — Access-control tài liệu theo thư mục/phòng ban

`Folder.visibility` (`organization`/`restricted`), entity `FolderShare`, `FileShare` bổ sung
`sharedWithDepartmentId`. Sửa lệch hợp đồng: `name` trong `PATCH /folders/:id` từ bắt buộc sang
optional (đúng ngữ nghĩa PATCH).

## 2026-07-28 — KPI theo phòng ban

Event `USER_DEPARTMENT_CHANGED`; bảng `dim_user` (Analytics); 3/4 endpoint KPI nhận `departmentId`
optional. Backfill lịch sử 1 lần cho dữ liệu demo hiện có.

## 2026-07-28 — Kiểm tra tổng thể ("ultimate check")

Sửa: JWT test payload thiếu `departmentId` (typecheck fail); **`GET /api/v1/failed-events` khiến
bản ghi `organizationId=null` vĩnh viễn vô hình** với mọi Org Admin (lỗ hổng thiết kế nghiêm trọng
nhất của tính năng DLQ). Dọn dữ liệu demo lộn xộn, seed lại sạch. Kết quả: 14 container healthy,
375/375 test qua, E2E 7/7.

## 2026-07-28 (xác minh sống 04/08/2026) — Nhận xét AI (Gemini)

Model mặc định `gemini-2.5-flash` bị Google khai tử cho project mới (404) → chuyển
`gemini-flash-latest`; phản hồi bị cắt cụt do "thinking token" chiếm hết ngân sách → nâng
`maxOutputTokens` lên 2048. 385/385 test qua.

## 2026-08-04 — Observability hạ tầng

`packages/common-metrics` (bọc `prom-client`) cho toàn bộ service; thêm Prometheus/Grafana/
kafka-exporter. Xác minh sống: 8/8 target Prometheus `up`, không đếm trùng traffic giữa Gateway
và service đích.

## 2026-08-05 — CRM-lite & HRM-lite (2 service mới, cùng ngày)

`apps/crm-service` (Customer + Deal pipeline, Kanban 6 giai đoạn); `apps/hrm-service` (chấm công
photo-proof — cố ý KHÔNG nhận diện khuôn mặt, nghỉ phép có duyệt). Cả hai gặp và tự sửa cùng 1
lỗi khởi động (thiếu `type` tường minh trên cột nullable string).

## 2026-08-06 — Rà soát toàn diện sau CRM/HRM/Observability

388/388 test qua, 20 container healthy, 10/10 target Prometheus `up`. Phát hiện sai lệch tài
liệu (không phải lỗi code): README.md/§7 mô tả route `/api/docs` **chưa từng tồn tại** — sửa lại
mô tả cho khớp thực tế.

## 2026-08-10 — Dữ liệu RBAC lệch pha của tổ chức demo cố định

Phát hiện khi thử `ecap-mobile`: Manager/Employee của tổ chức demo (đăng ký trước CRM/HRM-lite)
thiếu toàn bộ permission CRM/HRM-lite — đúng hành vi RBAC theo thiết kế (không tự ghi đè), sửa
bằng `PATCH /roles/:id/permissions` đúng API có sẵn, không đụng DB trực tiếp.

## 2026-08-10 — Dữ liệu thật cho trang Tài liệu + sửa sơ đồ §1

Thay dữ liệu minh hoạ bằng tài liệu THẬT của dự án (Markdown → PDF, tải qua API có sẵn). Sửa sơ
đồ Mermaid §1 còn nhắc tới "Swagger aggregation" đã bị gỡ mô tả ngày 06/08.

## 2026-08-12 — CNA mở rộng phạm vi: Công việc & Tài liệu

Đối chiếu trực tiếp `DEFAULT_ROLE_PERMISSIONS` của Employee thay vì suy đoán — phát hiện phạm vi
CNA ban đầu hẹp hơn quyền Employee thực có trên web. Thêm `TasksPage`/`DocumentsPage`; cố ý loại
CRM (Deal) khỏi mobile. Sự cố công cụ: `file_picker` 11.x build lỗi → ghim `10.3.10`.

## 2026-08-12 — Đưa `ecap-mobile/` và `Doc/` vào Git; rà soát mã nguồn mobile

Sửa 1 lỗi thật (`.files.single` không bọc `try/catch`, có thể ném `StateError`); di chuyển
`ecap-mobile/`/`Doc/` vào làm thư mục con của repo chính rồi commit (trừ `ClaudeRule.md`).

## 2026-08-13 — Địa chỉ Gateway động + cờ vị trí chấm công

`GatewayConfig.resolveBaseUrl()` đọc URL Gateway từ 1 Gist công khai — APK không cần build lại
khi tunnel Cloudflare đổi URL. Chấm công (web + mobile) gửi kèm toạ độ GPS tuỳ chọn, gắn cờ
"on-site"/"off-site" (soft flag, không chặn check-in/out).

## 2026-08-20 — 5 báo cáo lỗi thủ công

Lỗi gốc chung "thấy dữ liệu tổ chức cũ sau khi đổi tài khoản" — không phải lỗ hổng tenant, mà
`QueryClient` singleton không bị xoá cache khi đổi phiên (sửa bằng `queryClient.clear()`). Modal
mất focus liên tục khi gõ (dependency array không ổn định). Nút "hiện mật khẩu" của trình duyệt
mất đồng bộ với React state — tự vẽ `PasswordInput` riêng. Thêm cảnh báo (không chặn) khi mật
khẩu có dấu tiếng Việt.

## 2026-08-20 → 21 — Đa ngôn ngữ Việt/Anh/Nhật (i18n)

Rollout toàn bộ giao diện + thông báo lỗi backend: ~101 file frontend, 82 mã lỗi backend, 12
namespace × 3 ngôn ngữ. Phát hiện qua xác minh trực tiếp (không chỉ đọc code): container Docker
là build tĩnh, phải rebuild+up lại mới xác minh đúng; `getByLabel('Mật khẩu')` trở nên mơ hồ sau
khi có nút "hiện mật khẩu" (khớp cả 2 phần tử) — sửa bằng lọc theo role; nút chọn ngôn ngữ ở màn
đăng nhập lệch vị trí do CSS `absolute` áp lên phần tử sai.

*Chi tiết: Technical_Spec.md §18.*

## 2026-08-22 — Tier 1 (4 hạng mục chi phí thấp, ảnh hưởng rõ)

`npm audit fix` (13→7 lỗ hổng); xác minh `infra/.env` chưa từng lộ lên Git; phân trang thật cho
Dự án/Khách hàng; quản lý focus bàn phím cho `Dropdown.tsx`.

## 2026-08-22 — Tier 2 (testing, cứng hoá backend, hạ tầng)

Unit test mới cho `crm-service`/`hrm-service`; 3 e2e spec mới (CRM/HRM/Analytics); `coverageThreshold`
trên 8 service + 3 package. `/health` chuyển sang `@nestjs/terminus` cho cả 8 service; chặn
brute-force đăng nhập theo tài khoản; correlation ID xuyên suốt request. Alertmanager + 4 luật
cảnh báo (xác minh sống); ghim 6 image `:latest` sang digest; `scripts/backup.js`/`restore.js`
cho cả 8 nguồn dữ liệu. **Bonus fix phát hiện giữa chừng:** `ioredis` mặc định xếp hàng lệnh khi
mất kết nối thay vì từ chối ngay — vá cho `rate-limit.middleware.ts` (lỗi có từ trước, không phải
mới).

## 2026-08-22 — Tier 3 (ghi nhận, cố ý chưa triển khai)

Audit trail/soft-delete, các giới hạn `ecap-mobile` đã biết, nâng cấp TypeORM 0.3→1.0 (không làm
trước bảo vệ đồ án), lệch phiên bản React/Vite/ESLint. Xem `Doc/Upgrade.md` để theo dõi trạng
thái đầy đủ 3 Tier.

## 2026-08-24 — Rà soát toàn dự án lần 2 (7 lỗi Nghiêm trọng + ~13 lỗi Nghiêm trọng vừa)

Đợt rà soát độc lập với Tier 1/2/3 ở trên — 8 hướng rà soát song song (IAM+Gateway, Project&Task,
Document, Notification+Analytics, CRM+HRM, gói dùng chung+hạ tầng, Frontend, Mobile), tập trung
riêng vào lỗi có thể **treo hoặc sập hệ thống**, không phải lỗi phong cách. Phát hiện: bản vá
"bọc timeout quanh lệnh Redis" của Tier 2 (22/08) chỉ áp dụng ở 2/9 điểm cần — đây là nguồn gốc
phần lớn lỗi Nghiêm trọng dưới đây.

**Nghiêm trọng (Critical):**
- Kafka consumer (`notification-service`/`analytics-service`) không có `consumer.on(CRASH,...)` —
  Kafka mất kết nối kéo dài khiến consumer dừng VĨNH VIỄN, âm thầm, `/health` vẫn báo khoẻ. Sửa:
  bắt sự kiện CRASH, tự khởi động lại với backoff mũ (tối đa 30s).
- `AuthService.login()` (iam-service) gọi thẳng Redis không timeout — Redis lỗi khiến MỌI lần
  đăng nhập (kể cả đúng mật khẩu) bị treo/khoá cả tổ chức. Sửa: bọc timeout + fail-open.
- `jwt-auth.middleware.ts` (Gateway) kiểm tra blacklist không timeout — Redis lỗi khiến MỌI
  request đã xác thực qua Gateway bị treo hàng chục giây. Sửa tương tự.
- `MinioService.checkConnection()` (document-service) không timeout — SDK `minio` tự nó không
  đặt timeout trên bất kỳ HTTP call nào.
- `MinioService.putObject()` (document-service, hrm-service) không timeout — nghiêm trọng hơn ở
  document-service vì lệnh này chạy TRONG LÚC giữ khoá `pessimistic_write` trên Postgres, nên 1
  lần MinIO "treo" giữ luôn 1 connection Postgres vô thời hạn.
- `RedisService.getJson()`/`setJson()` (analytics-service) không timeout — đúng đường dẫn NÓNG
  (`/analytics/summary` được Dashboard polling, và AI insight).
- `ecap-mobile`: `tryAutoLogin()`/`_refresh()` ép kiểu cứng không có `try/catch` bao quát — 1
  response 200 sai hình dạng (captive Wi-Fi portal, proxy doanh nghiệp) khiến app kẹt VĨNH VIỄN ở
  màn hình khởi động. Sửa: bắt mọi lỗi, coi như "chưa đăng nhập".

**Nghiêm trọng vừa (Major):**
- `OutboxPublisherJob` (project-task-service) không cô lập lỗi từng bản ghi — 1 bản ghi lỗi vĩnh
  viễn chặn TOÀN BỘ hàng đợi sự kiện cho MỌI tổ chức. Sửa: `try/catch` từng bản ghi.
- `AttendanceService.checkOut()` (hrm-service) thiếu khoá `pessimistic_write` mà `checkIn()` đã
  có — 2 lần "Chấm công ra về" gần như đồng thời có thể ghi đè nhau. Sửa: mirror pattern đã dùng
  ở `LeaveRequestsService.decide()`.
- `FilesService.remove()` (document-service) đọc `FileVersion` NGOÀI transaction — cùng lớp lỗi
  đã sửa ở `FoldersService.remove()` (25/07/2026) nhưng chưa áp dụng lại ở đây, có thể làm mồ côi
  vĩnh viễn 1 object MinIO không dấu vết.
- `scripts/backup.js`/`restore.js`: 1 container down làm mất backup của bucket KHÔNG liên quan
  (vi phạm nguyên tắc cô lập lỗi từng nguồn); rủi ro shell-injection khi nội suy thẳng
  `MINIO_ROOT_PASSWORD`/tên bucket vào chuỗi lệnh `sh -c`. Sửa: cô lập theo bucket, truyền giá trị
  qua biến môi trường thay vì nội suy chuỗi.
- Gateway proxy REST không có `proxyTimeout` — downstream deadlock khiến request treo vô hạn.
- `UsersService.deactivate()` gọi `blacklistUser()` không có `try/catch` NGAY SAU KHI DB đã commit
  thành công — Redis lỗi khiến 1 thao tác ĐÃ THÀNH CÔNG báo lỗi 500 cho admin.
- Frontend: `extractErrorMessage()` kiểm tra `details` "truthy" thay vì `Array.isArray` — có thể
  crash ngay trong chính hàm xử lý lỗi; trang Dự án/Khách hàng hiện "không có kết quả" giả sau khi
  xoá hết mục ở trang cuối (không tự lùi trang); `TaskDetailModal` xoay vòng loading vô hạn nếu
  task bị xoá bởi người khác trong lúc đang xem.
- `Deal.value` (crm-service, cột Postgres `numeric`) trả về dạng chuỗi thay vì số — thiếu
  transformer, sai hợp đồng kiểu với DTO/frontend.
- `iam-service` `/health` chưa kiểm tra Redis dù `login()`/`deactivate()` đều phụ thuộc Redis.

**Cố ý KHÔNG sửa (không treo/sập hệ thống, ghi nhận lại):** nguy cơ cache-stampede ở Analytics
(quy mô SME thấp rủi ro); `failed-events-consumer.service.ts` chưa giới hạn số lần retry; thiếu
`ParseUUIDPipe` nhất quán trên toàn bộ path param dạng UUID; vài trang `ecap-mobile` chỉ bắt
`ApiException` (chưa từng bị kích hoạt với backend thật hiện tại); KHÔNG thêm `proxyTimeout` cho
WebSocket proxy (rủi ro cắt kết nối real-time hợp lệ lớn hơn lợi ích).

**Xác minh:** mỗi lỗi có 1 test hồi quy riêng (mô phỏng "treo" bằng fake timer, race condition
bằng mock tuần tự) — không chỉ sửa code suông. `typecheck`/`lint` (bằng baseline, không thêm
warning) sạch; `test:coverage` toàn workspace (503 test backend/package) sạch, mọi ngưỡng coverage
giữ vững (3 service tụt ngưỡng do code mới thêm test bù lại thay vì hạ ngưỡng); `build` production
sạch. Rebuild lại cả 9 image Docker liên quan — 22 container healthy; curl trực tiếp xác nhận
`iam-service` `/health` trả cả `database`/`redis`. Playwright e2e **11/11 qua, không cần thử lại
lần nào**.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 24/08/2026 (không tạo file
file:line riêng để tránh trùng lặp nội dung, theo đúng quy ước Technical_Spec.md đã áp dụng từ
21/07/2026); riêng phần `ecap-mobile` xem thêm `Doc/ECAP_Mobile.md` mục 15.*

---

## Lịch sử thay đổi tài liệu này

- **2026-08-24** — Khởi tạo file, gộp lại toàn bộ lịch sử rà soát/sửa lỗi từ 18/07/2026 (khởi tạo
  `Technical_Spec.md`) tới đợt rà soát cùng ngày — nguồn dữ liệu là mục "Lịch sử thay đổi tài
  liệu" của `Technical_Spec.md` và `ECAP_Mobile.md`, cô đọng lại thành 1 dòng thời gian duy nhất.
