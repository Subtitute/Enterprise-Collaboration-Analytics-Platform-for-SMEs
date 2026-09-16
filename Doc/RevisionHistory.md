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

## 2026-08-25 — Rà soát toàn dự án lần 3 (6 hướng song song, không giới hạn ở lỗi treo/sập)

Khác 2 đợt rà soát trước (Tier 1/2/3 ngày 22/08, lỗi treo/sập ngày 24/08) — đợt này mở rộng phạm
vi sang **mọi lỗi logic/đúng-sai**, không chỉ lỗi treo/sập hệ thống. 6 hướng song song: mã lỗi
i18n + Gateway, Frontend, Project-Task + CRM, IAM + Document, HRM + Notification + Analytics, và
hạ tầng + `ecap-mobile` + e2e (hướng cuối tự chia thêm 3 nhánh con: audit biến môi trường, review
sâu `ecap-mobile`, đối chiếu e2e với UI hiện tại).

**Nghiêm trọng (Critical):**
- `OutboxPublisherJob` của **4/5 service** (iam-service, document-service, hrm-service,
  crm-service) vẫn là bản CHƯA sửa lỗi cô lập từng bản ghi — bản vá 22/08/2026 (`try/catch` từng
  record, không để 1 bản ghi lỗi chặn cả hàng đợi) chỉ từng được áp dụng cho project-task-service,
  dù chính file đó tự nhận là "MẪU THAM CHIẾU" cho các service kia. Sửa: áp dụng lại đúng bản vá
  cho cả 4 service.
- `FilesService.remove()` (document-service) — bản sửa 22/08 (đọc `FileVersion` TRONG transaction)
  vẫn thiếu khoá `pessimistic_write` trên `FileMeta`, nên vẫn có thể đua với `uploadNewVersion()`
  đang chạy song song: phiên bản file mới được upload lọt vào khoảng hở giữa lúc đọc và lúc xoá,
  bị xoá CASCADE theo `FileMeta` nhưng object MinIO của nó không nằm trong danh sách dọn — mồ côi
  vĩnh viễn, không còn dấu vết DB nào để đối chiếu lại. Sửa: khoá `FileMeta` trước khi đọc
  `FileVersion`, mirror đúng pattern `uploadNewVersion()` đã dùng.

**Nghiêm trọng vừa (Major):**
- `MinioService.removeObject()` (document-service) — chưa được bọc timeout như `putObject()`/
  `checkConnection()`, dù cùng 1 rủi ro "SDK không tự đặt timeout".
- Sidebar bị bỏ sót hoàn toàn khỏi đợt rollout i18n — nút thu gọn/mở rộng thanh bên luôn hiện
  tiếng Việt (`title`/`aria-label`) dù đang xem giao diện Anh/Nhật.
- Continuous aggregate TimescaleDB (`daily_task_summary`/`weekly_project_progress`/
  `daily_document_activity`) gộp nhóm theo **ngày UTC**, không phải GMT+7 như quy ước xuyên suốt dự
  án — hoạt động 00:00–06:59 giờ VN bị gán nhầm sang ngày hôm trước trên biểu đồ xu hướng Dashboard.
  Sửa: thêm tham số timezone `'Asia/Ho_Chi_Minh'` vào `time_bucket()`. Chỉ áp dụng cho lần cài đặt
  MỚI (dự án không có migration runner; môi trường đang chạy sẵn cần drop + tạo lại 3 view thủ công).
- `ecap-mobile`: bản vá 22/08 (bắt mọi lỗi thay vì chỉ `DioException`) chỉ áp dụng cho
  `_refresh()`/`tryAutoLogin()`, chưa đồng bộ cho `login()` và 6 hàm gọi API còn lại
  (`get`/`getList`/`postJson`/`patch`/`postPhoto`/`postFile`) dù cùng 1 kiểu ép kiểu response — 1
  response 200 sai hình dạng khi đăng nhập/gọi API nem `TypeError` CHƯA ĐƯỢC BẮT, thất bại âm thầm
  không rõ lý do thay vì hiện thông báo lỗi.
- `ecap-mobile`: `GatewayConfig.resolveBaseUrl()` ghi cache (`cacheFile.writeAsString`) không có
  `try/catch`, trong khi 2 bước còn lại của hàm này đều có — lỗi ghi đĩa (hết dung lượng, quyền bị
  thu hồi) khiến app kẹt VĨNH VIỄN ở màn hình khởi động, cùng 1 lớp lỗi vừa được sửa ở
  `api_client.dart` nhưng tái diễn ở file khác.

**Nhẹ (Minor), đã sửa:**
- `AllExceptionsFilter` (dùng chung 8 service) không gán `errorCode` cho lỗi 500 KHÔNG PHẢI
  `HttpException` (lỗi thật sự không lường trước) — người dùng Anh/Nhật vẫn thấy message tiếng
  Việt thay vì bản dịch `ERROR_CODES.INTERNAL_ERROR` đã có sẵn.
- `restartWithBackoff()` (Kafka consumer, notification-service + analytics-service) không huỷ
  timer backoff đang chờ khi `onModuleDestroy()` — service bị tắt (redeploy container) đúng lúc
  đang "ngủ" giữa 1 lần backoff sẽ tự kết nối lại "ma" sau khi coi như đã tắt xong.
- `ecap-mobile`: `_refresh()`/`tryAutoLogin()` bắt lỗi nhưng không ghi log gì — không thể debug từ
  xa khi gặp lỗi phân tích response. Thêm `debugPrint` (không ảnh hưởng bản release).
- `ecap-mobile`: 3 trang (`notifications_page`, `leave_requests_page`, `tasks_page`) gọi lại
  `_load()` sau 1 `await` mà không kiểm tra `mounted` trước — có thể `setState()` sau khi widget đã
  dispose (vd người dùng đăng xuất giữa lúc đang chờ).

**Cố ý KHÔNG sửa (ghi nhận lại, không phải lỗi mới):**
- `withTimeout()` (mọi service dùng Redis) chỉ đua ở phía gọi — lệnh Redis bên dưới vẫn nằm trong
  hàng đợi nội bộ của ioredis (`enableOfflineQueue: true` mặc định) và có thể vẫn thực thi/ghi dữ
  liệu sau khi phía gọi đã "bỏ cuộc". Hướng cải thiện khả dĩ: đặt `commandTimeout` thẳng trên client
  ioredis — CHƯA áp dụng vì cần kiểm thử sống (thay đổi hành vi reconnect của ioredis), không phải
  sửa an toàn có thể xác minh chỉ bằng test giả lập.
- Cơ chế fail-open của chặn brute-force đăng nhập (iam-service, quyết định có chủ đích từ 22/08)
  không có cảnh báo/metric khi Redis lỗi kéo dài — là đề xuất tính năng quan sát mới, ngoài phạm vi
  "sửa lỗi" của đợt rà soát này.
- `coordinate.util.ts` (hrm-service): tên field lỗi (`latitude`/`longitude`) không được dịch sang
  nhãn thân thiện ở Anh/Nhật trong thông báo lỗi — nhất quán với quyết định đã chốt từ đợt i18n
  (giữ nguyên tên property thô, không dịch), chỉ là góc nhỏ chưa hoàn thiện.
- Last-admin lockout (`UsersService.deactivate()`) — hạn chế đã biết và đã ghi chú trong code từ
  trước, vẫn còn mở.
- Outbox chưa có giới hạn số lần retry/dead-letter cho 1 bản ghi lỗi VĨNH VIỄN (khác lỗi tạm thời)
  — sẽ retry mỗi 2.5s mãi mãi, chiếm 1 trong 50 slot mỗi lượt; hạn chế vận hành, không phải lỗi
  đúng-sai.
- Toàn bộ e2e Playwright, RBAC/guard của IAM + Document Service, transaction/khoá của
  Project-Task + CRM, và env var toàn hạ tầng: rà soát kỹ, KHÔNG phát hiện lỗi mới.

**Xác minh:** `typecheck` (root, cả 8 service backend + web) sạch; `test` toàn bộ workspace pass
(document-service 106/106, crm-service 37/37, analytics-service 103/103, gateway 50/50, hrm-service
39/39, iam-service 52/52, notification-service 28/28, common-guard 32/32, web 18/18 — không service
nào tụt test); `flutter analyze` sạch (1 cảnh báo info-level có sẵn từ trước, không liên quan tới
sửa đổi lần này).

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 25/08/2026 (không tạo file
file:line riêng, theo đúng quy ước đã áp dụng từ đợt 24/08/2026).*

## 2026-08-25 (bổ sung) — Review bảo mật chuyên biệt (OWASP-style, 6 hướng song song)

Khác các đợt trên (lỗi treo/sập, lỗi logic đúng-sai) — đợt này dùng riêng lăng kính **bảo mật**:
authN/session/token, authorization/IDOR (4 service chưa từng rà theo góc này), injection/XSS/
deserialization, secrets + cấu hình hạ tầng, file/object storage, và realtime + rate-limit + bề
mặt DoS. Kỹ năng `security-review` (yêu cầu `git diff`) không dùng được do môi trường không cài
`git` — thay bằng 6 agent song song đọc trực tiếp mã nguồn.

**Đã sửa:**
- Rate-limit của Gateway **không bao giờ được áp dụng** cho request thiếu/sai token — middleware
  xác thực JWT trả 401 ngay, không gọi `next()`, nên không bao giờ tới được middleware rate-limit
  đăng ký sau nó; kẻ tấn công flood 1 route bất kỳ với token rỗng/giả ở tốc độ tuỳ ý mà không bao
  giờ bị 429. Sửa: tách logic kiểm tra rate-limit thành `checkRateLimit()` dùng chung, gọi trực
  tiếp từ nhánh 401 trước khi phản hồi.
- WebSocket (`AnalyticsGateway`, `NotificationsGateway`) chỉ verify JWT, **không kiểm tra
  blacklist** — 1 tài khoản vừa bị deactivate vẫn mở được kết nối WS mới và tiếp tục nhận dữ liệu
  hoạt động real-time tới khi access token hết hạn tự nhiên (tối đa 15 phút), khác hẳn REST (đã
  chặn ngay từ 21/07/2026). Sửa: cả 2 gateway tự kiểm tra `blacklist:user:<id>` qua Redis trước
  khi cho `join()` phòng (fail-open nếu Redis lỗi) — bổ sung `RedisService` mới cho
  notification-service (trước đây hoàn toàn không dùng Redis).
- `AnalyticsGateway` chỉ xác thực (verify JWT), **không uỷ quyền** (không kiểm tra quyền
  `analytics:view` như REST đã làm) — 1 nhân viên không có quyền xem báo cáo vẫn thụ động nhận
  được feed hoạt động real-time của cả tổ chức qua WS. Sửa: thêm kiểm tra quyền tại
  `handleConnection()`.
- **`GET /analytics/ai-insights?departmentId=<uuid>`**: `departmentId` chỉ được validate LÀ UUID,
  không kiểm tra có thực sự thuộc tổ chức gọi hay không — vì tham số này nằm trong khoá cache, 1
  người dùng có quyền `analytics:view` (Manager/Admin mặc định) có thể gửi 1 UUID ngẫu nhiên MỖI
  LẦN để luôn cache-miss, ép hệ thống luôn gọi API Gemini/Groq thật — 2 khoá API này dùng CHUNG
  TOÀN NỀN TẢNG (không tách theo tổ chức), nên 1 tổ chức có thể đơn phương làm cạn hạn ngạch miễn
  phí của MỌI tổ chức khác. Sửa: thêm `AnalyticsService.departmentExists()` (tra `dim_user`), từ
  chối 400 trước khi chạm tới cache/LLM nếu `departmentId` không khớp tổ chức.
- Email đăng ký tổ chức mới (`registerOrganization()`) và mời thành viên (`invite()`) không được
  chuẩn hoá (trim + chữ thường) trước khi lưu/so khớp trùng lặp — cột `email` là Postgres thường
  (phân biệt hoa/thường), nên `"Alice@Example.com"` không khớp được với `"alice@example.com"` đã
  đăng ký trước đó, tạo được 1 tài khoản/tổ chức THỨ HAI nhìn-giống-hệt email thật của người khác.
  Phát hiện thêm khi sửa: chính `login()` cũng dùng `dto.email` THÔ (chưa chuẩn hoá) để tra cứu tài
  khoản dù bộ đếm throttle đã chuẩn hoá đúng — một người dùng gõ hoa đầu email (trình duyệt tự viết
  hoa) sẽ không tìm thấy được chính tài khoản của họ dù gõ đúng mật khẩu. Sửa cả 3 điểm.
