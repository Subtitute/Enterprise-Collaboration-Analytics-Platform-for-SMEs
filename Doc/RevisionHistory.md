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