- Log lỗi Kafka (`analytics-service`, `notification-service`) nhúng nguyên văn nội dung event/
  message vào dòng log dạng văn bản thuần khi gặp envelope không hợp lệ/lỗi dữ liệu vĩnh viễn — 1
  số payload (vd `USER_REGISTERED`) mang email người dùng, bị ghi lặp thừa vào log server trong khi
  bản sao bền vững thật sự cần giữ (để replay) đã có sẵn trong `rawPayload` của bản ghi DLQ. Bỏ
  phần nhúng nội dung, chỉ log `eventId`/`eventType`.
- `Object.assign(department, dto)` (iam-service) — không phải lỗ hổng đang khai thác được
  (`class-transformer` 0.5.1 + `whitelist:true` đã chặn `__proto__`/`constructor` từ trước) nhưng
  đổi sang gán từng field rõ ràng, bỏ hẳn phụ thuộc vào whitelist của thư viện — phòng khi DTO này
  mở rộng thêm field trong tương lai.
- Hạ tầng (`infra/docker-compose.yml`): cổng console quản trị MinIO (9011) và toàn bộ tầng dữ
  liệu/quan sát (5 Postgres + TimescaleDB + MongoDB + Redis + Kafka + Prometheus + Alertmanager +
  Grafana, ~13 điểm) trước đây mở ra TOÀN BỘ mạng (cú pháp cổng trần, Docker mặc định bind
  `0.0.0.0`) dù comment sẵn có từ lâu đã nói rõ ý định chỉ debug từ máy host — giới hạn về
  `127.0.0.1`. Mật khẩu Grafana mặc định fail-open về đúng `"admin"` (mật khẩu mặc định CHUẨN của
  chính Grafana, mục tiêu dò quét đầu tiên) khi biến môi trường chưa được đặt — đổi sang giá trị
  yếu-nhưng-không-phải-mặc-định, đồng bộ quy ước với các mật khẩu dev khác trong `.env.example`.
  `MINIO_PUBLIC_USE_SSL` bị hardcode `"false"` (không đọc được từ `.env`) dù code ứng dụng đã hỗ
  trợ bật TLS qua biến này — đổi sang có thể ghi đè (mặc định vẫn `false`, không đổi hành vi hiện
  tại).

**Cố ý CHƯA sửa (ghi nhận, cần việc riêng có xác minh sống):**
- **Nghiêm trọng nhất chưa xử lý**: `getClientIp()` (Gateway) tin tưởng header `X-Real-IP` vô điều
  kiện, đúng khi Nginx là cổng vào DUY NHẤT — nhưng `docker-compose.yml` cũng expose thẳng cổng
  3000 của Gateway ra host (cố ý, phục vụ `ecap-mobile` kết nối trực tiếp qua LAN/Cloudflare
  Tunnel, không qua Nginx). Kết nối thẳng tới cổng 3000 kèm `X-Real-IP` tự đặt sẽ vô hiệu hoá hoàn
  toàn rate-limit theo IP của Gateway (kể cả chặn brute-force đăng nhập theo IP), vì mỗi request
  tạo 1 khoá Redis mới. Chưa sửa vì cách khắc phục đúng (chỉ tin header khi kết nối THỰC SỰ đến từ
  Nginx — qua IP tĩnh trên `internal-net` hoặc secret header do Nginx tự chèn qua envsubst
  template) đòi hỏi thay đổi cấu hình mạng Docker hoặc pipeline build Nginx, cần kiểm thử sống
  (curl giả mạo thật) trên stack đang chạy trước khi áp dụng — không phải thứ sửa "mù" an toàn.
- Email enumeration qua `POST /auth/register-organization` (409 phân biệt được "email đã dùng" —
  khác `login()` đã cố tình làm phẳng) — không có hạ tầng xác minh email để "đăng ký âm thầm" đúng
  cách; giảm nhẹ một phần khi phát hiện trên được sửa (rate-limit theo IP lúc đó mới thực sự chặn
  được tốc độ dò).
- `x-internal-secret` là 1 secret tĩnh, dùng chung toàn nền tảng, không xoay vòng, không ràng buộc
  mật mã với danh tính claim trong header đi kèm — nếu rò rỉ, kẻ có secret mạo danh được BẤT KỲ ai
  ở BẤT KỲ tổ chức nào với BẤT KỲ quyền nào. Đã có fail-closed lúc khởi động (không mới); nâng cấp
  thật (secret riêng từng service, token ký ngắn hạn) là thay đổi kiến trúc, không phải 1 lần sửa.
- Toàn bộ CORS, header bảo mật HTTP (`helmet`, security header của Nginx), logging hygiene (không
  log password/token/body đầy đủ), non-root Docker, và toàn bộ SQL/NoSQL injection/XSS/eval: rà
  soát kỹ, KHÔNG phát hiện lỗ hổng — codebase đã qua ít nhất 1 đợt bảo mật trước đó.

**Xác minh:** `typecheck` (root) sạch; `npm audit` baseline không đổi (3 lỗ hổng moderate,
`react-router`/`uuid`, chỉ vá được bằng breaking change, đã ghi nhận từ Tier 1); quét toàn bộ
workspace (`npm test --workspaces` + `apps/web` riêng, do `e2e` thiếu script `test` từ trước) —
tất cả pass, không service nào tụt test/ngưỡng coverage: analytics-service 121/121, crm-service
39/39, document-service 111/111, gateway 52/52, hrm-service 41/41, iam-service 55/55,
notification-service 50/50, project-task-service 28/28, common-dto 10/10, common-guard 35/35,
common-metrics 5/5, web 18/18. `docker compose config` xác nhận cú pháp `docker-compose.yml` sau
sửa hạ tầng vẫn hợp lệ (chưa `docker compose up` sống lại toàn stack trong lượt này).

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 25/08/2026 (phần review bảo mật,
tiếp sau phần rà soát lỗi logic cùng ngày ở trên).*

## 2026-08-25 (bổ sung — merge nhánh frontend của Nguyễn Lê Tiến)

Merge nhánh `frontend` của Tiến vào nhánh đang làm việc, phát sinh xung đột ở 2 file:

- **`Sidebar.tsx`:** xung đột với chính nút thu gọn/mở rộng thanh bên (đã qua rà soát khả năng
  tiếp cận 28/07/2026) — phía nhánh Tiến không sửa đoạn này (rỗng), giữ nguyên bản có nút.
- **`ProjectsListPage.tsx`:** xung đột với bản vá "tự lùi về trang cuối hợp lệ sau khi xoá dự án"
  (22/08/2026, xem mục "Rà soát toàn dự án lần 3" ở trên). Đây không phải trường hợp chọn 1 trong
  2 — cả hai đều cần thiết và không loại trừ nhau: JSX render (phần không xung đột, nằm sau đoạn
  conflict) đã sẵn tham chiếu `orderedProjects`/`draggedId`/`handleDragStart` do nhánh Tiến định
  nghĩa, nên phải giữ nguyên state + `useEffect` sắp xếp của Tiến; đồng thời giữ nguyên `useEffect`
  tự lùi trang của bản vá 22/08 — 2 đoạn logic độc lập, không chồng lấn hành vi. Gộp cả hai.

**Đóng góp của Nguyễn Lê Tiến (nhánh `frontend`):** tính năng kéo-thả sắp xếp tuỳ chỉnh thứ tự thẻ
dự án (lưu `localStorage`), lọc theo độ ưu tiên, và gom nhóm dự án đã hoàn thành xuống cuối danh
sách — chi tiết ở Technical_Spec.md §3.3.

**Nhóm thực hiện đồ án (3 thành viên):** Dương Minh Quang, Nguyễn Lê Tiến, Thiều Quang Thành —
điền vào trang bìa `Doc/GraduationReport.tex`.

*Chi tiết: Technical_Spec.md, mục "2026-08-25 (merge nhánh frontend của Nguyễn Lê Tiến)".*

## 2026-08-26 — Rà soát toàn dự án lần 4 (~30 phát hiện, đã sửa toàn bộ)

Đợt rà soát chủ động thứ 4 (sau lần 1 kiến trúc/bảo mật/testing 21/07, lần 2 lỗi treo/sập 24/08,
lần 3 mọi lỗi logic 25/08, cộng đợt bảo mật OWASP riêng 25/08) — 6 hướng song song (Gateway+IAM;
Project-Task+CRM+rà lại 2 file vừa merge; Document+HRM; Notification+Analytics; toàn bộ Frontend
web; Hạ tầng+gói dùng chung+`ecap-mobile`). Phát hiện ~30 lỗi mới — nhiều hơn hẳn 3 đợt trước cộng
lại, tập trung ở khu vực vừa thay đổi gần đây nhất (tính năng Projects mới merge, các modal Admin).
Toàn bộ đã được sửa (người dùng chủ động yêu cầu sửa hết, kể cả mức Nhẹ).

**2 lỗi mức Nghiêm trọng:**
- `apps/web/src/features/projects/api.ts`: `completeProject()`/`reopenProject()` nuốt mọi lỗi và
  luôn fabricate 1 object `Project` giả coi như thành công — 1 request thất bại (403, mất mạng) vẫn
  hiện toast thành công VÀ ghi đè trạng thái vào cache/localStorage vĩnh viễn, không bao giờ báo lỗi
  thật. Sửa: ném lại lỗi thật; chỉ ghi localStorage SAU khi có phản hồi thành công thật sự. Trong
  lúc sửa phát hiện thêm: nhánh fallback `PATCH {status:'ACTIVE'}` của `reopenProject()` (giữ lại
  "phòng khi /reopen lỗi") tái tạo đúng lỗi vừa sửa — vì `status` đã bị bỏ khỏi `UpdateProjectDto`
  (xem bên dưới) và `ValidationPipe` chỉ bật `whitelist: true` (không `forbidNonWhitelisted`), PATCH
  này chỉ ÂM THẦM loại bỏ field lạ rồi trả về 200 với project KHÔNG ĐỔI trạng thái — hàm coi như
  thành công, ghi đè localStorage sang ACTIVE dù server vẫn ARCHIVED. Bỏ hẳn fallback này.
- `apps/document-service/src/folders/folders.service.ts`: `FoldersService.remove()` xoá file xuyên
  thư mục mà không khoá `pessimistic_write` trước — cùng lỗi đã sửa ở `FilesService.remove()`
  (25/08) nhưng bỏ sót ở đây, có thể mồ côi đối tượng MinIO khi đua với `uploadNewVersion()`.

**~20 lỗi mức Nghiêm trọng vừa, đáng chú ý:**
- Gateway: nhánh 401 tài khoản bị blacklist bỏ qua kiểm tra rate-limit (2 nhánh 401 khác đã được
  sửa 25/08 nhưng nhánh này thì chưa).
- Gateway + IAM: `INCR`/`EXPIRE` không nguyên tử — mất kết nối giữa 2 lệnh có thể để lại counter
  không bao giờ hết hạn (khoá vĩnh viễn). Sửa bằng Lua script nguyên tử (`incrWithExpire`).
- IAM `UsersService.update()`: không khoá — 2 admin sửa cùng 1 user đồng thời có thể âm thầm ghi đè
  đổi role/phòng ban của nhau. Áp dụng `pessimistic_write` giống các service khác.
- Project-Task: `PATCH /projects/:id` cho phép đổi `status` trực tiếp, bỏ qua khoá/state-machine/
  Outbox event của `complete()`/`reopen()`/`archive()`. Bỏ field `status` khỏi `UpdateProjectDto`.
  Phát hiện thêm khi sửa: `ProjectsService.complete()` có sẵn 1 test (viết 22/07/2026) mong đợi ném
  `BadRequestException` khi request "thua cuộc" trong race condition, nhưng implementation lại âm
  thầm `return` — 1 error code `PROJECT_ALREADY_COMPLETED` đã khai báo sẵn trong `common-dto` nhưng
  chưa bao giờ được dùng (bằng chứng rõ đây là hồi quy, không phải thiết kế có chủ đích). Sửa cả 2
  nhánh (pre-check + re-check trong transaction) của `complete()` để ném lỗi, đồng bộ với pattern đã
  đúng sẵn ở `archive()`.
- Document: `RESTRICTED` không kế thừa xuống thư mục con — thư mục con mới tạo luôn mặc định mở cho
  cả tổ chức, bỏ qua hạn chế của thư mục cha.
- HRM: `checkOut()` tính lại "hôm nay" độc lập với `checkIn()` — ca làm việc qua nửa đêm (GMT+7)
  không thể check-out.
- Notification: consumer DLQ riêng (`failed-events-consumer.service.ts`) chưa có cơ chế tự khởi
  động lại sau CRASH như consumer chính (đã sửa 22/08).
- Analytics: `dim_user` upsert không có bảo vệ thứ tự — 1 sự kiện resync khởi động lại (từ
  `onApplicationBootstrap`) đến muộn có thể ghi đè 1 thay đổi phòng ban thật gần đây hơn, làm sai
  KPI theo phòng ban.
- Hạ tầng: mật khẩu Mongo không được encode trong `MONGO_URI` — mật khẩu chứa ký tự đặc biệt (đúng
  theo khuyến cáo của chính `.env.example`) làm sập kết nối. Chuyển sang truyền field rời + mã hoá
  qua `encodeURIComponent()`, giống pattern Postgres/Redis.
- Frontend: `Sidebar.tsx` có 2 nút thu gọn/mở rộng trùng lặp (1 trong `SidebarHeader`, 1 riêng của
  `Sidebar()`) — chỉ 1 nút được dịch đầy đủ qua các đợt i18n trước, nút còn lại luôn hiện tiếng
  Việt. Gộp lại còn 1 nút duy nhất (giữ vị trí ở `SidebarHeader`).
- Frontend: giá trị Priority/Lead của dự án CHỈ lưu localStorage từng trình duyệt, không bao giờ
  gửi lên backend — vô hình với mọi thành viên khác dù đây là nền tảng cộng tác. Bổ sung cột thật
  (`priority`, `leadUserId`) vào `Project` entity + DTO (project-task-service, `synchronize: true`
  nên không cần migration thủ công), frontend gửi thẳng qua API thay vì localStorage.
- `CustomFilterSelect.tsx`: resize listener add/remove dùng 2 function reference khác nhau — không
  bao giờ gỡ đăng ký được, rò bộ nhớ khi mở/đóng bộ lọc nhiều lần.
- `DatePicker.tsx`: hoàn toàn chưa được dịch (sót lại từ đợt rollout i18n), chấp nhận ngày không
  hợp lệ (31/02 tự động lệch sang tháng 3), không có Escape/focus-trap/`aria-expanded`.
- `CheckInCamera.tsx`: rò object URL mỗi lần check-in/out thành công; camera có thể "treo" không
  tắt được nếu đóng modal đúng lúc đang xin quyền truy cập.
- `LeaveRequestsPage.tsx`: 1 mutation object dùng chung cả danh sách — duyệt 1 đơn làm "đông cứng"
  nút của mọi đơn khác.
- `RecentActivityFeed.tsx`: câu mô tả hoạt động ("X đã tạo công việc mới") vẫn hardcode tiếng Việt
  dù toàn bộ widget còn lại đã dịch.
- `AnalyticsPage.tsx`: đổi bộ lọc sau khi đã có Nhận xét AI có thể để lại nội dung cũ hiển thị dưới
  caption mới.
- Các modal Admin (DepartmentModal/EditMemberModal/InviteMemberModal): closure `onSuccess` cũ có
  thể đóng nhầm modal vừa mở lại/xoá dữ liệu đang nhập dở nếu request "đã huỷ" trước đó phản hồi
  trễ. Sửa bằng cách chặn mọi đường đóng modal (kể cả Escape/backdrop, không chỉ nút Cancel) trong
  lúc mutation đang chờ.
- `NewProjectModal.tsx` (thực chất phát hiện lại ở `api.ts`, xem lỗi Nghiêm trọng #1) — ghi "ghim
  dự án mới lên đầu" vào sai localStorage key, dead code, không bao giờ hoạt động.
- `ecap-mobile`: 2 file còn sót (`attendance_page.dart`, `documents_page.dart`) chưa được áp dụng
  guard `if (mounted)` sau `await`, cùng lỗi đã sửa ở 3 file khác 25/08.

**Vài lỗi Nhẹ:** thiếu `depends_on: redis` cho notification-service trong docker-compose;
`UploadModal`/`VersionHistoryModal` thiếu abort/validate khi upload; `LoginPage` bỏ qua lỗi
clipboard; chuỗi "Đang tìm kiếm..." hardcode ở `Topbar`; hook `useAllDealsQuery` chết (không nơi
nào gọi — tính năng đã được thay bằng aggregation phía backend, `customer.openDealCount`/
`openDealValue`, từ trước) — xoá hẳn; JSX validate "priority required" không bao giờ render được
(vì `priority` luôn có giá trị mặc định) — xoá.

**Cố ý CHƯA sửa (ghi nhận):**
- Bộ lọc độ ưu tiên trên danh sách Dự án chỉ lọc trong phạm vi 1 trang server-paginated (~20 mục)
  — có thể khiến danh sách trông trống dù có kết quả khớp ở trang khác; sửa đúng cần chuyển bộ lọc
  lên server (thêm tham số `priority` cho `GET /projects`), ngoài phạm vi đợt sửa lỗi frontend này.
- Kéo-thả sắp xếp có thể xen lẫn nhóm "đang hoạt động"/"đã hoàn thành" cho tới lần tính lại kế tiếp
  — hạn chế nhỏ, chỉ ảnh hưởng thứ tự hiển thị cục bộ, không ảnh hưởng dữ liệu thật.

**Xác minh:** `npm run typecheck` (root, rebuild `packages/common-*` trước) sạch trên toàn bộ 8
service + web; `npm run test --workspaces` toàn bộ pass — analytics-service 123/123, crm-service
39/39, document-service 111/111, gateway 53/53, hrm-service 41/41, iam-service 55/55,
notification-service 55/55, project-task-service 28/28 (bao gồm sửa lại đúng test `complete()` đã
fail trước khi vá xong), web 18/18, common-dto 10/10, common-guard 35/35, common-metrics 5/5 —
tổng 573 test, không còn thất bại nào ngoài workspace `e2e` (thiếu script `test`, giới hạn đã biết
từ trước, không phải hồi quy). `flutter analyze` (`ecap-mobile`) sạch, 1 cảnh báo info-level có sẵn
không liên quan tới các sửa đổi này.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 26/08/2026.*

## 2026-08-26 (bổ sung) — 5 đề xuất cải thiện sau lần rà soát 4, triển khai toàn bộ

Sau khi tổng kết đợt rà soát lần 4 ở trên, tôi tự đưa ra 5 đề xuất cải thiện dựa trên các mẫu lỗi
lặp lại quan sát được — và triển khai toàn bộ ngay (không chỉ dừng ở đề xuất), theo đúng tinh thần
"phòng ngừa lỗi tái diễn" thay vì chỉ vá từng lỗi đơn lẻ khi bị phát hiện.

**1. Rà lại toàn bộ `features/projects/` xem còn field nào khác kiểu "chỉ lưu localStorage" như
priority/lead không.** Kết quả: KHÔNG có thêm — đã kiểm tra kỹ `ec_projects_metadata` (chỉ còn lại
1 override "status" tạm thời SAU khi API thành công, đúng thiết kế, và 1 đường đọc fallback dữ
liệu cũ trước khi có cột backend) và `ec_projects_custom_order` (thứ tự kéo-thả, cố ý chỉ lưu cục
bộ, đã ghi nhận từ trước) — cả hai đều đúng thiết kế, không sửa gì.

**2. Rà toàn bộ `features/*/api.ts` tìm mẫu lỗi "nuốt lỗi, tra ve gia tri gia" giống
`completeProject()`/`reopenProject()` đã sửa.** Kết quả: KHÔNG tìm thấy thêm — toàn bộ 9 file
`api.ts` còn lại không có khối `try/catch` nào (lỗi tự trôi thẳng lên React Query như thiết kế
đúng); lỗi này có vẻ là điểm lỗi đơn lẻ, không phải mẫu lặp lại trong codebase.

**3. Gộp toàn bộ điểm rời `jwt-auth.middleware.ts` (Gateway) về 1 checkpoint rate-limit duy nhất.**
Lý do: 3 đợt rà soát riêng biệt (25/08, và 2 lần trong 26/08) đã lần lượt tìm ra 3 nhánh early-
return khác nhau bị bỏ sót kiểm tra rate-limit — dấu hiệu cấu trúc file (mỗi nhánh phải TỰ nhớ gọi
kiểm tra) dễ tái phát lỗi này. Khi rà lại lần này phát hiện thêm **nhánh thứ 4** (lỗi nội bộ 500
sau khi xác thực thành công) cũng bỏ sót. Tái cấu trúc: mọi nhánh từ chối giờ đi qua đúng 1 hàm
`sendGatedResponse()` luôn gọi `checkRateLimit()` trước khi phản hồi — về mặt cấu trúc, không còn
cách nào thêm nhánh từ chối mới mà quên rate-limit được nữa (không chỉ đúng do soi kỹ tại thời điểm
này). Không đổi ngưỡng/TTL/logic tăng nguyên tử đã sửa 26/08.

**4. Tự động hoá việc phát hiện chuỗi tiếng Việt sót lại ngoài i18n.** Ba đợt review riêng biệt
(DatePicker.tsx, RecentActivityFeed.tsx, Topbar.tsx) đều phải tìm lỗi này BẰNG TAY, SAU KHI đợt
rollout i18n đã được coi là "hoàn tất" — dấu hiệu cần một công cụ tự động thay vì tiếp tục dựa vào
rà soát thủ công mỗi lần. Viết `scripts/check-hardcoded-vietnamese.js` (quét `apps/web/src/**/*.
{ts,tsx}`, bỏ comment, phát hiện ký tự có dấu tiếng Việt còn sót ngoài `t()`), thêm script
`lint:i18n-strings` và 1 bước mới trong `.github/workflows/ci.yml` (chạy ngay sau ESLint). Chạy
lần đầu phát hiện 26 dòng bị gắn cờ: 2 báo động giả từ pattern regex dò dấu tiếng Việt trong mật
khẩu/tên vai trò (`lib/utils.ts` — đã ghi `i18n-lint-ignore` cho 2 dòng đó) và 24 vi phạm thật. Tự
sửa 1 trong số đó (`extractErrorMessage()` trong `lib/api-client.ts` có tham số `fallback` mặc
định là chuỗi tiếng Việt cứng — chuyển sang `i18n.t('common:genericError')`, key mới thêm cả 3
ngôn ngữ) rồi giao 23 vi phạm còn lại (trải trên 7 file component) cho 1 đợt dịch riêng, đáng chú ý:
`Sidebar.tsx` (2 chuỗi sót từ đợt fix i18n 25/08), `LoginPage.tsx` (5 chuỗi trong khối "Tài khoản
Demo"), `TaskStatusDonut.tsx` (1), và **`ProjectCard.tsx`/`ProjectDetailPage.tsx`/
`EditProjectModal.tsx`/`NewProjectModal.tsx` (13 chuỗi)** — phần lớn phát sinh MỚI từ chính tính
năng priority/lead vừa chuyển sang backend hôm nay (mục 2 của đợt rà soát lần 4), xác nhận đúng lo
ngại ban đầu: tính năng mới thường "quên" i18n trước khi có công cụ tự động bắt lỗi này. Đã dịch
toàn bộ 23 chuỗi sang vi/en/ja; nhân tiện gộp 2 bản sao y hệt nhau của object nhãn priority (
`ProjectCard.tsx`/`ProjectDetailPage.tsx`) thành 1 hàm `projectPriorityMeta()` dùng chung trong
`features/projects/utils.ts`, mirror đúng `projectStatusMeta()` đã có sẵn cùng file.

**5. Gộp guard "không cho đóng modal khi mutation đang chờ" vào `Modal.tsx` dùng chung.** 4 modal
Admin/Upload đã tự viết guard riêng hôm 26/08 (đợt rà soát lần 4) — nếu modal mới nào sau này cũng
cần guard này, người viết code dễ quên. Thêm prop `preventCloseWhilePending?: boolean` vào
`Modal.tsx` (chặn Escape/backdrop/nút X khi bật), 4 modal cũ chuyển sang dùng prop này thay vì guard
viết tay. Rà toàn bộ `<Modal` trong codebase tìm thêm chỗ có cùng rủi ro (mutation gọi `onSuccess:
onClose` nhưng KHÔNG có guard nào) — tìm thấy **8 modal khác** cùng lỗ hổng y hệt
(`NewTaskModal`, `NewLeaveRequestModal`, `ShareModal`, `NewCustomerModal`, `NewDealModal`,
`NewFolderModal`, `EditProjectModal`, `NewProjectModal`) — áp dụng prop mới cho cả 8, cộng thêm
`disabled` cho nút Cancel của từng modal (trước đó hoàn toàn không có, khác 4 modal gốc).

**Xác minh cuối cùng (toàn bộ 5 mục cộng dồn):** `npm run typecheck` (root) sạch; `npm run test
--workspaces` toàn bộ pass, vẫn đúng 573/573 test như đợt rà soát lần 4 (không hồi quy); `node
scripts/check-hardcoded-vietnamese.js` thoát mã 0 ("Sạch — không còn chuỗi tiếng Việt có dấu nào
ngoài comment trong 119 file đã quét"); toàn bộ file JSON locale đã sửa xác minh hợp lệ.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 26/08/2026 (phần 5 đề xuất cải
thiện, tiếp sau phần rà soát lần 4 cùng ngày ở trên).*

## 2026-08-27 — Rà soát riêng phần vừa triển khai (lần 4 + 5 đề xuất) + kiểm tra bảo mật

Theo yêu cầu chủ động: rà soát lại CHỈ những phần vừa thay đổi ở 2 mục trên (không lặp lại toàn bộ
dự án — đã qua 4 lần rà soát tổng thể, không còn nhiều giá trị lặp lại lần 5), tách riêng 1 hướng
tập trung vào bảo mật cho khu vực rủi ro cao nhất (Gateway rate-limit vừa tái cấu trúc, script Lua
nguyên tử, xử lý mật khẩu Mongo).

**Tự kiểm tra trước (không qua agent):** viết 1 script Node đối chiếu key + placeholder giữa
vi/en/ja cho toàn bộ 12 namespace i18n (loại `errors.json` khỏi so sánh — file này CỐ TÌNH lệch
theo thiết kế đã ghi nhận từ trước). Phát hiện **25 key sót từ trước** (không phải do đợt sửa hôm
qua) chỉ có ở `vi` mà thiếu ở cả `en` lẫn `ja`: 5 key trong `dashboard:recentActivityFeed`
(`viewAll`, `collapse`, `groups.today/yesterday/earlier`) và 20 key trong `projects.json`
(`list.viewAll`, `list.priorityFilter.*`, `detail.reopenProject`, `newProjectModal.priorityLabel/
leadLabel/searchMemberPlaceholder/priorities.*`, `editProjectModal` cả khối, `projectCard.edit/
reopen`, `toast.project.reopened/reopenError`) — đã được 1 agent hôm qua tự phát hiện và chủ động
ghi chú "out of scope, để đó" trong báo cáo, nhưng tôi đọc lướt báo cáo tổng hợp và bỏ sót không
theo dõi tiếp. Đã dịch bổ sung toàn bộ 25 key vào en/ja (giữ đúng nghĩa/văn phong đã dùng cho các
key lân cận). Bài học: từ nay đối chiếu key bằng script thay vì chỉ tin báo cáo tóm tắt của agent.

**5 hướng rà soát song song, chỉ nhắm đúng các file vừa đổi:**

1. **Bảo mật** (Gateway `jwt-auth.middleware.ts`/`redis.service.ts`, IAM `redis.service.ts`/
   `users.service.ts`, `infra/docker-compose.yml`, Mongo URI, field `leadUserId` mới) — sạch, chỉ 1
   ghi nhận Nhẹ: `leadUserId` không xác minh thuộc đúng tổ chức trước khi lưu — cùng hạn chế (cùng
   lý do: chưa có HTTP client nội bộ giữa các service) đã ghi nhận từ 25/07/2026 tại
   `TasksService.assign()`. Bổ sung chú thích tương tự tại `ProjectsService.create()`/`update()`
   để nhất quán, không sửa hành vi (mức độ nghiêm trọng thấp, đã có lý do kỹ thuật rõ ràng).
2. **Backend logic** (`ProjectsService.complete()`/`update()`, `FoldersService.remove()`,
   `AttendanceService.checkOut()`, `failed-events-consumer.service.ts`, `fact-writer.service.ts`)
   — sạch, 1 lỗi Nhẹ còn sót: `checkOut()` (sửa 26/08 để tìm đúng bản ghi check-in đang mở) vẫn giữ
   riêng 1 biến `workDate` tính lại tại thời điểm checkout (thay vì lấy từ bản ghi thật) để đặt tên
   object key ảnh + outbox payload — cùng lỗi "sai ngày qua nửa đêm" như bản gốc, chỉ là không còn
   ảnh hưởng tới việc TÌM bản ghi nữa nên không lộ ra khi test. Sửa: dùng thẳng `workDate` của bản
   ghi Attendance đã tìm/khoá được (`preCheck.workDate` cho object key, `attendance.workDate` cho
   outbox payload), bỏ hẳn biến tính riêng.
3. **Frontend Projects** (`api.ts`, `utils.ts`, `ProjectCard`/`EditProjectModal`/`NewProjectModal`/
   `ProjectDetailPage`, `Sidebar.tsx`) — sạch, không phát hiện gì mới.
4. **`Modal.tsx` + 12 modal dùng `preventCloseWhilePending`** — triển khai đúng và đầy đủ theo
   phạm vi đã định. 2 ghi nhận Nhẹ không sửa: `ConfirmDialog` (cùng file) chưa có prop này nhưng
   hiện vô hại (mọi nơi gọi đều đóng đồng bộ trong `onConfirm`, không qua `onSuccess` trễ); và một
   đánh đổi có chủ đích chưa từng được ghi chú — nếu request treo vô thời hạn (`apiClient` không
   đặt `timeout`, mutation cấu hình `retry: 0`), người dùng không có cách nào đóng modal từ trong
   app cho tới khi request thật sự trả về. Bổ sung chú thích ghi nhận đánh đổi này ngay tại khai báo
   prop trong `Modal.tsx`, không sửa hành vi (lợi ích tránh mất dữ liệu/đóng nhầm modal lớn hơn rủi
   ro request treo thật sự hiếm gặp).
5. **`scripts/check-hardcoded-vietnamese.js` (công cụ mới hôm qua) + các sửa đổi liên quan** — phát
   hiện 1 lỗi Nghiêm trọng vừa trong chính công cụ: bộ xoá comment không nhận biết regex literal, 1
   pattern như `/^https?:\/\//` (dấu `/` thoát trong regex) bị hiểu nhầm là bắt đầu comment `//`
   ngay giữa chừng, làm MẤT toàn bộ phần còn lại của dòng đó — kể cả chuỗi tiếng Việt thật sự nằm
   sau nó — mà không báo lỗi gì (sai lệch theo hướng "bỏ sót", nguy hiểm hơn báo động giả). Chưa
   từng bị kích hoạt (chưa có regex nào dạng này trong `apps/web/src` tại thời điểm viết), nhưng sẽ
   âm thầm vô hiệu hoá công cụ ngay khi ai đó thêm 1 pattern kiểm tra URL kiểu này. Sửa: thêm nhận
   diện regex literal dựa theo ký tự/từ khoá ngay trước dấu `/` (heuristic phổ biến của tokenizer
   JS đơn giản — sau `)]}`/identifier/số là phép chia, sau toán tử/dấu câu/từ khoá như `return` là
   regex), "ẩn" nguyên nội dung regex y hệt cách đã làm với string/template literal. Đã viết test
   riêng xác nhận đúng ca lỗi gốc (`urlRe = /^https?:\/\//` không còn nuốt chuỗi tiếng Việt phía
   sau) mà không phá vỡ hành vi cũ (comment `//`/`/* */` vẫn bị xoá đúng, 2 dòng regex đã đánh dấu
   `i18n-lint-ignore` trong `lib/utils.ts` vẫn được bỏ qua đúng). Các mục còn lại (CI YAML,
   `extractErrorMessage()` fallback, 2 marker `i18n-lint-ignore`, JSON locale mới) đều sạch.

**Xác minh cuối cùng:** `npm run typecheck` (root) sạch; `npm run test --workspaces` vẫn 573/573
(không hồi quy từ các sửa đổi trên); `node scripts/check-hardcoded-vietnamese.js` thoát mã 0; script
đối chiếu key/placeholder i18n riêng (viết hôm nay) xác nhận sạch tuyệt đối trên cả 11 namespace
UI (loại `errors.json` theo thiết kế).

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 27/08/2026.*

## 2026-08-27 (bổ sung) — Push GitHub thất bại: `npm run lint` có lỗi thật, không chỉ warning

Push lên GitHub thất bại — nguyên nhân là `npm run lint` (bước bắt buộc trong CI, `.github/
workflows/ci.yml`) thực sự có **5 lỗi (error)**, không phải chỉ warning. Bài học quan trọng: suốt
2 đợt sửa lỗi gần đây (26-27/08), gate xác minh chỉ chạy `typecheck` + `test --workspaces`, CHƯA
BAO GIỜ chạy `npm run lint` — TypeScript type-check và ESLint là 2 công cụ khác nhau, qua cái này
không đảm bảo qua cái kia. Từ nay gate cuối phải luôn gồm cả 3: `typecheck` + `test` + `lint`.

**3 lỗi thật, cả 3 đều do chính các đợt sửa gần đây gây ra:**
- `apps/web/src/features/projects/api.ts` (`no-useless-catch`) — `completeProject()`/
  `reopenProject()` (sửa 26/08, Fix CRITICAL 1) còn giữ khối `try { ... } catch (err) { throw err;
  }` chỉ để đính kèm bình luận giải thích — ESLint đúng khi coi đây là catch vô nghĩa (async
  function tự động ném lại lỗi qua Promise rejection, không cần bắt rồi ném lại). Sửa: bỏ hẳn
  try/catch, chuyển toàn bộ bình luận lên trước hàm.
- `apps/web/src/features/projects/ProjectsListPage.tsx` (`prefer-const`) — `let finalSorted = ...`
  (code gốc từ nhánh merge của Tiến, 25/08) không bao giờ được gán lại (chỉ `.sort()` tại chỗ) —
  đổi sang `const`.
- `apps/web/src/features/dashboard/components/RecentActivityFeed.tsx`
  (`react/no-unescaped-entities`) — dấu `"` thẳng đặt trực tiếp trong JSX text (bọc quanh
  `{target}`) phải escape thành `&quot;`.

**Xác minh:** `npm run lint` (root) từ 5 lỗi + nhiều warning → 0 lỗi (chỉ còn warning, không chặn
build — xác nhận qua exit code 0 dù ESLint vẫn in ra danh sách warning). `npm run typecheck -w
apps/web` và `npm run test -w apps/web` (18/18) vẫn sạch sau khi sửa.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 27/08/2026 (phần kiểm tra lint sau
khi push GitHub thất bại).*

---

## 2026-08-29 — Unit test thất bại sau khi lint đã sạch: `coverageThreshold` "branches" của
`notification-service` không đạt (không phải lỗi assertion)

Sau khi lỗi lint ngày 27/08 đã sửa xong, lượt push tiếp theo báo "unit test thất bại" dù `npm run
lint` đã sạch. Chạy trực tiếp đúng lệnh CI dùng (`npm run test:coverage` = `jest --coverage` từng
workspace) cho kết quả: **toàn bộ 573 assertion cũ vẫn pass 100%** — lỗi thật là Jest tự thoát mã 1
vì ngưỡng `coverageThreshold.global.branches` (55%, khai ở `apps/notification-service/
package.json`) không đạt, thực đo chỉ 49.57%. Đây là kiểu lỗi dễ gây hiểu lầm "test bị hỏng" trong
khi đúng ra là "test pass nhưng coverage tụt dưới sàn đã đặt" — 2 khái niệm khác nhau nhưng cùng
làm `jest` thoát mã khác 0.

**Nguyên nhân gốc:** đợt bổ sung cơ chế tự khởi động lại Kafka consumer sau CRASH (26/08/2026, mục
"5 đề xuất cải thiện") thêm code mới vào `failed-events-consumer.service.ts` — file này vốn nhỏ
(ít nhánh rẽ sẵn có) nên phần logic mới (dù đã có test khá đầy đủ cho `registerCrashHandler`/
`restartWithBackoff`) vẫn kéo tỷ lệ nhánh của riêng file xuống 57%, cộng dồn với 2 khoảng trống
nhánh rẽ **có từ trước, không liên quan đợt sửa gần đây**, kéo tổng thể toàn service xuống dưới
ngưỡng:
- `event-notification-builder.ts` (30.76% nhánh) — 3 case switch thêm từ CRM-lite/HRM-lite
  (04-05/08/2026: `deal.stage_changed`, `leave_request.approved`, `leave_request.rejected`) **chưa
  từng có bất kỳ test nào** kể từ khi thêm.
- `notifications.service.ts` (73.33% nhánh) — `markAsRead()`/`markAllAsRead()` (endpoint đánh dấu
  đã đọc) **chưa từng có test nào** dù đã tồn tại từ lâu.
- `redis.service.ts` (0% nhánh) — nhánh reject thật của `withTimeout()` (khi Redis tự trả lỗi
  trước khi kịp hết hạn timeout) chưa được test, chỉ mới test nhánh "treo" (timeout) và nhánh
  thành công.

**Đã sửa bằng cách bổ sung 14 test mới** (không đổi bất kỳ dòng code sản phẩm nào — đây thuần tuý
là lấp khoảng trống test có sẵn, không phải vá lỗi hành vi):
- `event-notification-builder.spec.ts`: +7 test (3 case CRM/HRM còn thiếu × nhánh sinh thông báo
  thành công + nhánh trả `null` khi thiếu field bắt buộc/không đúng điều kiện).
- `notifications.service.spec.ts`: +5 test cho `markAsRead` (id không hợp lệ, không tìm thấy, đã
  đọc sẵn thì no-op, chưa đọc thì đánh dấu+lưu+phát WebSocket) và `markAllAsRead`.
- `redis.service.spec.ts` (notification-service): +2 test cho nhánh reject thật của `withTimeout`
  (Error thật được ném nguyên vẹn; giá trị reject không phải Error được bọc thành 1 Error mới).

**Xác minh:** `jest --coverage` riêng `notification-service` — nhánh từ 49.57% → 60.68% (qua
ngưỡng 55%), 69/69 test pass (55 cũ + 14 mới). `npm run test:coverage` (root, đúng lệnh CI dùng) —
cả 12 workspace pass, không còn lỗi ngưỡng coverage nào. `npm run lint` và `npm run typecheck`
(root) chạy lại sau khi thêm test — sạch, không phát sinh lỗi/warning mới.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 29/08/2026 (phần "recheck sau khi
unit test thất bại dù lint đã sạch").*

---

## 2026-08-29 (bổ sung) — Merge nhánh `frontend` của Nguyễn Lê Tiến (lần 2) — 7 file conflict +
4 hồi quy ngữ nghĩa "im lặng" (không có dấu conflict nhưng vẫn sai)

Người dùng merge lại nhánh `frontend` của Tiến vào nhánh chính, phát sinh conflict Git thật (đánh
dấu `<<<<<<< HEAD` / `=======` / `>>>>>>> origin/frontend`) ở **7 file**: `components/ui/Modal.tsx`,
`features/projects/ProjectsListPage.tsx`, `features/dashboard/components/RecentActivityFeed.tsx`,
và 4 file JSON i18n (`en/dashboard.json`, `ja/dashboard.json`, `en/projects.json`, `ja/projects.json`).
Git không có sẵn trong môi trường CLI này nên xử lý trực tiếp trên nội dung file (grep dấu
conflict, đọc/so sánh 2 phía, không dùng `git merge`/`git status`).

**Quyết định thiết kế đáng chú ý nhất**: `RecentActivityFeed.tsx` — 2 bên có 2 cách hiện thực
KHÁC NHAU cho cùng 1 tính năng (dịch dòng hoạt động gần đây), độc lập nhau, cùng lúc: bản của tôi
(`parseActionDetails` + key `verbs.*`/`targets.*`, tách riêng động từ/đối tượng) và bản của Tiến
(`getActionDisplay` + key `actions.*`/`performedAction`, gộp thành 1 câu + hiển thị dạng "badge"
màu theo loại hành động - tạo/sửa/xoá). Chọn giữ bản của Tiến (UI trực quan hơn, đã dịch đầy đủ cả
3 ngôn ngữ), xoá hẳn `verbs`/`targets`/`activityCount` (key chết, không còn nơi nào dùng) khỏi cả
3 file `dashboard.json`. Nhân tiện dọn 1 lỗi trùng key JSON có từ trước (`projectCard.noDescription`
khai báo 2 lần trong `projects.json` cả 3 ngôn ngữ - JSON không báo lỗi nhưng giá trị đầu bị đè âm
thầm) và 4 cặp chuỗi lệch nhau giữa 2 bên (`priorityFilter`/`editProjectModal.title`/`leadLabel`/
`reopenProject`...) — đối chiếu với bản `vi/*.json` (đã tự merge sạch, dùng làm "trọng tài") để
chọn cách diễn đạt nhất quán, bỏ hẳn `priorityRequired` (key Tiến thêm nhưng không nơi nào gọi tới,
`vi` cũng không có).

**4 hồi quy ngữ nghĩa nghiêm trọng hơn — KHÔNG có dấu conflict nào** (Git 3-way merge không phát
hiện vì 2 bên sửa dòng khác nhau, không chồng lấn dòng-với-dòng, nhưng SAI về mặt logic khi đứng
cạnh nhau) — phát hiện qua `npm run lint`/`npm run typecheck`/`npm run lint:i18n-strings` báo lỗi
thật, không phải tự rà thủ công hết 101 file:
1. **`EditProjectModal.tsx`** — merge tự động (không đánh dấu) đã LẶP ĐÔI y hệt 2 đoạn JSX (nút
   "Đổi" hiển thị 2 lần; đoạn "Không tìm thấy thành viên" lặp 2 lần trong cùng 1 nhánh ternary) —
   lỗi thứ 2 phá cú pháp JSX thật sự (`error TS2657: JSX expressions must have one parent element`),
   chặn cả `lint` lẫn `typecheck`. Xoá bản lặp.
2. **`ProjectCard.tsx`/`ProjectDetailPage.tsx`** — bị merge "lùi" về đúng logic ĐÃ TỪNG SỬA ở lỗi
   MAJOR Fix 3 (26/08/2026): đọc `priority`/`leadUserId` từ `localStorage['ec_projects_metadata']`
   (hệ thống CŨ) thay vì trực tiếp từ `project.priority`/`project.leadUserId` (trường thật từ
   server) — chú thích 26/08 vẫn còn nguyên trong code (nói đúng là "giờ đọc thẳng từ server") NHƯNG
   đoạn code bên dưới lại làm ngược lại chú thích đó. Đồng thời cả 2 file tự khai báo lại 1 object
   `priorityMeta` y hệt nhau thay vì gọi `projectPriorityMeta()` dùng chung (`utils.ts`) — về đúng
   lỗi trùng lặp mà hàm này được tạo ra để xoá bỏ. Phát hiện qua ESLint cảnh báo
   `'projectPriorityMeta' is defined but never used` (dấu hiệu hàm dùng chung bị bỏ rơi).
3. **`EditProjectModal.tsx` `handleSubmit()`** — hồi quy CÙNG LỚP LỖI nghiêm trọng hơn: `mutate()`
   chỉ gửi `name`/`description`/`dueDate` lên server, còn `priority`/`leadUserId` NGƯỜI DÙNG VỪA
   CHỌN chỉ được ghi vào `localStorage` (hệ thống CŨ, đã bỏ) — sửa dự án qua modal này trước khi vá
   sẽ báo "Lưu thay đổi" thành công nhưng KHÔNG BAO GIỜ thực sự đổi độ ưu tiên/người phụ trách trên
   server. Sửa bằng cách gửi thẳng `priority`/`leadUserId: leadId || undefined` trong payload
   `mutate()` (đúng mẫu đã dùng ở `NewProjectModal.tsx`), bỏ hẳn nhánh ghi localStorage/tự phát sự
   kiện (`useUpdateProject()` đã tự `invalidateQueries(['projects'])`/`['project', id]` khi thành
   công, không cần cơ chế đồng bộ thủ công riêng nữa).
4. **4 chuỗi tiếng Việt có dấu hardcode sót lại** (`lint:i18n-strings` bắt được): `Sidebar.tsx`
   ("Doanh nghiệp / Tổ chức" — key `common:sidebar.subtitle` đã có sẵn, chỉ chưa gọi `t()`),
   `TaskCard.tsx` ("Quá hạn" trong tooltip chấm ưu tiên — tính năng mới của Tiến, thêm key
   `projects:taskCard.overdue`), `TaskDetailModal.tsx` ("Nhấp để đổi tên công việc" — tính năng đổi
   tên tại chỗ mới của Tiến, thêm key `projects:taskDetail.renameHint`), `TaskStatusDonut.tsx`
   (`defaultValue` hardcode tiếng Việt cho nhánh DOING dù key thật `projects:enums.taskStatus.DOING`
   luôn tồn tại nên nhánh đó không bao giờ chạy tới — đơn giản hoá về `defaultValue: status`).
5. **`DashboardPage.tsx`** (phát hiện qua `typecheck`, không phải `lint:i18n-strings`) — `daysMap`
   dùng khoá `'90d'`/`'1y'` trong khi `DateRangeOption` (type dùng chung, `types/index.ts`) đã đổi
   thành `'7d' | '30d' | 'quarter'` từ trước (khớp đúng bộ giá trị backend chấp nhận —
   `analytics-service` từ chối `'1y'` bằng `BadRequestException`, xác nhận qua
   `range.util.spec.ts`) — 2 bên sửa 2 nơi khác nhau (type ở 1 file, object dùng type ở file khác)
   nên Git không phát hiện được. Sửa `daysMap` về đúng `{'7d': 7, '30d': 30, quarter: 90}`.

**Xác minh:** `npm run lint` (root) sạch (0 lỗi, chỉ còn warning nền cũ không đổi). `npm run
lint:i18n-strings` sạch (0 vi phạm, từ 4 xuống 0). `npm run typecheck` (root) sạch (từ 2 lỗi biên
dịch xuống 0). `npm run test --workspace=apps/web` 18/18 pass. `npm run test:coverage` (root, đúng
lệnh CI) — cả 12 workspace pass, không lỗi ngưỡng coverage. Toàn bộ 4 file JSON hợp lệ cú pháp
(`ConvertFrom-Json` xác nhận).

**Bài học quy trình**: chỉ tìm dấu `<<<<<<<`/`=======`/`>>>>>>>` là KHÔNG ĐỦ để merge an toàn — Git
tự động gộp (không báo conflict) những vùng 2 bên sửa mà không chồng dòng, kể cả khi kết quả sai về
logic (đọc sai nguồn dữ liệu, gọi nhầm namespace i18n, dùng type/enum đã đổi ở nơi khác). Bắt buộc
chạy đủ `lint` + `lint:i18n-strings` + `typecheck` + `test` NGAY sau khi resolve conflict, không chỉ
xoá dấu conflict rồi coi là xong — 3/4 lỗi ở trên (Fix 2, 3, 5) không hề có dấu conflict nào.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 29/08/2026 (phần "merge nhánh
frontend của Tiến lần 2").*

---

## 2026-09-15 — Rà soát lại sau khoảng nghỉ 2 tuần: 102 chuỗi tiếng Việt hardcode + 5 lỗi thật từ
một đợt code mới của Tiến chưa từng qua kiểm tra

Quay lại dự án sau ~2 tuần không có phiên làm việc nào (tài liệu dừng đúng ở mục 29/08 phía trên).
Đọc lại toàn bộ `Doc/*.md` (trừ `GraduationReport.tex`) để nắm lại bối cảnh, sau đó chạy đủ gate
`lint` + `lint:i18n-strings` + `typecheck` + `test:coverage` để xác nhận "mọi thứ vẫn ổn" theo yêu
cầu của người dùng. `lint:i18n-strings` thất bại: **102 chuỗi tiếng Việt có dấu hardcode ngoài
i18n, trải trên 16 file** (Documents: `FileTable.tsx`/`FolderGrid.tsx`/`FolderShareModal.tsx`/
`ShareModal.tsx`/`DocumentsPage.tsx`; HRM: `AttendancePage.tsx`/`NewLeaveRequestModal.tsx`/
`LeaveRequestsPage.tsx`; CRM: `CustomerCard.tsx`/`DealKanbanBoard.tsx`/`EditCustomerModal.tsx`;
Notifications: `NotificationBell.tsx`/`NotificationsPage.tsx`/`utils.tsx`; Projects:
`KanbanBoard.tsx`). Đối chiếu timestamp file (toàn bộ ~35 file `apps/web` đổi cùng 1 giây, kể cả
nhiều file bản thân tôi đã tự sửa xong ở đợt 29/08 và nội dung không hề đổi) xác nhận đây là dấu
hiệu checkout lại repo, KHÔNG phải chỉnh sửa thật mới toàn bộ — nội dung thật sự mới chỉ nằm ở 16
file bị gắn cờ (một đợt code mới của Tiến, thuần frontend, không đụng backend, merge sạch không có
dấu conflict Git nào — khác hẳn 2 lần merge có conflict trước đó 25/08 và 29/08).

**Dịch toàn bộ 102 chuỗi** bằng 3 agent chạy song song theo khu vực tính năng (Documents; HRM;
CRM+Notifications+Projects gộp chung 1 agent vì mỗi khu vực nhỏ) — mỗi agent tự đọc quy ước namespace
`i18n` hiện có, thêm khoá mới vào cả `vi`/`en`/`ja`, tái sử dụng khoá khi 2 nơi dùng chung UI (vd
`documents:shareTargetPicker.*` dùng chung giữa `FolderShareModal.tsx`/`ShareModal.tsx` — 2 modal
này cố ý thiết kế song song từ 28/07/2026, không phải trùng lặp do merge lỗi). `lib/utils.ts` có 2
dòng báo động giả (`removeVietnameseTones()`, hàm chuẩn hoá tìm kiếm mới — pattern regex `/đ/g`/`/Đ/g`
chứa ký tự có dấu làm PATTERN, không phải chuỗi hiển thị) — gắn `i18n-lint-ignore`, cùng quy ước 2
điểm đã có sẵn trong file này từ trước.

**5 lỗi thật phát hiện qua chính quá trình dịch (đọc kỹ từng file để thêm `t()`), đã sửa:**
1. **`DealCard.tsx`** (CRM) — tính năng mới "cảnh báo deal sắp/đã quá hạn chốt" (tô đỏ ngày dự kiến
   chốt nếu ≤ 3 ngày hoặc đã qua) không loại trừ deal đã ở trạng thái cuối (`WON`/`LOST`) — 1 deal
   đã chốt xong từ lâu, có `expectedCloseDate` trong quá khứ, vẫn hiện màu đỏ cảnh báo dù không còn
   gì "sắp quá hạn" nữa. Sửa: bỏ qua nhánh tô màu khi `deal.stage` là `WON`/`LOST`.
2. **`DashboardPage.tsx`** — phát hiện 1 khối tính toán KPI/2 biểu đồ lại HOÀN TOÀN phía client (từ
   `allTasksQuery`/`allProjectsQuery`/`allUsersQuery`) đè lên kết quả từ Analytics Service, không có
   bất kỳ chú thích ngày tháng nào giải thích lý do (vi phạm ClaudeRule.md mục 7) — đã bổ sung chú
   thích ghi lại lý do khả dĩ nhất (số liệu "đúng tuyệt đối ngay lúc xem" đổi lấy chi phí tải toàn bộ
   task/project/user mỗi lần vào trang, thay vì 1 lệnh gọi tổng hợp sẵn) để lần sau không phải đoán
   lại. Trong lúc đọc kỹ khối này phát hiện thêm 2 vấn đề nhỏ: `allProjectsQuery` cứng `limit: 100`
   (đúng lớp lỗi "trần 100 làm mất dữ liệu" đã sửa ở Tier 1 22/08/2026 cho trang danh sách Dự án —
   tái diễn ở đây cho tổ chức có > 100 dự án) — nâng lên `limit: 500` khớp trần `PaginationQueryDto`;
   và 1 dòng chú thích cũ (28/07/2026) khẳng định bộ lọc phòng ban "KHÔNG ảnh hưởng biểu đồ Xu hướng"
   nay đã SAI (khối tính lại phía client khiến biểu đồ Xu hướng thực sự có lọc theo phòng ban) — sửa
   lại nội dung chú thích cho đúng thực tế hiện tại.
3. **`FileTable.tsx`** (Documents, tính năng chọn nhiều tệp/thao tác hàng loạt mới) — `selectedFileIds`
   không được xoá khi đổi thư mục (component không unmount lại khi đổi `folderId`) — chọn tệp ở thư
   mục A rồi chuyển sang thư mục B vẫn giữ "đã chọn" các id không còn thuộc `files` hiện tại, khiến
   thanh hành động hàng loạt (tải về/xoá) có thể âm thầm thao tác trên tệp không còn hiển thị trên
   màn hình. Sửa: `useEffect` xoá `selectedFileIds` mỗi khi `folderId` đổi.
4. **`DocumentsPage.tsx`** (tính năng kéo-thả tải lên toàn màn hình mới) — kéo nhiều tệp cùng lúc
   vào vùng thả chỉ âm thầm lấy `droppedFiles[0]`, các tệp còn lại mất không dấu vết, không thông
   báo gì (đúng thiết kế `UploadModal` chỉ nhận 1 tệp/lần, nhưng người dùng không biết vì sao các
   tệp kia "biến mất"). Sửa: thêm toast thông báo khi thả > 1 tệp cùng lúc.
5. **`AttendancePage.tsx`** (HRM, badge "Đi muộn"/"Đúng giờ" mới) — tính giờ check-in bằng
   `Date.getHours()/getMinutes()` (đọc theo timezone TRÌNH DUYỆT người xem), dù dòng chú thích ngay
   cạnh khẳng định "tính theo GMT+7" — đúng lớp lỗi đã được rà soát và sửa TOÀN DỰ ÁN ngày 22/07/2026
   (xem `formatDate`/`formatTime`, `lib/utils.ts`) nhưng tái diễn ở component mới này: người xem đặt
   múi giờ máy khác GMT+7 sẽ bị tính sai "đi muộn"/"đúng giờ" dù dữ liệu server đúng. Sửa bằng
   `Intl.DateTimeFormat` với `timeZone: 'Asia/Ho_Chi_Minh'`, cùng cách `formatDate` đã làm.

**Vài phát hiện khác, cố ý ghi nhận KHÔNG sửa** (mức Nhẹ, rủi ro thấp hoặc không phải lỗi thật):
- `FileTable.tsx` xoá hàng loạt gọi `deleteFile.mutate(id)` cho từng id mà không đợi/gộp kết quả rồi
  đóng hộp thoại xác nhận ngay — nhưng `useDeleteFile()` đã có sẵn `onError` báo toast riêng cho MỖI
  lần gọi thất bại (không phải thất bại hoàn toàn im lặng như báo cáo ban đầu), chỉ là hộp thoại xác
  nhận đóng lạc quan trước khi biết kết quả thật — đánh đổi UX chấp nhận được, không sửa.
- `notifications/utils.tsx` (`getNotificationVisualConfig`) so khớp chuỗi con tiếng Việt
  ("từ chối"/"duyệt"/"nghỉ phép"...) trực tiếp trên `title`/`message` do BACKEND sinh sẵn (không phải
  chuỗi UI tĩnh) để suy ra icon/màu hiển thị — đúng hành vi hiện tại (backend luôn sinh tiếng Việt,
  xem giới hạn đã ghi nhận ở `Technical_Spec.md` §18.2), nhưng sẽ âm thầm sai nếu sau này backend
  dịch nội dung thông báo sang Anh/Nhật — ghi nhận, không thuộc phạm vi sửa lỗi hiện tại.
- `AttendancePage.tsx`: giờ tổng công (`formatTotalHours`) không giới hạn/cảnh báo khi quên
  check-out qua đêm (khoảng cách giờ lớn bất thường); bộ lọc tháng chỉ liệt kê 6 tháng gần nhất
  (không có cách chọn tháng cũ hơn ngoài "Tất cả thời gian") — cả 2 là hạn chế nhỏ, không phải lỗi
  đúng-sai, để dành cho đợt sau nếu cần.
- `FolderShareModal.tsx` thiếu prop `preventCloseWhilePending` mà `ShareModal.tsx` (thiết kế song
  song, cùng khối UI) đã có — nhưng khác `ShareModal.tsx`, mutation của `FolderShareModal.tsx` KHÔNG
  tự gọi `onClose` khi thành công (chỉ `setTargetId('')`), nên đúng lớp lỗi "đóng nhầm modal vừa mở
  lại cho đối tượng khác" mà prop này chặn KHÔNG áp dụng được ở đây — chỉ là 1 điểm thiếu nhất quán
  vô hại, không sửa.

**Xác minh cuối:** `npm run lint:i18n-strings` từ 102 vi phạm → 0 (sạch trên cả 121 file quét, xác
nhận bởi cả 3 agent lẫn lượt chạy lại cuối cùng của tôi sau khi tự sửa `lib/utils.ts` và 5 lỗi thật
ở trên). `npm run lint` (root) sạch. `npm run typecheck` (root) sạch. `npm run test:coverage` (root,
đúng lệnh CI dùng) — cả 12 workspace pass, không lỗi ngưỡng coverage nào, không hồi quy số lượng test
so với lần chạy cuối 29/08/2026.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 15/09/2026.*

---

## 2026-09-15 (phản hồi GVHD) — 4 góp ý của giảng viên hướng dẫn sau khi xem báo cáo/demo

Người dùng chuyển tiếp 4 góp ý từ GVHD kèm phê duyệt triển khai cả 4 trong cùng 1 lượt làm việc,
độc lập hoàn toàn với đợt "rà soát lại sau khoảng nghỉ 2 tuần" ngay phía trên (đợt đó là tự rà soát
chủ động, đợt này là phản hồi bên ngoài từ giảng viên).

### 1. Lỗi logic "Nghỉ phép" — vẫn tạo được yêu cầu cho ngày đã qua

**Nguyên nhân gốc:** `apps/web/src/components/ui/DatePicker.tsx` đã khai báo prop `minDate` trong
kiểu (interface) từ trước, và `NewLeaveRequestModal.tsx` đã TRUYỀN prop này vào — nhưng thân
component `DatePicker` chưa từng đọc/dùng tới `minDate` ở bất kỳ đâu (dead prop, "trông như đã cài
đặt" nhưng thực chất không làm gì). Không ô ngày nào bị khoá trên lưới chọn ngày; gõ tay ngày quá
khứ vào ô input cũng không bị chặn. Backend (`LeaveRequestsService.create()`, hrm-service) trước đó
chỉ kiểm tra `startDate <= endDate`, không kiểm tra so với ngày hiện tại — nên kể cả khi vá riêng
frontend, gọi thẳng API (Postman, hoặc `ecap-mobile`) vẫn tạo được yêu cầu nghỉ phép cho ngày quá
khứ.

**Sửa ở cả 2 tầng** (đúng nguyên tắc đã áp dụng xuyên suốt dự án — validate ở UI chỉ là tiện ích,
backend luôn là "chốt" quyết định cuối cùng vì không thể tin dữ liệu từ client):
- `DatePicker.tsx`: nối `minDate` vào 3 nơi — (a) vòng lặp render lưới ngày, tính `isDisabled =
  Boolean(minDate) && dayStr < minDate!` rồi áp `disabled`+CSS làm mờ; (b) `handleSelectDay()` —
  thêm `if (minDate && dateStr < minDate) return;` chặn click trực tiếp (phòng trường hợp lưới chưa
  kịp re-render disable); (c) `handleManualInput()` — thêm điều kiện `(!minDate || formatted >=
  minDate)` vào nhánh chấp nhận giá trị gõ tay, để gõ thẳng 1 ngày quá khứ vào ô input cũng bị từ
  chối giống hệt click chuột.
- `apps/web/src/lib/utils.ts`: thêm hàm mới `getTodayGmt7DateString()` — dùng
  `new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh'}).format(new Date())` để lấy ngày
  hôm nay THEO ĐÚNG múi giờ GMT+7 của hệ thống (định dạng `en-CA` cho ra thẳng chuỗi `YYYY-MM-DD`),
  mirror đúng hàm `toGmt7DateString()` đã có sẵn ở backend (`attendance-date.util.ts`, dùng từ đợt
  sửa lỗi múi giờ toàn dự án 22/07/2026) — **cố ý không dùng `new Date().getFullYear()`/`.getMonth()`
  /`.getDate()` của trình duyệt**, vì các hàm đó trả về theo múi giờ CỤC BỘ của máy người dùng, có
  thể lệch hẳn với GMT+7 (ví dụ máy đặt UTC hoặc múi giờ khác) — đúng lớp lỗi đã bị cấm dùng từ đợt
  rà soát 22/07/2026.
- `NewLeaveRequestModal.tsx`: tính `todayGmt7 = getTodayGmt7DateString()` 1 lần khi mount, truyền
  `minDate={todayGmt7}` cho `DatePicker` ngày bắt đầu và `minDate={startDate || todayGmt7}` cho
  ngày kết thúc (không cho chọn ngày kết thúc trước ngày bắt đầu VỪA chọn, không chỉ trước hôm nay);
  thêm 2 kiểm tra đầu `handleSubmit()`: `startDate < todayGmt7` và `endDate < startDate`, có thông
  báo lỗi riêng (`hrm:newLeaveRequestModal.errors.startDateInPast`/`.endDateBeforeStart`, đã dịch cả
  3 ngôn ngữ).
- `LeaveRequestsService.create()` (hrm-service): thêm sau kiểm tra khoảng ngày hiện có —
  `const todayGmt7 = toGmt7DateString(new Date()); if (dto.startDate.slice(0,10) < todayGmt7) throw
  new BadRequestException({..., errorCode: ERROR_CODES.LEAVE_START_DATE_IN_PAST})` — so sánh CHUỖI
  ISO trực tiếp (`'YYYY-MM-DD' < 'YYYY-MM-DD'`), không parse sang `Date` object, đúng quy ước so
  sánh ngày-tháng đã dùng nhất quán trong toàn dự án (thứ tự lexicographic của chuỗi zero-pad trùng
  khớp thứ tự thời gian thật, tránh mọi rắc rối múi giờ khi parse). Mã lỗi mới
  `LEAVE_START_DATE_IN_PAST` thêm vào `packages/common-dto/src/constants/error-codes.constant.ts`
  (đã dịch `en`/`ja` trong `errors.json`, `vi` để trống theo đúng quy ước hiện có — xem đợt i18n
  20-21/08/2026).

**Phát hiện phụ khi viết test:** test thành công có sẵn của `leave-requests.service.spec.ts` hardcode
`startDate: '2026-09-01'` — do đồng hồ hệ thống thật của môi trường làm việc đã tiến tới khoảng
09/2026 (xác nhận qua `LastWriteTime` của file), giá trị này đã ÂM THẦM trở thành 1 ngày QUÁ KHỨ
thật tính đến lúc viết bản vá này, và sẽ bị chính kiểm tra mới thêm vào chặn nhầm ngay khi merge —
không phải lỗi của bản vá, mà là 1 test vốn đã "mục ruỗng" theo thời gian chờ sẵn để lộ ra. Sửa bằng
helper `futureDateStr(daysFromNow: number)` tính ngày tương lai tương đối lúc TEST CHẠY (không phải
lúc code được viết), áp dụng cho mọi test cần 1 ngày "chắc chắn còn ở tương lai"; giữ nguyên
`'2020-01-01'` (hardcode, nhưng là ngày quá khứ VĨNH VIỄN an toàn) cho test mới kiểm tra đúng nhánh
từ chối.

**Xác minh:** `npx jest leave-requests.service.spec.ts` (hrm-service) — 10/10 pass (8 test cũ + 2
test mới: tạo thành công khi `startDate` là HÔM NAY, từ chối khi `startDate` ở quá khứ với đúng
`errorCode`).

### 2. Nhầm lẫn RBAC — "Admin" so với "Org Admin"

GVHD hiểu rằng có "admin" và "employee", nhưng báo cáo lại nhắc tới 1 vai trò khác tên "org-admin"
mà GVHD đoán là lớn hơn "admin" — dấu hiệu cho thấy tài liệu (không phải code) đang mô tả không rõ
ràng. Rà soát trực tiếp mã nguồn (không suy đoán từ tài liệu cũ) để xác nhận sự thật:
- `packages/common-dto/src/enums/permission.enum.ts` (`DefaultRoleName`) — chỉ khai báo 3 giá trị:
  `ORG_ADMIN`, `MANAGER`, `EMPLOYEE`. Không có `ADMIN` độc lập.
- `apps/iam-service/src/roles/roles.service.ts` (`seedDefaultRoles()`) — hàm được gọi tự động cho
  MỌI tổ chức mới đăng ký (`AuthService.registerOrganization()`), chỉ tạo đúng 3 bản ghi `Role` ứng
  với 3 giá trị trên. Không có đường nào trong toàn bộ mã nguồn tạo ra 1 vai trò tên "Admin" khác.
- Nhãn "Quản trị" xuất hiện trên giao diện (mục menu Topbar dẫn tới `/admin/*`) là tên của KHU VỰC
  TRANG (route group `AdminPage.tsx` và các trang con), không phải tên 1 vai trò — đây chính là
  nguồn gốc thực sự của nhầm lẫn: người đọc báo cáo thấy chữ "Quản trị"/"Admin" ở menu và tự nhiên
  liên tưởng nó là 1 vai trò riêng, tách biệt với "Org Admin" đang thấy ở nơi khác (ma trận Vai trò
  & Phân quyền), trong khi thực ra là cùng 1 khái niệm.
- "Super Admin" — có mặt trong bảng vai trò gốc của `General_idea.md` §4 từ lúc khởi tạo tài liệu
  (18/07/2026) như 1 khái niệm ĐỊNH HƯỚNG (quản trị nhiều tổ chức, dành cho đội phát triển nền
  tảng) — nhưng CHƯA TỪNG được lập trình ở bất kỳ đợt triển khai nào sau đó. Xác nhận qua rà soát
  trực tiếp: không có bảng `super_admins`, không có `DefaultRoleName.SUPER_ADMIN`, không có logic
  phân quyền nào tham chiếu khái niệm này trong toàn bộ `apps/*`/`packages/*`.

**Kết luận: không phải lỗi code, mà là bảng vai trò ban đầu trong tài liệu không phân biệt rõ "đã
lập trình" và "định hướng tương lai/chưa triển khai", khiến người đọc báo cáo (GVHD) hiểu nhầm có 4
vai trò đang hoạt động thay vì 3.** Sửa bằng cách làm rõ tài liệu, không sửa mã nguồn:
- `Doc/General_idea.md` §4 — thêm đoạn giải thích ngay đầu mục (dẫn chiếu rõ "làm rõ 15/09/2026, sau
  phản hồi của GVHD"), thêm cột "Trạng thái" (✅ Đã lập trình / ⏳ Chưa lập trình) vào bảng vai trò,
  thêm ghi chú tách bạch 2 khái niệm dễ nhầm: "đa tổ chức" (nhiều SME dùng chung 1 lần triển khai —
  ĐÃ có, qua `organizationId` trên mọi bảng nghiệp vụ) khác với "Super Admin nhìn xuyên nhiều tổ
  chức" (CHƯA có — mọi guard/middleware hiện tại đều lọc cứng theo `organizationId` của chính người
  gọi, kể cả Org Admin).
- Thêm bullet mới vào chính mục "Lịch sử thay đổi tài liệu" của `General_idea.md`, trỏ ngược lại
  đúng mục này.

### 3. Lịch công ty (ngày lễ + sự kiện) cho Org Admin

Yêu cầu gốc khá mở ("1 cái lịch để đặt chỗ, thiết lập ngày lễ..."), thu hẹp phạm vi thành 1 MVP cụ
thể trước khi triển khai (đã nêu quyết định thiết kế trực tiếp trong hội thoại thay vì hỏi lại,
theo đúng tinh thần "cứ làm, người dùng đã phê duyệt trước"): 1 tính năng "Lịch công ty" với 2 loại
mục — `HOLIDAY` (ngày lễ) và `EVENT` (sự kiện/đặt chỗ nội bộ), chỉ Org Admin quản lý được (đúng với
văn cảnh câu hỏi gốc "org-admin's and admin's function" — thực chất là 1 vai trò duy nhất, xem mục
2 ở trên).

**Thiết kế:**
- 1 permission DUY NHẤT `PERMISSIONS.CALENDAR_MANAGE` (`calendar:manage`) — cố ý KHÔNG tách riêng
  quyền VIEW/MANAGE (mọi CRUD/xem đều yêu cầu permission này) vì chỉ Org Admin cần dùng tính năng
  này trong MVP hiện tại; Org Admin kế thừa quyền này TỰ ĐỘNG qua cơ chế có sẵn
  (`Object.values(PERMISSIONS)` — vai trò Org Admin luôn có TOÀN BỘ permission hệ thống, không cần
  liệt kê thủ công), còn Manager/Employee không được thêm permission này vào mảng quyền mặc định
  của họ (`DEFAULT_ROLE_PERMISSIONS`).
- Entity mới `CalendarEvent` (`apps/hrm-service/src/entities/calendar-event.entity.ts`) — đặt
  trong `hrm-service` thay vì tạo 1 service hoàn toàn mới: tính năng này cùng nhóm "HRM-lite" với
  chấm công/nghỉ phép đã có (quản lý thời gian/lịch trình con người), tái dùng hạ tầng Outbox +
  module NestJS sẵn có thay vì nhân bản hạ tầng cho 1 tính năng nhỏ. Field: `organizationId` (index),
  `title` (varchar 200), `description?` (text, optional), `type: CalendarEventType` (enum mới
  `HOLIDAY | EVENT`, mặc định `EVENT`), `startDate`/`endDate` (kiểu `date`, `startDate` có index),
  `createdByUserId`.
- CRUD đầy đủ theo đúng khuôn mẫu 7 lớp đã dùng nhất quán cho mọi module trong dự án: entity → DTO
  (`create-calendar-event.dto.ts`/`update-...`/`calendar-event-query.dto.ts`, mirror validation của
  `leave-requests`) → service (`calendar-events.service.ts` — `findAll()` lọc chồng lấn khoảng ngày
  bằng `LessThanOrEqual`/`MoreThanOrEqual` của TypeORM, `create()`/`delete()` theo transaction Outbox
  pattern) → controller (4 route, tất cả gate bằng `@RequirePermissions(PERMISSIONS.CALENDAR_MANAGE)`)
  → module → event Kafka (`CALENDAR_EVENT_CREATED`/`CALENDAR_EVENT_DELETED`, topic `KAFKA_TOPICS.HRM`
  — chỉ PHÁT, chưa có consumer nào tiêu thụ; để ngỏ cho 1 tính năng thông báo tương lai, không phải
  thiếu sót) → route Gateway (`/api/v1/calendar-events` thêm vào nhóm proxy `hrm-service` có sẵn) →
  frontend (`api.ts`/`hooks.ts` trong `features/admin/`, `CalendarEventModal.tsx` mới,
  `CalendarPage.tsx` mới — lưới tháng, route `/admin/calendar`, tab mới trong `AdminPage.tsx`).
- 2 mã lỗi mới: `CALENDAR_EVENT_NOT_FOUND`, `CALENDAR_EVENT_DATE_RANGE_INVALID` (đã dịch en/ja).

**Giới hạn đã biết (ghi nhận, không phải thiếu sót):** tổ chức đã tồn tại TRƯỚC khi tính năng này
triển khai (kể cả tổ chức demo tạo qua `npm run seed`) sẽ KHÔNG tự động có `calendar:manage` trên
vai trò Org Admin của họ — đúng tiền lệ đã có từ các đợt bổ sung permission mới cho CRM-lite/HRM-lite
trước đây (05/08/2026): permission mới không tự "vá ngược" vào role đã seed sẵn trong DB, chỉ áp
dụng cho tổ chức đăng ký MỚI sau thời điểm triển khai. Cần gọi `PATCH /roles/:id/permissions` thủ
công 1 lần (qua giao diện Quản trị > Vai trò & Phân quyền) nếu muốn bật tính năng này cho tổ chức
demo cũ.

**Xác minh:** `calendar-events.service.spec.ts` mới — 10/10 test (create/findAll/update/delete +
validate biên). `npx tsc --noEmit` sạch cho `hrm-service`/`gateway`/`apps/web`. Toàn bộ `hrm-service`
(`npx jest`) — 9 suite/53 test pass, `--coverage` không rớt ngưỡng.

### 4. "Quên mật khẩu" — trang + logic hoàn chỉnh

Tính năng hoàn toàn chưa tồn tại trước đó — kể cả hạ tầng gửi email cũng chưa có trong dự án. Thiết
kế theo đúng 2 tiền lệ bảo mật đã thiết lập từ trước, nêu rõ trong hội thoại trước khi triển khai:

**Chống dò email (anti-enumeration)** — mirror `DUMMY_PASSWORD_HASH`/chuẩn hoá email đã áp dụng cho
`login()` từ đợt review 22/07-25/08/2026: `AuthController.forgotPassword()` LUÔN trả về `{success:
true}` bất kể email có tồn tại trong hệ thống hay không, không phân biệt được qua response hay thời
gian phản hồi (nhánh "không tìm thấy user"/"user đã bị vô hiệu hoá" không làm gì thêm, trả cùng 1
response như nhánh thành công thật).

**Cấu hình ngoài tuỳ chọn, rỗng là trạng thái hợp lệ** — mirror `GEMINI_API_KEY`/`GROQ_API_KEY`
(analytics-service): `EmailService` (`apps/iam-service/src/email/email.service.ts`, dùng
`nodemailer`) chỉ dựng transporter SMTP thật khi `SMTP_HOST` khác rỗng; khi rỗng (mặc định dev nếu
chưa cấu hình), `sendPasswordResetEmail()` chỉ GHI LOG link reset thẳng ra log server thay vì gửi
thật — vẫn demo được TRỌN VẸN luồng "Quên mật khẩu" (bấm link thật, đặt lại mật khẩu thật) mà không
cần tài khoản Gmail/SendGrid thật. **Khác với Gemini/Groq** ở 1 điểm quan trọng: SMTP chưa cấu hình
hoặc gửi thất bại KHÔNG được phép làm `forgotPassword()` thất bại (sẽ phá vỡ đúng nguyên tắc chống
dò email ở trên) — `sendPasswordResetEmail()` bọc try/catch nuốt mọi lỗi gửi mail, chỉ log lại.

**Thiết kế token:** entity mới `PasswordResetToken` (`apps/iam-service/src/entities/password-reset-
token.entity.ts`) mirror gần như y hệt `RefreshToken` đã có (id của bản ghi CHÍNH LÀ `tokenId` nhúng
trong JWT, xác minh bằng cách tra cứu bản ghi Postgres theo id đó) — khác 2 điểm: (a) ký bằng
secret RIÊNG `jwt.resetSecret`/`JWT_RESET_SECRET` (khác hẳn access secret VÀ refresh secret — nếu 1
trong 2 secret kia từng bị lộ, kẻ tấn công vẫn không giả mạo được token reset mật khẩu, và ngược
lại); (b) dùng ĐƯỢC ĐÚNG 1 LẦN qua cột `usedAt` (không xoay vòng như refresh token), không cần Redis
blacklist vì token sống rất ngắn (mặc định 30 phút, `JWT_RESET_EXPIRES_IN`) và không có khái niệm
"thu hồi sớm" như logout().

**`AuthService.forgotPassword(dto)`:** chuẩn hoá email (`.trim().toLowerCase()`, đúng pattern đã
dùng ở `login()`/`registerOrganization()`) → tra user → nếu tìm thấy VÀ đang active: lưu 1
`PasswordResetToken` (lấy id sinh ra), ký JWT nhúng `tokenId` đó, dựng `resetLink =
${frontendUrl}/reset-password?token=${jwt}`, gọi `emailService.sendPasswordResetEmail()` — nhưng dù
nhánh nào cũng LUÔN return `{success: true}` giống hệt nhau.

**`AuthService.resetPassword(dto)`:** verify JWT bằng `jwt.resetSecret` → tra `PasswordResetToken`
theo `tokenId` trong payload → từ chối nếu KHÔNG tìm thấy / đã `usedAt` / đã hết hạn / user gắn với
token không còn active — dùng 1 MÃ LỖI CHUNG DUY NHẤT `PASSWORD_RESET_TOKEN_INVALID` cho TẤT CẢ các
nhánh từ chối này (không tách riêng "sai chữ ký"/"hết hạn"/"đã dùng rồi" như đã tách `REFRESH_TOKEN_
INVALID` vs `REFRESH_TOKEN_REVOKED`) — cố ý, vì đây là 1 endpoint CÔNG KHAI (không đăng nhập), tiết
lộ chính xác lý do thất bại giúp kẻ tấn công đoán được trạng thái token/tài khoản. Khi thành công:
hash mật khẩu mới (`bcrypt.hash(..., 10)`, khớp `login()`), đánh dấu `usedAt`, và **xoá TOÀN BỘ
`RefreshToken` hiện có của user** trong cùng 1 transaction — đăng xuất khỏi MỌI thiết bị sau khi đặt
lại mật khẩu (phòng trường hợp kẻ tấn công đã chiếm được 1 phiên đăng nhập từ trước) — chỉ cần xoá
bản ghi Postgres (nguồn sự thật chính của `RefreshToken`, không cần ghi thêm Redis blacklist từng
token, đúng thiết kế `revokeRefreshToken()` có sẵn).

**Hạ tầng:** thêm service `mailhog` mới vào `infra/docker-compose.yml` — SMTP giả lập
(`mailhog/mailhog:v1.0.1`), cổng SMTP (1025) chỉ nội bộ `internal-net`, cổng Web UI (8025) map ra
`127.0.0.1` để xem lại email đã "gửi" (không gửi ra ngoài thật, an toàn tuyệt đối cho demo/dev,
cùng quy ước giới hạn `127.0.0.1` đã áp dụng cho Prometheus/Grafana/Alertmanager). `iam-service`
trong compose trỏ sẵn `SMTP_HOST=mailhog` — không cần cấu hình gì thêm để demo được luồng đầy đủ.
Thêm `JWT_RESET_SECRET`/`JWT_RESET_EXPIRES_IN`/`SMTP_FROM`/`FRONTEND_URL` vào `infra/.env.example`
và `apps/iam-service/.env.example`.

**Frontend:** `ForgotPasswordPage.tsx` (route `/forgot-password`) — form 1 trường email, sau khi
submit LUÔN chuyển sang màn xác nhận "đã gửi (nếu email tồn tại)" bất kể thực tế thế nào (đúng thiết
kế backend, không có cách nào phân biệt được từ frontend); `ResetPasswordPage.tsx` (route `/reset-
password?token=...`) — đọc `token` từ query string qua `useSearchParams`, thiếu token thì hiện
hướng dẫn "yêu cầu liên kết mới" thay vì 1 form chắc chắn sẽ lỗi khi submit; liên kết "Quên mật
khẩu?" mới thêm vào `LoginPage.tsx` ngay dưới ô mật khẩu. Cả 2 trang dùng lại `AuthLayout.tsx`/
`FormField`/`PasswordInput` có sẵn, không tạo layout mới. i18n đầy đủ vi/en/ja (`auth.json`, thêm
namespace `forgotPasswordPage`/`resetPasswordPage` + 2 mục `hooks.forgotPassword`/`hooks.
resetPassword`).

**Xác minh:** `auth.service.spec.ts` — bổ sung 19 test mới cho `forgotPassword`/`resetPassword` (3
case forgotPassword: user active/không tồn tại/đã vô hiệu hoá — cả 3 đều assert response ra ngoài
GIỐNG HỆT nhau; 6 case resetPassword: thành công + 5 nhánh từ chối) — tổng `auth.service.spec.ts`
19/19 pass. Toàn bộ `iam-service` (`npx jest --coverage`) — 11 suite/64 test pass, không rớt ngưỡng
coverage (`coverageThreshold.global` 45%/35%/15%/45%, thực đo cao hơn nhiều ở mọi chỉ số). Khởi động
Vite dev server thật, xác nhận cả 3 route `/login`/`/forgot-password`/`/reset-password?token=abc`
đều trả `200` (không xác nhận được bằng mắt do môi trường CLI không có trình duyệt tương tác được —
ghi nhận rõ giới hạn này thay vì khẳng định đã "xem qua trình duyệt").

### Gate cuối cho cả 4 mục

`npm run build:libs` (root) sạch. `npm run typecheck` (root, cả 9 service backend + `apps/web`)
sạch. `npm run lint` (root) — 0 lỗi (32 warning còn lại đều là nền cũ, không liên quan 4 file/module
mới thêm — đã đối chiếu từng file trong output lint, không có file nào của đợt này xuất hiện).
`npm run lint:i18n-strings` — sạch, 125 file quét (không hồi quy so với 121 file của đợt 15/09 phía
trên — 4 file `apps/web` mới thêm đều tuân thủ i18n ngay từ đầu, không phát sinh vi phạm mới).
`npm run test` (root, dùng `--if-present` nên tự bỏ qua workspace `e2e` — không có script `test`
riêng từ trước, xem ghi chú 26/08/2026) — toàn bộ 12 workspace pass, không hồi quy số lượng test so
với lần chạy cuối 15/09/2026 (rà soát lại sau khoảng nghỉ). `npm run build -w apps/web` (production)
thành công — 2 chunk mới `ForgotPasswordPage`/`ResetPasswordPage` được Vite tự tách riêng đúng theo
`React.lazy()` đã khai báo ở `App.tsx`, không gộp chung vào bundle chính.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 15/09/2026 (phần "phản hồi GVHD").*

---

## Lịch sử thay đổi tài liệu này

- **2026-08-24** — Khởi tạo file, gộp lại toàn bộ lịch sử rà soát/sửa lỗi từ 18/07/2026 (khởi tạo
  `Technical_Spec.md`) tới đợt rà soát cùng ngày — nguồn dữ liệu là mục "Lịch sử thay đổi tài
  liệu" của `Technical_Spec.md` và `ECAP_Mobile.md`, cô đọng lại thành 1 dòng thời gian duy nhất.
- **2026-08-25** — Bổ sung mục "Rà soát toàn dự án lần 3" (6 hướng song song, mở rộng phạm vi
  sang mọi lỗi logic thay vì chỉ lỗi treo/sập như đợt 24/08).
- **2026-08-25 (bổ sung)** — Bổ sung mục "Review bảo mật chuyên biệt" (6 hướng OWASP-style song
  song) — phát hiện 1 lỗ hổng Nghiêm trọng chưa xử lý (rate-limit Gateway có thể bị vô hiệu hoá
  qua gia mạo IP khi kết nối thẳng cổng 3000) cần việc riêng có kiểm thử sống.
- **2026-08-25 (bổ sung lần 2)** — Bổ sung mục "Merge nhánh frontend của Nguyễn Lê Tiến" — ghi
  nhận đóng góp của Tiến (sắp xếp tuỳ chỉnh danh sách Dự án) và cách giải quyết 2 xung đột merge
  với `Sidebar.tsx`/`ProjectsListPage.tsx`; lần đầu ghi nhận đủ tên 3 thành viên nhóm.
- **2026-08-26** — Bổ sung mục "Rà soát toàn dự án lần 4" — ~30 phát hiện mới (2 Nghiêm trọng),
  toàn bộ đã sửa theo yêu cầu chủ động của người dùng, gate cuối 573 test pass trên toàn workspace.
- **2026-08-26 (bổ sung)** — Bổ sung mục "5 đề xuất cải thiện sau lần rà soát 4" — triển khai toàn
  bộ 5 đề xuất (2 đợt rà soát không tìm thêm lỗi, 1 tái cấu trúc Gateway, 1 công cụ CI mới +
  23 chuỗi i18n còn sót, 1 prop dùng chung cho Modal áp dụng cho 12 modal), gate cuối vẫn 573/573.
- **2026-08-27** — Bổ sung mục "Rà soát riêng phần vừa triển khai + kiểm tra bảo mật" — tự phát
  hiện 25 key i18n sót từ trước (dashboard/projects), 1 hướng bảo mật riêng (sạch, 1 ghi nhận Nhẹ),
  sửa 1 lỗi Nghiêm trọng vừa trong chính công cụ CI mới hôm qua (regex literal làm mất nội dung
  dòng), sửa lại đúng `AttendanceService.checkOut()`, gate cuối vẫn 573/573.
- **2026-08-27 (bổ sung)** — Bổ sung mục "Push GitHub thất bại" — `npm run lint` thực sự có 5 lỗi
  (không chỉ warning) do 2 đợt sửa gần đây chưa từng chạy lint làm gate xác minh, chỉ chạy
  typecheck+test. Đã sửa cả 3 nguồn lỗi, cập nhật quy trình: gate cuối từ nay luôn gồm cả lint.
- **2026-08-29** — Bổ sung mục "Unit test thất bại sau khi lint đã sạch" — hoá ra không phải test
  hỏng mà là `coverageThreshold.branches` của `notification-service` tụt dưới ngưỡng (55%, thực đo
  49.57%); lấp bằng 14 test mới cho 3 khoảng trống coverage có sẵn (2 từ trước, 1 từ đợt CRASH-
  recovery 26/08), không đổi code sản phẩm nào.
- **2026-08-29 (bổ sung)** — Bổ sung mục "Merge nhánh frontend của Tiến (lần 2)" — 7 file conflict
  Git thật + 5 hồi quy ngữ nghĩa "im lặng" không có dấu conflict (2 lỗi cùng lớp MAJOR Fix 3 26/08
  tái xuất hiện ở `ProjectCard.tsx`/`ProjectDetailPage.tsx`/`EditProjectModal.tsx`, 1 lỗi cú pháp
  JSX do merge tự lặp đôi nội dung, 4 chuỗi tiếng Việt hardcode mới, 1 lỗi type `DateRangeOption`
  lệch giữa 2 nhánh) — bài học: chỉ tìm dấu conflict là không đủ, phải chạy đủ lint+typecheck+test.
- **2026-09-15** — Bổ sung mục "Rà soát lại sau khoảng nghỉ 2 tuần" — quay lại dự án phát hiện 1 đợt
  code mới của Tiến (thuần frontend, merge sạch không conflict) chưa từng qua `lint:i18n-strings`:
  102 chuỗi tiếng Việt hardcode trên 16 file, dịch toàn bộ bằng 3 agent song song; 5 lỗi thật phát
  hiện qua chính quá trình đọc để dịch (deal đã chốt vẫn tô đỏ "sắp quá hạn", Dashboard cứng
  `limit: 100` cho danh sách dự án + khối tính KPI phía client hoàn toàn không có chú thích, chọn tệp
  hàng loạt không reset khi đổi thư mục, kéo-thả nhiều tệp âm thầm mất hết trừ tệp đầu, badge chấm
  công tính giờ theo timezone trình duyệt thay vì GMT+7 — lỗi cuối tái diễn đúng lớp lỗi đã sửa toàn
  dự án 22/07/2026), toàn bộ đã sửa. Gate cuối sạch, không hồi quy so với 29/08.
- **2026-09-15 (phản hồi GVHD)** — Bổ sung mục "4 góp ý của giảng viên hướng dẫn" — sửa lỗi thật
  (dead prop `minDate` ở `DatePicker.tsx` khiến "Nghỉ phép" chọn được ngày quá khứ, vá cả frontend
  lẫn backend); làm rõ tài liệu RBAC (không phải lỗi code — chỉ 3/4 vai trò trong bảng gốc đã lập
  trình, "Super Admin" chưa từng triển khai); 2 tính năng mới hoàn toàn (Lịch công ty cho Org Admin —
  `hrm-service`, permission `calendar:manage` riêng; "Quên mật khẩu" — entity `PasswordResetToken`
  mirror `RefreshToken` với secret ký riêng, `EmailService`/`nodemailer` + service `mailhog` mới
  trong Docker Compose cho demo không cần SMTP thật, thiết kế chống dò email mirror `login()`).
  Gate cuối sạch (typecheck/lint/lint:i18n-strings/test toàn 12 workspace), không hồi quy.
