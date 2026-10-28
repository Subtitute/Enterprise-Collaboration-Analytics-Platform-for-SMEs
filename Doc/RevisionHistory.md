# Lịch sử rà soát & sửa lỗi — Enterprise Collaboration & Analytics Platform for SMEs

File này gộp lại **toàn bộ các đợt rà soát/sửa lỗi** của dự án (backend, frontend, hạ tầng, và
`ecap-mobile`) thành 1 dòng thời gian duy nhất, dễ tra cứu. Đây là bản **tóm tắt điều hướng** —
chi tiết kỹ thuật đầy đủ (file:line, kịch bản tái hiện, đoạn code trước/sau) vẫn nằm ở:
- `Doc/Technical_Spec.md` → mục "Lịch sử thay đổi tài liệu" (backend/frontend/hạ tầng), và
- `Doc/ECAP_Mobile.md` → mục "Lịch sử thay đổi tài liệu" (riêng `ecap-mobile`).

Mỗi mục dưới đây có dòng "Chi tiết:" trỏ tới đúng vị trí trong 2 file trên khi cần đào sâu.

---

## 18/07/2026 — Khởi tạo tài liệu kỹ thuật

Tạo `Technical_Spec.md`: kiến trúc tổng thể, tech stack, 6 service MVP, thiết kế event-driven
(Outbox + Kafka), schema DB, AuthN/AuthZ, quy ước API, hạ tầng Docker, bảo mật, kiểm thử, CI/CD,
NFR, cấu trúc repo.

## 21/07/2026 — Review toàn diện lần 1 (vai trò giảng viên phản biện)

- Bổ sung `TaskStatusHistory`, event `task.deleted`/`project.deleted`.
- Bucket MinIO chuyển sang **private**; làm rõ `FileShare` khi đó chỉ mang tính hiển thị.
- Xác thực nội bộ Gateway→Service qua `x-internal-secret`; thu hồi access token qua Redis khi
  deactivate; refresh token chuyển sang cookie httpOnly; RBAC guard áp dụng cho cả GET.
- Quy tắc mạng: chỉ `web`/`gateway` expose port ra host.
- **Bổ sung sau rebuild (cùng ngày):** 2 lỗi chỉ lộ ra khi chạy thật — Document Service dùng
  chung 1 endpoint MinIO cho cả nội bộ lẫn presigned URL (tách `MINIO_PUBLIC_ENDPOINT`); healthcheck
  `web` phân giải nhầm `::1` (IPv6) thay vì `127.0.0.1`.

*Chi tiết: Technical_Spec.md, mục "21/07/2026".*

## 22/07/2026 — 4 lỗi từ kiểm thử thật của người dùng

`PaginationQueryDto.limit` trần quá thấp (100→500); `GET /roles` thiếu `permissionKeys` (sập
trang Vai trò & Phân quyền); Notification Service thiếu field `id` (đánh dấu đã đọc luôn gọi
`id=undefined`); `fetchFolders()` giả định sai hình dạng response.

## 22/07/2026 (bổ sung) — Lệch hợp đồng field name Document Service ↔ Frontend

`parentFolderId` (BE) vs `parentId` (FE) cho thư mục; `fileName`/`sizeBytes`/`currentVersion` (BE)
vs `name`/`size`/`version` (FE) cho tệp — sửa bằng lớp chuẩn hoá `mapFolder`/`mapFile` ở frontend,
không đổi field backend. Phát hiện thêm: 4/5 service gọi `enableCors()` không tham số → wildcard
CORS kết hợp `credentials: true` vi phạm spec — gỡ khỏi 4 service, chỉ Gateway xử lý CORS.

## 22/07/2026 (bổ sung lần 2) — Dropdown bị cắt, xem/tải file, nút Back, tìm kiếm, hồ sơ cá nhân

Menu tệp không hiện (Dropdown bị `overflow` của bảng cha cắt mất) — chuyển sang React Portal;
thêm `disposition=inline|attachment` cho tải file; `currentFolderId` chuyển sang query param để
nút Back hoạt động đúng; xây `useGlobalSearch()` (tìm kiếm client-side); thêm trang Hồ sơ cá nhân
mới (`/profile`).

## 22/07/2026 (review toàn dự án) — 194/194 test qua

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

*Chi tiết: Technical_Spec.md, mục "22/07/2026 (review toàn dự án)".*

## 25/07/2026 — Review vòng 2 (298/298 test qua)

**Nghiêm trọng:** leo thang đặc quyền qua `POST /users/invite` (Manager tự đọc UUID vai trò Org
Admin qua `GET /users` rồi mời tài khoản mới với vai trò đó); Gateway có thể sập toàn tiến trình
do unhandled promise rejection trong `jwt-auth.middleware.ts` (nhánh sau verify JWT nằm ngoài
`try/catch`).

**Nghiêm trọng vừa:** rate-limit bị bypass qua giả mạo `X-Forwarded-For`; rủi ro sniff-XSS qua
`text/plain`/`text/csv`; KPI "tỷ lệ hoàn thành" có thể vượt 100% (không dùng phương pháp cohort);
WebSocket real-time Analytics phát trùng; thiếu `depends_on` cho Redis; `seed.js` tạo tổ chức
demo mới mỗi lần chạy; validation tiếng Anh.

*Chi tiết: Technical_Spec.md, mục "25/07/2026 (review vòng 2)".*

## 28/07/2026 — Nâng cấp chất lượng Frontend

Code splitting theo route (bundle chính 954KB → 347KB + chunk riêng); bộ E2E Playwright đầu tiên
(`e2e/`, 7 kịch bản) — **phát hiện ngay 1 lỗi thật đang chạy production**: `window.open()` kèm
`noopener/noreferrer` luôn trả `null` theo đặc tả WHATWG, khiến bản sửa popup-blocker ngày
22/07/2026 vô hiệu từ lúc viết ra. Đợt rà soát a11y: focus trap cho `Modal`, `aria-describedby`
cho form, skip-to-content, và 10 điểm nhỏ khác.

## 28/07/2026 — Dead Letter Queue

Kafka producer mới cho Analytics/Notification Service; giới hạn 5 lần retry; module
`failed-events` (MongoDB, `GET /api/v1/failed-events`, quyền `system:manage`). Phát hiện quan
trọng: subscribe theo `Object.values(KAFKA_TOPICS)` sẽ khiến consumer tự đọc lại DLQ của chính nó
— sửa bằng khai báo tường minh danh sách topic.

## 28/07/2026 — Access-control tài liệu theo thư mục/phòng ban

`Folder.visibility` (`organization`/`restricted`), entity `FolderShare`, `FileShare` bổ sung
`sharedWithDepartmentId`. Sửa lệch hợp đồng: `name` trong `PATCH /folders/:id` từ bắt buộc sang
optional (đúng ngữ nghĩa PATCH).

## 28/07/2026 — KPI theo phòng ban

Event `USER_DEPARTMENT_CHANGED`; bảng `dim_user` (Analytics); 3/4 endpoint KPI nhận `departmentId`
optional. Backfill lịch sử 1 lần cho dữ liệu demo hiện có.

## 28/07/2026 — Kiểm tra tổng thể ("ultimate check")

Sửa: JWT test payload thiếu `departmentId` (typecheck fail); **`GET /api/v1/failed-events` khiến
bản ghi `organizationId=null` vĩnh viễn vô hình** với mọi Org Admin (lỗ hổng thiết kế nghiêm trọng
nhất của tính năng DLQ). Dọn dữ liệu demo lộn xộn, seed lại sạch. Kết quả: 14 container healthy,
375/375 test qua, E2E 7/7.

## 28/07/2026 (xác minh sống 04/08/2026) — Nhận xét AI (Gemini)

Model mặc định `gemini-2.5-flash` bị Google khai tử cho project mới (404) → chuyển
`gemini-flash-latest`; phản hồi bị cắt cụt do "thinking token" chiếm hết ngân sách → nâng
`maxOutputTokens` lên 2048. 385/385 test qua.

## 04/08/2026 — Observability hạ tầng

`packages/common-metrics` (bọc `prom-client`) cho toàn bộ service; thêm Prometheus/Grafana/
kafka-exporter. Xác minh sống: 8/8 target Prometheus `up`, không đếm trùng traffic giữa Gateway
và service đích.

## 05/08/2026 — CRM-lite & HRM-lite (2 service mới, cùng ngày)

`apps/crm-service` (Customer + Deal pipeline, Kanban 6 giai đoạn); `apps/hrm-service` (chấm công
photo-proof — cố ý KHÔNG nhận diện khuôn mặt, nghỉ phép có duyệt). Cả hai gặp và tự sửa cùng 1
lỗi khởi động (thiếu `type` tường minh trên cột nullable string).

## 06/08/2026 — Rà soát toàn diện sau CRM/HRM/Observability

388/388 test qua, 20 container healthy, 10/10 target Prometheus `up`. Phát hiện sai lệch tài
liệu (không phải lỗi code): README.md/§7 mô tả route `/api/docs` **chưa từng tồn tại** — sửa lại
mô tả cho khớp thực tế.

## 10/08/2026 — Dữ liệu RBAC lệch pha của tổ chức demo cố định

Phát hiện khi thử `ecap-mobile`: Manager/Employee của tổ chức demo (đăng ký trước CRM/HRM-lite)
thiếu toàn bộ permission CRM/HRM-lite — đúng hành vi RBAC theo thiết kế (không tự ghi đè), sửa
bằng `PATCH /roles/:id/permissions` đúng API có sẵn, không đụng DB trực tiếp.

## 10/08/2026 — Dữ liệu thật cho trang Tài liệu + sửa sơ đồ §1

Thay dữ liệu minh hoạ bằng tài liệu THẬT của dự án (Markdown → PDF, tải qua API có sẵn). Sửa sơ
đồ Mermaid §1 còn nhắc tới "Swagger aggregation" đã bị gỡ mô tả ngày 06/08.

## 12/08/2026 — CNA mở rộng phạm vi: Công việc & Tài liệu

Đối chiếu trực tiếp `DEFAULT_ROLE_PERMISSIONS` của Employee thay vì suy đoán — phát hiện phạm vi
CNA ban đầu hẹp hơn quyền Employee thực có trên web. Thêm `TasksPage`/`DocumentsPage`; cố ý loại
CRM (Deal) khỏi mobile. Sự cố công cụ: `file_picker` 11.x build lỗi → ghim `10.3.10`.

## 12/08/2026 — Đưa `ecap-mobile/` và `Doc/` vào Git; rà soát mã nguồn mobile

Sửa 1 lỗi thật (`.files.single` không bọc `try/catch`, có thể ném `StateError`); di chuyển
`ecap-mobile/`/`Doc/` vào làm thư mục con của repo chính rồi commit (trừ `ClaudeRule.md`).

## 13/08/2026 — Địa chỉ Gateway động + cờ vị trí chấm công

`GatewayConfig.resolveBaseUrl()` đọc URL Gateway từ 1 Gist công khai — APK không cần build lại
khi tunnel Cloudflare đổi URL. Chấm công (web + mobile) gửi kèm toạ độ GPS tuỳ chọn, gắn cờ
"on-site"/"off-site" (soft flag, không chặn check-in/out).

## 20/08/2026 — 5 báo cáo lỗi thủ công

Lỗi gốc chung "thấy dữ liệu tổ chức cũ sau khi đổi tài khoản" — không phải lỗ hổng tenant, mà
`QueryClient` singleton không bị xoá cache khi đổi phiên (sửa bằng `queryClient.clear()`). Modal
mất focus liên tục khi gõ (dependency array không ổn định). Nút "hiện mật khẩu" của trình duyệt
mất đồng bộ với React state — tự vẽ `PasswordInput` riêng. Thêm cảnh báo (không chặn) khi mật
khẩu có dấu tiếng Việt.

## 20/08/2026 → 21 — Đa ngôn ngữ Việt/Anh/Nhật (i18n)

Rollout toàn bộ giao diện + thông báo lỗi backend: ~101 file frontend, 82 mã lỗi backend, 12
namespace × 3 ngôn ngữ. Phát hiện qua xác minh trực tiếp (không chỉ đọc code): container Docker
là build tĩnh, phải rebuild+up lại mới xác minh đúng; `getByLabel('Mật khẩu')` trở nên mơ hồ sau
khi có nút "hiện mật khẩu" (khớp cả 2 phần tử) — sửa bằng lọc theo role; nút chọn ngôn ngữ ở màn
đăng nhập lệch vị trí do CSS `absolute` áp lên phần tử sai.

*Chi tiết: Technical_Spec.md §18.*

## 22/08/2026 — Tier 1 (4 hạng mục chi phí thấp, ảnh hưởng rõ)

`npm audit fix` (13→7 lỗ hổng); xác minh `infra/.env` chưa từng lộ lên Git; phân trang thật cho
Dự án/Khách hàng; quản lý focus bàn phím cho `Dropdown.tsx`.

## 22/08/2026 — Tier 2 (testing, cứng hoá backend, hạ tầng)

Unit test mới cho `crm-service`/`hrm-service`; 3 e2e spec mới (CRM/HRM/Analytics); `coverageThreshold`
trên 8 service + 3 package. `/health` chuyển sang `@nestjs/terminus` cho cả 8 service; chặn
brute-force đăng nhập theo tài khoản; correlation ID xuyên suốt request. Alertmanager + 4 luật
cảnh báo (xác minh sống); ghim 6 image `:latest` sang digest; `scripts/backup.js`/`restore.js`
cho cả 8 nguồn dữ liệu. **Bonus fix phát hiện giữa chừng:** `ioredis` mặc định xếp hàng lệnh khi
mất kết nối thay vì từ chối ngay — vá cho `rate-limit.middleware.ts` (lỗi có từ trước, không phải
mới).

## 22/08/2026 — Tier 3 (ghi nhận, cố ý chưa triển khai)

Audit trail/soft-delete, các giới hạn `ecap-mobile` đã biết, nâng cấp TypeORM 0.3→1.0 (không làm
trước bảo vệ đồ án), lệch phiên bản React/Vite/ESLint. Xem `Doc/Upgrade.md` để theo dõi trạng
thái đầy đủ 3 Tier.

## 24/08/2026 — Rà soát toàn dự án lần 2 (7 lỗi Nghiêm trọng + ~13 lỗi Nghiêm trọng vừa)

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
21/07/2026); riêng phần `ecap-mobile` xem thêm `Doc/ECAP_Mobile.md` §15.*

## 25/08/2026 — Rà soát toàn dự án lần 3 (6 hướng song song, không giới hạn ở lỗi treo/sập)

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

## 25/08/2026 (bổ sung) — Review bảo mật chuyên biệt (OWASP-style, 6 hướng song song)

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

## 25/08/2026 (bổ sung — merge nhánh frontend của Nguyễn Lê Tiến)

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

*Chi tiết: Technical_Spec.md, mục "25/08/2026 (merge nhánh frontend của Nguyễn Lê Tiến)".*

## 26/08/2026 — Rà soát toàn dự án lần 4 (~30 phát hiện, đã sửa toàn bộ)

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

## 26/08/2026 (bổ sung) — 5 đề xuất cải thiện sau lần rà soát 4, triển khai toàn bộ

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

## 27/08/2026 — Rà soát riêng phần vừa triển khai (lần 4 + 5 đề xuất) + kiểm tra bảo mật

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

## 27/08/2026 (bổ sung) — Push GitHub thất bại: `npm run lint` có lỗi thật, không chỉ warning

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

## 29/08/2026 — Unit test thất bại sau khi lint đã sạch: `coverageThreshold` "branches" của
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

## 29/08/2026 (bổ sung) — Merge nhánh `frontend` của Nguyễn Lê Tiến (lần 2) — 7 file conflict +
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

## 15/09/2026 — Rà soát lại sau khoảng nghỉ 2 tuần: 102 chuỗi tiếng Việt hardcode + 5 lỗi thật từ
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

## 15/09/2026 (phản hồi GVHD) — 4 góp ý của giảng viên hướng dẫn sau khi xem báo cáo/demo

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
văn cảnh câu hỏi gốc "org-admin's and admin's function" — thực chất là 1 vai trò duy nhất, xem §2
ở trên).

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

## 16/09/2026 — Merge nhánh `frontend` của Nguyễn Lê Tiến (lần 3) — 23 file conflict Git thật + 1 hồi quy ngữ nghĩa "im lặng"

Người dùng tự merge nhánh `frontend` của Tiến vào nhánh chính bằng công cụ Git riêng (môi trường
CLI này không có `git`), để lại dấu conflict (`<<<<<<< HEAD` / `=======` / `>>>>>>> origin/frontend`)
trong **23 file**, toàn bộ đều trong `apps/web` — 69 khối conflict: `i18n/locales/{vi,en,ja}/
{hrm,documents,crm,admin}.json` (12 file, 1-3 khối/file), `components/ui/DatePicker.tsx` (3),
`features/hrm/{AttendancePage.tsx (23!), LeaveRequestsPage.tsx (1), components/
NewLeaveRequestModal.tsx (2)}`, `features/documents/{DocumentsPage.tsx (2), components/
FileTable.tsx (1), components/FolderGrid.tsx (2)}`, `features/crm/components/CustomerCard.tsx (2)`,
`features/notifications/{utils.tsx (9), NotificationsPage.tsx (2), components/
NotificationBell.tsx (1)}`.

**Cách xử lý**: `admin.json` (3 file, 1 khối/file) + `DatePicker.tsx`/`NewLeaveRequestModal.tsx` (5
khối, gắn trực tiếp với bản vá "Nghỉ phép chọn được ngày quá khứ" 15/09/2026 của chính tôi) tự giải
quyết trực tiếp; 4 nhóm còn lại (HRM, Documents, CRM, Notifications — 61 khối) giao cho 4 agent chạy
song song, mỗi agent 1 khu vực tính năng, cùng bộ hướng dẫn: đọc CẢ HAI phía đầy đủ (không chỉ vài
dòng đánh dấu), phân biệt "cả 2 phía cùng sửa 1 bug độc lập" (chọn 1 bản, xoá bản trùng) với "cả 2
phía cùng thêm tính năng khác nhau" (gộp cả 2), và đặc biệt canh chừng hiện tượng đã biết từ 2 lần
merge Tiến trước (29/08, đợt "rà soát lại" 15/09): Git 3-way merge có thể gộp SẠCH (không báo
conflict) 2 đoạn thêm khác dòng nhưng cùng ý — để lại `const` trùng tên trong cùng scope hoặc key
JSON trùng trong cùng object (giá trị đầu bị đè âm thầm).

**Phát hiện qua chính tôi** (`DatePicker.tsx`, ngoài vùng conflict được đánh dấu): cả 2 phía độc lập
thêm cơ chế disable ô ngày `< minDate` (đúng bản vá 15/09/2026 của tôi, và Tiến làm y hệt) — merge
gộp sạch phần tính `isDisabled`, để lại **2 lần khai báo `const isDisabled`** trong cùng 1 vòng lặp
render (`dateStr`/`formattedMonth`/`formattedDay` của Tiến VÀ `dayStr` của tôi, tính ra CÙNG 1 giá
trị) — lỗi biên dịch thật nếu không gộp lại. Giữ 1 bản tính duy nhất (dùng tên `dateStr` của Tiến,
giữ chú thích lý do so sánh chuỗi của tôi), giữ kiểu tô màu ô bị khoá đẹp hơn của Tiến
(`line-through`/nền mờ) thay vì bản đơn giản của tôi.

**Phát hiện qua 4 agent** (đầy đủ trong báo cáo từng agent, tóm tắt):
- **HRM** (33 khối — lớn nhất): `AttendancePage.tsx` 23 khối hoá ra CHỈ 1 nguyên nhân lặp lại nhiều
  lần — cả 2 phía độc lập đặt tên khác nhau cho CÙNG khái niệm (`statusBadge`/`statuses`,
  `monthFilter`/`filter`, `photoModal`/`photoProofModal`, `viewProofIn`/`viewCheckInProofTitle`...)
  — agent giữ bản khớp đúng quy ước đặt tên sẵn có của file, xoá bản trùng khỏi cả 3 locale.
  **Bug thật tìm thấy** ở `LeaveRequestsPage.tsx` (1 khối): bản merge của tôi gọi
  `parseLeaveReason(request.reason)` THIẾU tham số bắt buộc thứ 2 (`t`) — sẽ ném lỗi runtime
  "t is not a function" ngay khi có 1 đơn nghỉ phép nào đó có `reason` đúng định dạng
  `[ANNUAL] ...`; bản của Tiến gọi đúng đủ tham số nhưng lại hardcode fallback tên nhân viên
  `'Nhân viên'` thay vì dùng key i18n có sẵn. Gộp đúng nửa tốt của mỗi bên.
- **Documents** (8 khối): cùng lớp "2 tên cho 1 khái niệm" (`viewMode.*`/`viewGrid*`,
  `updatedLabel`/`updatedAt`, `loadingFileCount`/`loading`) + phát hiện phụ 2 cặp key JSON trùng
  lặp cơ học thật (`documentsPage.searchPlaceholder`, `fileTable.selectFileAria`/`selectAllAria`
  mỗi key khai báo 2 lần, cùng giá trị — vô hại nhưng dọn cho sạch).
- **CRM** (8 khối): cùng lớp đặt tên trùng (`editCustomer`/`edit`, `lastInteraction`/`interaction`)
  + xác nhận `DealKanbanBoard.tsx` cần đúng section `kanban` từ phía tôi (Tiến bỏ sót khi merge thủ
  công đoạn đó), giữ lại đúng.
- **Notifications** (12 khối): gộp 2 cách viết `getNotificationVisualConfig` (giữ điều kiện match
  cả 2 phía cộng lại), gộp `targetName`/`targetKey` theo cấu trúc bắt buộc của Tiến (HEAD thiếu hẳn
  field `targetKey` — sẽ lỗi kiểu TypeScript nếu giữ nguyên). **Bug thật tìm thấy** (ngoài vùng
  conflict): `cleanNotificationMessage()` gọi `.toUpperCase()` lên CHÍNH CHUỖI PATTERN thay vì lên
  kết quả khớp được (`'(#$1)'.toUpperCase()` là no-op vì không ký tự nào trong `(#$1)` có
  hoa/thường) — mã hash UUID được "dọn" khỏi thông báo đáng lẽ phải viết hoa nhưng vẫn giữ nguyên
  chữ thường; sửa bằng callback `.replace(pattern, (_m, hex) => `(#${hex.toUpperCase()})`)`.

**Hồi quy phát hiện SAU khi gộp xong (chạy lại toàn bộ gate, không phải trong vùng conflict nào)**:
1. `NotificationBell.tsx` — `<Dropdown align="end" contentClassName="...">`: cả 2 prop đều SAI so
   với API thật của `Dropdown.tsx` (`align?: 'left'|'right'` — không có `'end'`; tên prop đúng là
   `panelClassName`, không phải `contentClassName`) — lỗi biên dịch thật, phát hiện qua
   `npm run typecheck`. Đây là code của Tiến, chưa từng qua conflict nên chưa ai đọc lại — sửa
   thành `align="right"` (khớp mặc định), `panelClassName`.
2. `apps/notification-service/src/notifications/notifications.service.spec.ts` — 2 test kỳ vọng
   `filter.type` là chuỗi tuyệt đối (`'task.assigned'`), nhưng `NotificationsService.findForUser()`
   thực tế đã xây `filter.type` thành 1 `RegExp` khớp TIỀN TỐ (cho phép lọc `'leave_request'` khớp
   cả `'leave_request.approved'`/`'leave_request.rejected'`) — tính năng có chủ đích (có chú thích
   giải thích rõ trong service), test chỉ đơn giản chưa được cập nhật theo. Không phải file
   `apps/web` nên KHÔNG nằm trong 23 file có dấu conflict — merge sạch, chỉ lộ ra khi chạy lại toàn
   bộ `npm run test`. Sửa lại test để so khớp bằng `RegExp`/`.test(...)` thay vì so sánh chuỗi.
3. Gate `lint:i18n-strings` phát hiện thêm **83 chuỗi tiếng Việt hardcode mới** (đúng lớp phát hiện
   như đợt "rà soát lại sau khoảng nghỉ 2 tuần" 15/09/2026 — code của Tiến merge sạch nhưng chưa
   từng qua bộ kiểm tra này) trên 10 file KHÔNG nằm trong 23 file conflict (`Topbar.tsx`,
   `RoleCheckboxList.tsx`, `DepartmentsPage.tsx`, `MembersPage.tsx`, `RolesPermissionsPage.tsx`,
   `ProfilePage.tsx`, `AnalyticsPage.tsx`, `LeaveRequestsPage.tsx`, `NotificationsPage.tsx`,
   `notifications/utils.tsx`). Giao lại cho 4 agent song song khác (theo khu vực): 1 agent xác nhận
   và XOÁ hẳn (không chỉ `i18n-lint-ignore`) các nhánh `.includes('quản trị'/'quản lý'/'nhân viên')`
   so khớp tên vai trò — xác nhận qua rà soát toàn bộ mã nguồn rằng `Role.name` KHÔNG BAO GIỜ có thể
   là tiếng Việt (chỉ được seed bằng 3 giá trị tiếng Anh cố định, không có endpoint đổi tên vai
   trò) nên các nhánh đó là code chết thật sự, không phải ngoại lệ hợp lệ; 1 agent dịch đầy đủ 32
   nhãn quyền hạn trong `RolesPermissionsPage.tsx` (tái sử dụng key `admin:rolesPermissionsPage.
   permissions.*` đã có sẵn, khớp 100% với văn bản hardcode — không cần dịch lại); 1 agent xử lý
   `AnalyticsPage.tsx` (tách đúng 2 loại: pattern-matching lên văn bản AI (Gemini/Groq) tiếng Việt
   do backend sinh ra → `i18n-lint-ignore`, còn 3 tên dự án demo + 3 câu fallback + 3 nhãn
   Điểm sáng/Rủi ro/Khuyến nghị là văn bản UI thật → dịch đầy đủ vi/en/ja); 1 agent gắn
   `i18n-lint-ignore` cho các điểm so khớp còn lại (`LeaveRequestsPage.tsx`'s `parseLeaveReason()` -
   so khớp dữ liệu ĐÃ LƯU từ trước khi có quy ước `[ANNUAL]`-prefix; `NotificationsPage.tsx`/
   `notifications/utils.tsx` - so khớp `title` do backend sinh sẵn, cùng loại đã có tiền lệ).
4. Gói `packages/common-dto`: `coverageThreshold.functions` (30%) tụt xuống 28.57% — KHÔNG do đợt
   merge này (không đổi code sản phẩm nào của gói) mà do cấu trúc: mỗi `export enum` biên dịch
   thành 1 hàm IIFE runtime, và gói này có 5 file enum chưa từng có test nào import tới chúng (file
   test duy nhất từ trước, `pagination.dto.spec.ts`, chỉ đụng tới `dto/pagination.dto.ts`) — thêm 1
   enum mới bất kỳ (kể cả không đổi code) đều kéo % xuống dần theo thời gian. Lấp bằng 1 file test
   mới (`enums/enums.spec.ts`, 22 test) xác nhận giá trị của cả 6 enum/hằng số dùng chung
   (`TaskStatus`, `ProjectStatus`, `DealStage`, `LeaveRequestStatus`, `CalendarEventType`,
   `DefaultRoleName`/`PERMISSIONS`/`DEFAULT_ROLE_PERMISSIONS`) — vừa lấp ngưỡng vừa là lưới an toàn
   thật chống đổi tên/xoá nhầm 1 giá trị enum (hợp đồng dữ liệu lưu thẳng vào DB, dùng xuyên nhiều
   service).

**Xác minh cuối cùng**: `node scripts/check-hardcoded-vietnamese.js` sạch (129 file, 0 vi phạm).
`npm run typecheck` (root, cả 9 service + `apps/web`) sạch. `npm run lint` (root) 0 lỗi (chỉ còn
warning nền cũ, không tăng). `npm run test` (root) — 12/12 workspace pass, không hồi quy số lượng
test. `npm run test:coverage` (root) — sạch, không rớt ngưỡng ở bất kỳ workspace nào (kể cả
`common-dto` sau khi vá). `npm run build -w apps/web` (production) thành công.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 16/09/2026 (phần "merge nhánh
frontend lần 3 + Super Admin").*

---

## 16/09/2026 — Tính năng mới: "Super Admin" (quản trị nền tảng, xuyên nhiều tổ chức)

Người dùng yêu cầu triển khai "Super Admin" — vai trò được `General_idea.md` §4 ghi nhận từ
18/07/2026 như 1 khái niệm ĐỊNH HƯỚNG, CHƯA từng lập trình (làm rõ lại 15/09/2026 sau phản hồi
GVHD, xem mục "phản hồi GVHD" phía trên). Đây là lần ĐẦU TIÊN hệ thống có 1 tài khoản nhìn xuyên
được NHIỀU tổ chức — quyết định kiến trúc quan trọng nhất là **giới hạn phạm vi nhìn-xuyên-tổ-chức
đó ở ĐÚNG 1 nơi duy nhất: quản lý vòng đời entity `Organization` trong `iam-service`**, KHÔNG mở
rộng sang bất kỳ dữ liệu nghiệp vụ nào của 6 service còn lại (dự án, tài liệu, khách hàng, chấm
công, báo cáo...) — giữ nguyên bất biến "đa tổ chức, không tổ chức nào nhìn xuyên tổ chức khác"
(`General_idea.md` §4) cho MỌI dữ liệu nghiệp vụ, chỉ phá lệ đúng 1 chỗ có kiểm soát.

**Thiết kế chống đổ vỡ kiến trúc hiện có**: `InternalAuthGuard` (`packages/common-guard`) bắt buộc
mọi request phải mang `x-org-id` KHÔNG RỖNG mới qua được (từ chối cứng nếu thiếu) — nếu cho
`User.organizationId` là `null`/nullable cho Super Admin sẽ phải sửa lại guard này VÀ mọi câu
truy vấn `WHERE organizationId = ...` ở 7 service, rủi ro rất lớn cho 1 tính năng phụ. Thay vào đó:
tạo 1 Organization "hệ thống" DUY NHẤT (`Organization.isSystem: boolean`, cột mới) chỉ để "an cư"
tài khoản Super Admin (thoả FK `organizationId NOT NULL` mà không phải sửa gì ở 7 service khác),
và 1 cột `User.isSuperAdmin: boolean` (mặc định `false`) đánh dấu quyền hạn thật sự — hoàn toàn
tách biệt khỏi hệ thống Role/Permission theo tổ chức hiện có (Super Admin không có `Role` nào,
`permissions[]` luôn rỗng).

**Luồng xác thực**: `AuthContext`/`JwtAccessPayload` (`packages/common-dto`) thêm field
`isSuperAdmin: boolean`; Gateway forward qua header nội bộ mới `x-is-super-admin`
(`inject-auth-headers.ts`); `InternalAuthGuard` đọc lại thành `AuthContext.isSuperAdmin`. Guard mới
`SuperAdminGuard` + decorator `@RequireSuperAdmin()` (`packages/common-guard`, mirror đúng mẫu
`PermissionsGuard`/`@RequirePermissions()` nhưng tách guard riêng vì đây là 1 cấp độ quyền hạn khác
hẳn RBAC theo tổ chức) — chỉ đăng ký làm `APP_GUARD` thứ 3 trong `iam-service` (không phải cả 7
service), giữ phạm vi ảnh hưởng nhỏ nhất có thể.

**Khoá/mở khoá 1 tổ chức**: `Organization.isActive: boolean` (cột mới, mặc định `true`) — mirror
đúng ý tưởng `User.isActive` nhưng ở cấp tổ chức. `AuthService.login()`/`refresh()` gộp kiểm tra
`!user.organization.isActive` vào CHUNG nhánh chống đoán tài khoản đã có sẵn (cùng "Email hoặc mật
khẩu không đúng"/`INVALID_CREDENTIALS` cho `login()`, cùng `USER_INACTIVE_OR_MISSING` cho
`refresh()`) — không tạo mã lỗi riêng để không lộ "tổ chức bạn đã bị khoá" khác với "sai mật khẩu"
cho kẻ tấn công đang dò tài khoản. Khoá 1 tổ chức còn chủ động blacklist Redis access token của
TOÀN BỘ user thuộc tổ chức đó ngay lập tức (mirror `UsersService.deactivate()` cho 1 user, nay lặp
cho cả danh sách, fail-open giống hệt nếu Redis lỗi).

**Bootstrap**: không có luồng đăng ký Super Admin qua API (sẽ là lỗ hổng bảo mật nghiêm trọng nếu
bất kỳ ai tự đăng ký được quyền quản trị toàn nền tảng) — `SuperAdminBootstrapService`
(`OnModuleInit`) tự tạo tài khoản Super Admin ĐẦU TIÊN lúc `iam-service` khởi động, CHỈ khi 2 biến
môi trường `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` được cấu hình (để trống = tắt hoàn toàn tính
năng, mirror triết lý "cấu hình ngoài tuỳ chọn" đã áp dụng cho SMTP/Gemini/Groq) VÀ chưa có user
nào dùng đúng email đó (idempotent tuyệt đối — không bao giờ ghi đè tài khoản đã tồn tại, kể cả sau
khi Super Admin tự đổi mật khẩu, an toàn qua vô số lần restart service).

**API mới** (`apps/iam-service/src/platform-admin/`, route `/api/v1/platform-admin/*`, Gateway
thêm prefix vào nhóm proxy `iam-service` sẵn có): `GET organizations` (danh sách phân trang, loại
trừ tổ chức hệ thống qua `isSystem: false`, kèm `userCount` đếm riêng từng tổ chức — quy mô đồ án
tốt nghiệp không cần tối ưu 1 subquery gộp), `GET organizations/:id`, `PATCH organizations/:id/
{de,re}activate`, `GET stats` (tổng số tổ chức/tổ chức đang hoạt động/tổng người dùng, không tính
Super Admin vào tổng người dùng).

**Frontend**: Super Admin có 1 khu vực HOÀN TOÀN RIÊNG (`/platform-admin`, `PlatformAdminPage.tsx`)
— KHÔNG dùng `AppShell`/`Sidebar`/`Topbar` hiện có (những thành phần đó giả định người dùng thuộc 1
tổ chức nghiệp vụ thật, vô nghĩa với Super Admin). `ProtectedRoute.tsx` bổ sung prop
`requireSuperAdmin` VÀ tự động điều hướng 2 CHIỀU: Super Admin cố vào bất kỳ trang nào khác đều bị
đẩy về `/platform-admin` (tránh họ thấy 1 dashboard trống trơn của tổ chức "hệ thống"), người dùng
thường cố vào `/platform-admin` bị đẩy về `/dashboard`. `useLogin()` kiểm tra `data.user.isSuperAdmin`
để điều hướng đúng ngay sau đăng nhập. Thêm 1 thẻ tài khoản demo thứ 4 (Super Admin) vào widget có
sẵn trên `LoginPage.tsx`, khớp đúng giá trị mặc định của `SUPER_ADMIN_EMAIL`/`PASSWORD` trong
`infra/.env.example` — demo được ngay không cần biết thông tin đăng nhập ẩn.

**Xác minh**: `platform-admin.service.spec.ts` (8 test), `super-admin-bootstrap.service.spec.ts`
(4 test, gồm cả trường hợp tính năng tắt + idempotent), `super-admin.guard.spec.ts` (4 test),
bổ sung test cho `InternalAuthGuard`/`inject-auth-headers.ts` (header `x-is-super-admin` cả 2
chiều true/false), bổ sung 1 test `login()` cho nhánh tổ chức bị khoá. `iam-service`: 13 suite/77
test pass. Gate cuối cùng (chạy CHUNG với đợt merge ở mục ngay trên, cùng 1 lượt xác minh):
typecheck/lint/lint:i18n-strings/test/test:coverage toàn bộ 12 workspace sạch, `build -w apps/web`
production thành công (chunk `PlatformAdminPage` được tách riêng đúng theo `React.lazy()`).

**Giới hạn đã biết (ghi nhận, không phải thiếu sót)**: Super Admin CHỈ quản lý được vòng đời tổ
chức (xem/khoá/mở khoá), KHÔNG xem được danh sách người dùng bên trong từng tổ chức (chỉ có số
đếm) — quyết định có chủ đích để không phải đụng tới logic lọc theo tổ chức sẵn có của
`UsersService`, giữ đúng bất biến "không xem xuyên dữ liệu nghiệp vụ". Có thể mở rộng sau nếu cần.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 16/09/2026 (phần "merge nhánh
frontend lần 3 + Super Admin").*

---

## 16/09/2026 (bổ sung lần 3) — Container Docker cũ 3 tuần + lỗi mojibake tên file + thay dữ liệu E2E bằng dữ liệu CRM thật

Người dùng báo cáo không thấy các thay đổi vừa merge/Super Admin ở đâu cả, kèm 1 ảnh chụp tên file
tải lên bị lỗi hiển thị kiểu `Biá»u máº«u...`. Rà soát trực tiếp `.git` (không có git CLI trong
sandbox, đọc thẳng object) xác nhận mã nguồn đã đúng, đủ — nguyên nhân thật: **toàn bộ 9 container
ứng dụng đang chạy image build từ 24/08/2026**, cũ hơn 3 tuần so với đợt merge/Super Admin vừa xong.
Rebuild + `up -d` lại cả 9 service phát hiện thêm 1 lỗi thật tiềm ẩn: `notification-service` (image
cũ) dùng quy ước `MONGO_URI` ghép sẵn, trong khi `docker-compose.yml` (đã cập nhật từ 26/08) chỉ còn
truyền 5 biến `MONGO_HOST/PORT/...` — image cũ không đọc được, rơi về `localhost` mặc định, service
CRASH lúc khởi động lại; tự khỏi sau khi rebuild với code hiện tại.

**Lỗi mojibake**: Busboy (thư viện Multer dùng bên trong `FileInterceptor`) mặc định giải mã tham số
`filename` của header multipart theo Latin-1 (quy ước cũ RFC 2388), trong khi trình duyệt hiện đại
gửi thẳng byte UTF-8 không kèm khai báo charset — 1 tên file tiếng Việt có dấu bị hiểu nhầm byte.
Thêm `decodeMulterFilename()` (`apps/document-service/src/files/utils/decode-multer-filename.util.ts`)
chạy TRƯỚC `sanitizeFileName()` ở cả `upload()`/`uploadNewVersion()` — có 1 lớp bảo vệ (giữ nguyên
chuỗi gốc nếu kết quả sau khi đổi sinh ký tự thay thế U+FFFD) để không phá hỏng 1 tên file vốn đã
đúng. Chỉ ảnh hưởng tải file mới — dữ liệu cũ đã lưu sai không tự sửa lại.

**Thay dữ liệu**: xoá 22 dự án + 12 khách hàng + cascade con do Playwright e2e sinh ra (đã xác nhận
cô lập hoàn toàn trong tổ chức demo, không giao thoa dữ liệu thật), qua API thật (không SQL thô, giữ
đúng cascade/outbox); 13 tài khoản e2e giả hoá ra đã tự bị vô hiệu hoá sẵn (tự dọn dẹp của chính bộ
test). Thêm 12 khách hàng + 24 deal CRM **thật, có tên công ty/ngành nghề Việt Nam đa dạng** (không
phải placeholder) — lý do: người dùng cần dữ liệu "chân thực" khi demo tính năng AI Insight (rà soát
lại phát hiện tính năng này thực chất dùng **Gemini + Groq**, không phải Grok/xAI như người dùng
tưởng — không có tích hợp xAI nào trong dự án; chỉ phân tích số liệu tổng hợp task/dự án từ
TimescaleDB, không đọc dữ liệu CRM, nhưng xoá bớt 22 dự án rác vẫn giúp "top 5 dự án" trong prompt AI
sạch hơn). Đồng thời vá dấu tiếng Việt còn thiếu (phòng ban, tên 5 dự án thật, tên 8 nhân viên) sót
lại từ trước khi Tiến sửa dấu ở nhánh `frontend`. `scripts/seed.js` được cập nhật cùng lúc (mảng
`CUSTOMERS`/`DEAL_TEMPLATES` mới + dấu tiếng Việt) để lần seed sau (nếu DB bị reset) vẫn ra dữ liệu
phong phú, không cần lặp lại thao tác thủ công này.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 16/09/2026 (phần cuối, sau mục
Super Admin).*

## 17/09/2026 — Phân quyền 3 cấp Org Admin/Admin/Employee + 15 nhân viên mới + lịch sử làm việc thật

Người dùng đưa ra 7 yêu cầu 1 lúc; mục 6 (nhắn tin nội bộ) và mục 7 (ý tưởng tăng tính thuyết phục
đồ án) là tư vấn — trả lời bằng lời, không code đợt này (xem trao đổi trực tiếp). 5 mục còn lại:

**Phát hiện kiến trúc quan trọng nhất**: vai trò "admin" người dùng mô tả ("thấy/thao tác mọi thứ
trừ phần thuộc Org Admin") khớp gần như tuyệt đối với `DEFAULT_ROLE_PERMISSIONS.MANAGER` sẵn có
(`packages/common-dto`) — không cần vai trò mới. Vấn đề thật: gate khu vực "Quản trị" (`hasAdminRole()`,
`apps/web/src/lib/utils.ts`) so khớp theo TÊN vai trò bằng regex thay vì theo QUYỀN, nên "Manager"
(dù đã có `USER_INVITE`) bị chặn hoàn toàn — đúng loại lỗi "tên vai trò không phải quyền" đã cảnh
báo ở nhiều đợt review trước. Đổi thành `canAccessAdminArea(permissions)`, đọc quyền thật qua
`usePermissions()` (`stores/auth.store.ts`, giải mã trường `permissions[]` vốn đã có sẵn trong JWT
access token do IAM Service ký lúc đăng nhập — chỉ chưa từng được đọc ở frontend) — không cần đổi
hợp đồng backend. Từng tab trong `/admin/*` tự ẩn/hiện đúng quyền cụ thể của nó (Members/Departments
cho cả 2, Roles & Permissions/Lịch công ty/DLQ vẫn độc quyền Org Admin).

**Giới hạn hiển thị theo "được giao"**: Project/Task/Customer trước đây hiển thị toàn bộ tổ chức cho
mọi vai trò có quyền xem tương ứng, kể cả Employee. Sửa `ProjectsService`/`TasksService`/
`CustomersService` dùng lại chính quyền đã phân biệt Employee/Manager (`PROJECT_CREATE`/`TASK_DELETE`/
`CUSTOMER_CREATE` — Employee không có, Manager+ có) làm tín hiệu "xem toàn bộ hay xem giới hạn", suy
ra "thành viên dự án" qua `TaskAssignee` (join có sẵn, trước đây chỉ dùng đếm `memberCount`) — không
phát minh permission mới. Áp dụng cả cho tra cứu 1 bản ghi (không chỉ danh sách) để chặn dò UUID trực
tiếp. `Customer.ownerUserId` (đã có sẵn, trước đây chỉ gán lúc tạo, không đổi được/không hiển thị/
không dùng để giới hạn xem) nay đổi được qua `PATCH /customers/:id`, hiển thị "Phụ trách" ở
`CustomerDetailPage.tsx`. `Department` thêm cột thật `managerId` (mirror `Project.leadUserId`), thay
cho suy đoán sai trước đây ở `DepartmentsPage.tsx` (quét tên vai trò chứa "lead/manager/admin", có
thể nhận nhầm 1 Org Admin không thuộc phòng ban).

**Lỗi thật phát hiện qua thực thi** (không phải suy luận): `PATCH /users/:id` (sửa vai trò/phòng ban
1 nhân viên) crash 500 với MỌI user — `User.roles` là quan hệ `eager: true`, kết hợp
`lock: 'pessimistic_write'` sinh lỗi Postgres "FOR UPDATE cannot be applied to the nullable side of
an outer join". Sửa bằng `loadEagerRelations: false` cho đúng truy vấn này (an toàn vì logic không
bao giờ đọc `roles` cũ, chỉ ghi đè toàn bộ khi có `roleIds` mới). Riêng phía frontend: import
`PERMISSIONS` từ `@app/common-dto` (lần đầu `apps/web` thực sự dùng gói này) kéo theo
`class-transformer`'s `@Type()` gọi `Reflect.getMetadata` không có polyfill trên trình duyệt — sửa
bằng import sâu vào đúng file enum (`@app/common-dto/dist/enums/permission.enum`) dạng namespace
import (Rollup không nhận diện được named export từ deep-import CJS); `apps/web/Dockerfile` phải bổ
sung bước tự build `packages/common-dto` (trước đây chưa từng cần vì `apps/web` chưa từng import gói
này — `dist/` nằm trong `.dockerignore`).

**15 nhân viên mới (8 → 23) + lịch sử làm việc thật**: mời qua API thật, tên tiếng Việt đầy đủ dấu,
4 người trong 8 nhân viên "sáng lập" được thăng vai trò Manager kiêm trưởng phòng (trước đó KHÔNG ai
trong tổ chức mang vai trò Manager — tính năng phân quyền vừa xong không có gì để kiểm chứng nếu
không sửa luôn). Lịch sử chấm công 6 tuần (chỉ ngày làm việc, rải trễ/vắng để chân thực) buộc phải
chèn thẳng vào `hrm_db` — API check-in luôn dùng thời điểm request thật (ảnh chụp), không có cách
hợp lệ lùi ngày, giống lý do `seedHistoricalAnalyticsData()` (`scripts/seed.js`) đã bơm thẳng vào
TimescaleDB. Đơn nghỉ phép tạo qua API thật nhưng phát hiện luật nghiệp vụ chặn ngày bắt đầu trong
quá khứ (`LEAVE_START_DATE_IN_PAST`) — chỉ tạo được đơn cho tương lai, khớp đúng thực tế "xin nghỉ
phải xin trước". 12 khách hàng CRM (đợt trước đều do Org Admin sở hữu) được gán lại cho đội Kinh
doanh để tính năng "khách hàng được giao" có dữ liệu chứng minh. Dọn nốt dữ liệu e2e còn sót trong
Leave Requests (18 đơn, toàn bộ do tài khoản Org Admin tạo khi chạy e2e)/Documents (1 thư mục + 13
ảnh test) qua API thật, riêng leave-requests không có endpoint xoá nên xoá trực tiếp theo đúng danh
sách ID đã xác minh cô lập.

**Xác minh**: gate `typecheck/lint/lint:i18n-strings/test` sạch toàn 12 workspace ở MỌI bước (backend
3 service song song, frontend 2 mảng song song, rồi gộp lại xác minh lần cuối). Kiểm thử sống qua
API thật (không chỉ đọc code) bằng tài khoản Employee/Manager/Org Admin thật: Employee chỉ thấy đúng
1/5 dự án được giao + đúng số khách hàng sở hữu, bị chặn 403 khi gọi API quản trị; Manager thấy đủ cả
5 dự án (không đổi) nhưng vẫn bị chặn `ROLE_MANAGE`/`DEPARTMENT_MANAGE`, mời thành viên được. Rebuild
+ redeploy `iam-service`/`project-task-service`/`crm-service`/`web`.

*Chi tiết: xem lịch sử làm việc giữa sinh viên và trợ lý AI ngày 17/09/2026.*

## 24/09/2026 — Nhập Excel hàng loạt + Analytics nâng cao (Diagnostic drill-down, Anomaly Detection, Recommendation Engine)

Hai hạng mục độc lập triển khai cùng đợt: (1) tính năng "quick add employees" — nhập hàng loạt qua
Excel cho trang Quản trị > Thành viên; (2) nâng cấp trang Báo cáo & Phân tích thêm 3 tầng phân tích
mới trên nền tảng "Nhận xét AI" đã có (kiến trúc AI/dữ liệu 5 tầng — mô tả/chẩn đoán/bất
thường/dự đoán/khuyến nghị — đã bắt đầu triển khai thêm 3 tầng, 2 tầng dự đoán/mô phỏng còn lại cố ý
chưa làm).

**Nhập Excel hàng loạt**: không đổi backend — tái dùng nguyên vẹn `POST /users/invite` đã có, modal
mới `ImportEmployeesModal.tsx` gọi tuần tự (không `Promise.all`, tránh vượt rate-limit Gateway) từng
dòng hợp lệ sau khi xem trước (phân biệt rõ dòng hợp lệ/lỗi kèm lý do). Thư viện đọc Excel `xlsx`
(SheetJS) bản npm registry có 2 lỗ hổng HIGH chưa vá (Prototype Pollution, ReDoS, "No fix
available") — chuyển sang cài bản đã vá trực tiếp từ CDN của chính SheetJS thay vì bản registry.

**Layer 2 Diagnostic — drill-down**: `fact_task_events` (TimescaleDB) bổ sung cột `due_date` (chỉ có
giá trị ở event tạo task, phản ánh hạn hoàn thành TẠI THỜI ĐIỂM TẠO — chưa đồng bộ nếu đổi hạn sau
đó qua `PATCH /tasks/:id`, ghi rõ như giới hạn đã biết). `AnalyticsService.getDrillDown()` tái dùng
đúng pattern CTE của `computeSummary()`, tính thêm số công việc quá hạn và người đang tập trung nhiều
việc chưa xong nhất — bấm vào 1 thanh trong biểu đồ so sánh của "Nhận xét AI" (đã thiết kế lại thành
thẻ có cấu trúc từ 22/09) sẽ mở panel hiển thị kết quả này. Phạm vi drill-down theo dự án cố ý giới
hạn chỉ Org Admin — Analytics Service không có bảng thành viên dự án riêng (database-per-service) nên
không xác định được Manager có thuộc dự án đó hay không mà không phá vỡ quy ước Kafka-only.

**Layer 3 Anomaly Detection**: service Python/FastAPI đầu tiên của dự án (`apps/ml-service`, Postgres
riêng `postgres-ml`) — tự xây read-model qua Kafka (3 topic có sẵn `iam.events`/`project-task.events`/
`hrm.events`, KHÔNG đọc DB service khác), chạy `IsolationForest` (scikit-learn) thật khi người dùng
bấm "Chạy phát hiện bất thường" trên trang Báo cáo & Phân tích, tính theo từng nhân viên tỷ lệ hoàn
thành/số việc quá hạn/tỷ lệ chấm công (xấp xỉ, không loại trừ cuối tuần vì chưa có dữ liệu Lịch công
ty riêng). Permission mới `ml:view` cấp cho Org Admin + Manager (Manager chỉ xem được nhân viên thuộc
phòng ban mình phụ trách). 2 lỗi thật phát hiện khi viết `pytest` (lần đầu có trong repo, cả unit lẫn
tích hợp chạy trên `postgres-ml` thật): thiếu ép kiểu `::uuid[]` tường minh khi bind 1 mảng Python vào
mệnh đề `ANY()` của Postgres (psycopg2 suy luận sai kiểu phần tử, lỗi thật lúc chạy chứ không phải lúc
viết code); và phát hiện quan trọng hơn — `contamination='auto'` mặc định của `IsolationForest` (một
ngưỡng CỐ ĐỊNH trên điểm bất thường, không phải "chọn top N%") khi xác minh bằng dữ liệu nhiễu gaussian
thuần (không có bất thường thật nào) lại gắn cờ tới 25-44% nhân viên — quá ồn ào cho 1 tính năng "làm
nổi bật vài trường hợp đáng chú ý"; đổi sang tỷ lệ cố định 10% cho kết quả dự đoán được.

**Layer 5 Recommendation Engine**: mở rộng nguyên vẹn pipeline "Nhận xét AI" có sẵn (không xây lại) —
thêm 1 route mới `POST /analytics/ai-insights` (route `GET` cũ giữ nguyên 100%, không đổi hành vi/cache)
nhận kèm kết quả Anomaly Detection (frontend tự gọi `POST /ml/anomalies` trước, rồi truyền kết quả vào
đây — Analytics Service không tự gọi HTTP sang ml-service) để AI đề xuất thêm "Kế hoạch hành động"
(hành động/mức ưu tiên/lý do/tác động kỳ vọng/công sức ước tính) cho các insight có liên hệ hợp lý. Cố
ý bỏ danh tính nhân viên (`userId`) khỏi dữ liệu gửi cho AI — chỉ gửi bối cảnh tổng quan (bao nhiêu
trường hợp, lệch chỉ số gì), giữ đúng nguyên tắc AI không tiếp xúc dữ liệu cá nhân chi tiết ngoài mức
cần thiết.

**Giới hạn đã biết cần thao tác thủ công**: tổ chức demo được tạo trước khi permission `ml:view` tồn
tại nên vai trò Org Admin của tổ chức đó không tự có quyền này — khác các lần bổ sung permission trước
(CRM-lite/HRM-lite), lần này KHÔNG cấp được qua `PATCH /roles/:id/permissions` như thường lệ vì 1 guard
bảo mật bổ sung sau đó (chặn tự nâng quyền, so sánh theo tên vai trò) chặn chính người đang giữ vai trò
Org Admin tự sửa quyền của vai trò đó — kể cả tạo thêm 1 tài khoản Org Admin khác cũng không giúp được
gì vì vẫn cùng 1 vai trò, cùng bị chặn, và tổ chức demo không có endpoint tạo vai trò mới. Việc cấp
quyền qua database trực tiếp bị từ chối thực hiện (đúng đắn) vì đây chính là hành vi guard đó cố tình
ngăn chặn — Org Admin của tổ chức demo cần tự bật quyền qua trang Vai trò & Phân quyền (thao tác 1
lần, ~10 giây); quyền Manager đã cấp và xác minh sống thành công.

**Xác minh**: gate `typecheck/lint/lint:i18n-strings` sạch toàn workspace, `npm run test` (root) 11/11
test suite Node pass không hồi quy, `pytest` mới cho `ml-service` 18/18 pass (chạy trong container,
kết nối `postgres-ml` thật). Rebuild + redeploy toàn bộ service liên quan (`analytics-service`/
`project-task-service`/`gateway`/`iam-service`/`web`/`ml-service` mới/`postgres-ml` mới) — tất cả
container healthy. Kiểm thử sống qua Gateway thật (không chỉ đọc code): nhập 1 file Excel mẫu → xem
trước đúng số dòng hợp lệ/lỗi → nhập thành công, nhân viên mới xuất hiện thật trong danh sách; tạo
"Nhận xét AI" thật (gọi Gemini thật) → bấm vào 1 thanh biểu đồ → panel drill-down hiện đúng số liệu
thật; gọi phát hiện bất thường với dữ liệu demo thật trả về đúng cấu trúc, không lỗi/timeout; gọi kèm
1 trường hợp bất thường tự tạo trả về đúng hợp đồng "Kế hoạch hành động"; tài khoản Employee bị từ
chối rõ ràng (403) khi gọi phát hiện bất thường thay vì bị hiểu nhầm thành "quét xong, không thấy gì".

*Chi tiết: Technical_Spec.md §19.*

## 25/09/2026 — Khắc phục sau phản hồi trực tiếp trên hệ thống thật (dữ liệu rác E2E + không thấy tính năng Anomaly Detection)

Sau đợt 24/09, người dùng xem trực tiếp tổ chức demo và phản hồi 2 vấn đề: (1) vẫn thấy dữ liệu rác
kiểu "Thanh viên E2E ...", "NV Excel ..." trong Quản trị > Thành viên, Chấm công, và cả dòng "Hoạt
động gần đây" trông như chính tài khoản Admin bị vô hiệu hoá; (2) hoàn toàn không thấy tính năng
Anomaly Detection/Recommendation Engine ở đâu trên giao diện, dù đã báo cáo là hoàn tất ở đợt trước.
Điều tra ra 4 nguyên nhân độc lập, không cái nào là "code chưa build" như nghi ngờ ban đầu.

**Đọc ngược nghĩa "Hoạt động gần đây"**: `RecentActivityFeed.tsx` luôn hiển thị tên theo `actorId`
(người THỰC HIỆN hành động) cho MỌI loại sự kiện, nhưng 4/29 khoá dịch trong `dashboard.json`
(`iam_user_deactivated`/`task_assigned`/`leave_request_approved`/`leave_request_rejected`) lại được
viết ở thể bị động ("đã bị vô hiệu hoá tài khoản", "đã được giao một công việc"...) thay vì chủ động
như 25 khoá còn lại. Kết quả: khi Admin vô hiệu hoá 1 tài khoản test rác, dòng hoạt động hiển thị y
hệt như chính Admin bị vô hiệu hoá — khiến người dùng tưởng nhầm tài khoản của mình gặp sự cố. Sửa cả
4 khoá sang thể chủ động ở cả 3 ngôn ngữ (vi/en/ja), không đổi field backend nào.

**Gốc rễ dữ liệu rác — E2E chạy thẳng vào tổ chức demo**: `e2e/tests/helpers.ts` đăng nhập bằng CHÍNH
tài khoản Org Admin demo (`admin@demo-sme.vn`) cho MỌI lần chạy Playwright — README cũ từng mô tả đây
là "giới hạn cố ý chấp nhận được" (dữ liệu tích luỹ dần, không dọn dẹp), nhưng thực tế dữ liệu đó ghi
thẳng vào tổ chức người dùng đang xem/trình bày làm đồ án, không phải 1 tổ chức test tách biệt — sau
rất nhiều lần chạy trong 1 phiên làm việc dài, tổ chức demo có hơn một nửa số nhân viên là rác. Fix
triệt để: `scripts/seed.js` đọc `SEED_ORG_NAME`/`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` từ biến môi
trường (mặc định giữ nguyên hành vi cũ); `scripts/seed-e2e.js` (mới) seed 1 tổ chức "E2E Test Org"
hoàn toàn tách biệt bằng cách spawn `seed.js` với 3 biến trên đã ghi đè (dùng spawn thay vì đặt biến
môi trường ngay trong `package.json` để tránh khác cú pháp giữa PowerShell/bash, không cần thêm
dependency); `e2e/tests/helpers.ts` đổi sang tài khoản của tổ chức này. Xác minh: chạy `auth.spec.ts` +
`analytics.spec.ts` (bao gồm luồng bấm-vào-biểu-đồ-mở-drill-down) — cả 6 test pass trên tổ chức mới,
không hồi quy hành vi test.

**Không có lối thoát cấp quyền `ml:view` — nguyên nhân thật khiến Anomaly Detection "biến mất"**: đợt
24/09 từng ghi nhận đây là giới hạn cần "Org Admin tự bật quyền qua UI, ~10 giây". Khi thực sự thử,
phát hiện điều đó SAI — guard chặn tự nâng quyền (thêm 22/09, so sánh theo TÊN vai trò) chặn đúng như
mô tả, và tổ chức demo chỉ có 1 Org Admin, không có cách nào lách qua bằng UI (tạo thêm tài khoản Org
Admin thứ 2 vẫn cùng vai trò, vẫn bị chặn y hệt). `AnomalySection.tsx` ẩn hẳn (`return null`) khi thiếu
`ml:view` — nên với tài khoản Org Admin demo, toàn bộ khối "Phát hiện bất thường" và "Kế hoạch hành
động" đi kèm chưa bao giờ hiển thị trên giao diện, đúng như người dùng phản ánh. Giải pháp: tận dụng
tài khoản Super Admin có sẵn (`superadmin@ecap-platform.local`, bootstrap tự động lúc iam-service khởi
động, KHÔNG giữ vai trò nào trong bất kỳ tổ chức nghiệp vụ nào) — thêm route mới
`PATCH /platform-admin/organizations/:id/roles/:roleId/permissions` (`@RequireSuperAdmin()`), gọi lại
NGUYÊN VẸN `RolesService.updateRolePermissions()` với `callerRoleNames=[]` (đúng bản chất thật của Super
Admin, không phải giá trị giả để lách guard) — vì Super Admin không giữ vai trò nào để so khớp, guard tự
nâng quyền tự nhiên không kích hoạt, không cần nhân bản hay bỏ qua logic đã có. Đã dùng route này cấp
`ml:view` cho Org Admin của tổ chức demo thành công, xác minh qua gọi API thật.

**`User` là entity duy nhất chưa có API xoá cứng**: `Quan tri > Thanh vien`/`Cham cong` đọc danh sách
người dùng trực tiếp, không lọc `isActive` — 17 tài khoản rác dù đã vô hiệu hoá vẫn hiển thị vĩnh viễn,
khác Customer/Deal/Task/Project/Document đều đã hỗ trợ xoá cứng từ trước. Bổ sung `DELETE /users/:id`
(`UsersService.remove()`) — CHỈ cho phép khi tài khoản đã bị vô hiệu hoá trước (rào an toàn tầng
service cho 1 thao tác không thể hoàn tác). Trước khi viết, xác minh trực tiếp trên schema Postgres
đang chạy: `refresh_tokens`/`password_reset_tokens`/`user_roles` đều có `ON DELETE CASCADE` theo
`user_id` nên xoá an toàn, không vướng ràng buộc khoá ngoại. Các service khác (hrm/document/
project-task/analytics/ml-service) không giữ bản sao `User` nào (chỉ lưu `userId` dạng UUID thô, đúng
database-per-service) nên xoá ở iam-service không làm gãy dữ liệu service khác — các màn hình đó đơn
giản không resolve được tên nữa thay vì hiện tên rác. Frontend: `MembersPage.tsx` thêm mục "Xoá vĩnh
viễn" (chỉ hiện khi tài khoản đã vô hiệu hoá) kèm `ConfirmDialog` riêng cảnh báo rõ không thể hoàn tác,
khác nút "Vô hiệu hoá" hiện có.

**Tham khảo `Data/Models`/`Data samples`** (thư mục ngoài repo chứa mã nguồn LightGBM/neuralforecast/
SDV và 3 bộ dữ liệu mẫu, dùng làm tham khảo khi thiết kế đặc tả gốc): bộ dữ liệu
`End-to-End-HR-Analytics-with-PostgreSQL` (1.000 nhân viên tổng hợp, tỷ lệ nghỉ việc thực tế 11.4%)
xác nhận lựa chọn `contamination=0.1` của `ml-service` (đợt 24/09) đặt ở mức hợp lý so với tỷ lệ "bất
thường/rủi ro" thường gặp trong dữ liệu HR thật — không cần điều chỉnh. Không phát sinh thay đổi kiến
trúc mới từ `Data/Models` (LightGBM/neuralforecast/SDV) — hướng "thống kê nhẹ, không dùng deep learning
cho dữ liệu demo nhỏ" đã chốt ở Tier 4 (`Upgrade.md`) vẫn là lựa chọn đúng.

**Dọn dữ liệu rác thực tế**: xoá 5 khách hàng CRM và 17 tài khoản nhân viên do E2E test tạo ra tích luỹ
trong tổ chức demo trước khi có fix cách ly ở trên (qua chính `DELETE /customers/:id`/`DELETE
/users/:id` vừa xác minh) — tổ chức demo hiện chỉ còn đúng roster nhân viên thật do `scripts/seed.js`
tạo (tên tiếng Việt thật, không phải placeholder theo timestamp).

**Xác minh**: `npx tsc --noEmit` sạch cho `iam-service`/`web`; `npm run lint`/`lint:i18n-strings` sạch
(0 lỗi, chỉ cảnh báo có từ trước không liên quan); `npm run test -w apps/iam-service` 14/14 test suite
(90/90 test) pass, bao gồm test mới cho `updateOrgRolePermissions()`. Rebuild + redeploy
`iam-service`/`web`, cả 2 container healthy. Kiểm thử sống qua API thật (không chỉ đọc code): cấp
`ml:view` qua route Super Admin mới → xác nhận vai trò Org Admin có quyền; xoá vĩnh viễn 17 tài khoản
rác → xác nhận roster còn lại đúng 17 nhân viên thật + tài khoản Admin + 1 tài khoản test riêng của
người dùng (cố ý không đụng tới).

*Chi tiết: Technical_Spec.md §19.6.*

## Lịch sử thay đổi tài liệu này

- **24/08/2026** — Khởi tạo file, gộp lại toàn bộ lịch sử rà soát/sửa lỗi từ 18/07/2026 (khởi tạo
  `Technical_Spec.md`) tới đợt rà soát cùng ngày — nguồn dữ liệu là mục "Lịch sử thay đổi tài
  liệu" của `Technical_Spec.md` và `ECAP_Mobile.md`, cô đọng lại thành 1 dòng thời gian duy nhất.
- **25/08/2026** — Bổ sung mục "Rà soát toàn dự án lần 3" (6 hướng song song, mở rộng phạm vi
  sang mọi lỗi logic thay vì chỉ lỗi treo/sập như đợt 24/08).
- **25/08/2026 (bổ sung)** — Bổ sung mục "Review bảo mật chuyên biệt" (6 hướng OWASP-style song
  song) — phát hiện 1 lỗ hổng Nghiêm trọng chưa xử lý (rate-limit Gateway có thể bị vô hiệu hoá
  qua gia mạo IP khi kết nối thẳng cổng 3000) cần việc riêng có kiểm thử sống.
- **25/08/2026 (bổ sung lần 2)** — Bổ sung mục "Merge nhánh frontend của Nguyễn Lê Tiến" — ghi
  nhận đóng góp của Tiến (sắp xếp tuỳ chỉnh danh sách Dự án) và cách giải quyết 2 xung đột merge
  với `Sidebar.tsx`/`ProjectsListPage.tsx`; lần đầu ghi nhận đủ tên 3 thành viên nhóm.
- **26/08/2026** — Bổ sung mục "Rà soát toàn dự án lần 4" — ~30 phát hiện mới (2 Nghiêm trọng),
  toàn bộ đã sửa theo yêu cầu chủ động của người dùng, gate cuối 573 test pass trên toàn workspace.
- **26/08/2026 (bổ sung)** — Bổ sung mục "5 đề xuất cải thiện sau lần rà soát 4" — triển khai toàn
  bộ 5 đề xuất (2 đợt rà soát không tìm thêm lỗi, 1 tái cấu trúc Gateway, 1 công cụ CI mới +
  23 chuỗi i18n còn sót, 1 prop dùng chung cho Modal áp dụng cho 12 modal), gate cuối vẫn 573/573.
- **27/08/2026** — Bổ sung mục "Rà soát riêng phần vừa triển khai + kiểm tra bảo mật" — tự phát
  hiện 25 key i18n sót từ trước (dashboard/projects), 1 hướng bảo mật riêng (sạch, 1 ghi nhận Nhẹ),
  sửa 1 lỗi Nghiêm trọng vừa trong chính công cụ CI mới hôm qua (regex literal làm mất nội dung
  dòng), sửa lại đúng `AttendanceService.checkOut()`, gate cuối vẫn 573/573.
- **27/08/2026 (bổ sung)** — Bổ sung mục "Push GitHub thất bại" — `npm run lint` thực sự có 5 lỗi
  (không chỉ warning) do 2 đợt sửa gần đây chưa từng chạy lint làm gate xác minh, chỉ chạy
  typecheck+test. Đã sửa cả 3 nguồn lỗi, cập nhật quy trình: gate cuối từ nay luôn gồm cả lint.
- **29/08/2026** — Bổ sung mục "Unit test thất bại sau khi lint đã sạch" — hoá ra không phải test
  hỏng mà là `coverageThreshold.branches` của `notification-service` tụt dưới ngưỡng (55%, thực đo
  49.57%); lấp bằng 14 test mới cho 3 khoảng trống coverage có sẵn (2 từ trước, 1 từ đợt CRASH-
  recovery 26/08), không đổi code sản phẩm nào.
- **29/08/2026 (bổ sung)** — Bổ sung mục "Merge nhánh frontend của Tiến (lần 2)" — 7 file conflict
  Git thật + 5 hồi quy ngữ nghĩa "im lặng" không có dấu conflict (2 lỗi cùng lớp MAJOR Fix 3 26/08
  tái xuất hiện ở `ProjectCard.tsx`/`ProjectDetailPage.tsx`/`EditProjectModal.tsx`, 1 lỗi cú pháp
  JSX do merge tự lặp đôi nội dung, 4 chuỗi tiếng Việt hardcode mới, 1 lỗi type `DateRangeOption`
  lệch giữa 2 nhánh) — bài học: chỉ tìm dấu conflict là không đủ, phải chạy đủ lint+typecheck+test.
- **15/09/2026** — Bổ sung mục "Rà soát lại sau khoảng nghỉ 2 tuần" — quay lại dự án phát hiện 1 đợt
  code mới của Tiến (thuần frontend, merge sạch không conflict) chưa từng qua `lint:i18n-strings`:
  102 chuỗi tiếng Việt hardcode trên 16 file, dịch toàn bộ bằng 3 agent song song; 5 lỗi thật phát
  hiện qua chính quá trình đọc để dịch (deal đã chốt vẫn tô đỏ "sắp quá hạn", Dashboard cứng
  `limit: 100` cho danh sách dự án + khối tính KPI phía client hoàn toàn không có chú thích, chọn tệp
  hàng loạt không reset khi đổi thư mục, kéo-thả nhiều tệp âm thầm mất hết trừ tệp đầu, badge chấm
  công tính giờ theo timezone trình duyệt thay vì GMT+7 — lỗi cuối tái diễn đúng lớp lỗi đã sửa toàn
  dự án 22/07/2026), toàn bộ đã sửa. Gate cuối sạch, không hồi quy so với 29/08.
- **15/09/2026 (phản hồi GVHD)** — Bổ sung mục "4 góp ý của giảng viên hướng dẫn" — sửa lỗi thật
  (dead prop `minDate` ở `DatePicker.tsx` khiến "Nghỉ phép" chọn được ngày quá khứ, vá cả frontend
  lẫn backend); làm rõ tài liệu RBAC (không phải lỗi code — chỉ 3/4 vai trò trong bảng gốc đã lập
  trình, "Super Admin" chưa từng triển khai); 2 tính năng mới hoàn toàn (Lịch công ty cho Org Admin —
  `hrm-service`, permission `calendar:manage` riêng; "Quên mật khẩu" — entity `PasswordResetToken`
  mirror `RefreshToken` với secret ký riêng, `EmailService`/`nodemailer` + service `mailhog` mới
  trong Docker Compose cho demo không cần SMTP thật, thiết kế chống dò email mirror `login()`).
  Gate cuối sạch (typecheck/lint/lint:i18n-strings/test toàn 12 workspace), không hồi quy.
- **16/09/2026** — Bổ sung mục "Merge nhánh frontend của Tiến (lần 3)" — 23 file conflict Git thật
  (69 khối, `AttendancePage.tsx` riêng 23 khối) + 1 hồi quy "im lặng" (`DatePicker.tsx`, `const`
  trùng tên) + 3 phát hiện chỉ lộ ra khi chạy lại toàn bộ gate sau khi gộp xong (`NotificationBell.tsx`
  dùng sai API `Dropdown`, 1 test `notification-service` lỗi thời so với tính năng lọc-theo-tiền-tố
  đã có, 83 chuỗi tiếng Việt hardcode mới trên 10 file ngoài vùng conflict) + 1 ngưỡng coverage
  `common-dto` tụt do cấu trúc (enum chưa từng có test). Dùng 4+4 agent song song (giải quyết
  conflict theo khu vực, rồi dịch/gắn i18n-lint-ignore theo khu vực). Gate cuối sạch toàn bộ.
- **16/09/2026 (bổ sung)** — Bổ sung mục "Tính năng mới: Super Admin" — vai trò quản trị nền tảng
  đầu tiên nhìn xuyên được nhiều tổ chức, phạm vi cố ý giới hạn ở quản lý vòng đời `Organization`
  trong `iam-service` (không đụng dữ liệu nghiệp vụ 6 service còn lại). Cột mới `User.isSuperAdmin`/
  `Organization.{isActive,isSystem}`, guard/decorator mới `SuperAdminGuard`/`@RequireSuperAdmin()`,
  bootstrap tự động qua biến môi trường (không có luồng đăng ký qua API), khu vực frontend riêng
  `/platform-admin` tách biệt hoàn toàn AppShell hiện có.
- **16/09/2026 (bổ sung lần 3)** — Bổ sung mục "Container Docker cũ 3 tuần + lỗi mojibake tên file +
  thay dữ liệu E2E bằng dữ liệu CRM thật" — nguyên nhân "không thấy thay đổi" là container 3 tuần
  tuổi (không phải lỗi merge), phát hiện thêm 1 lỗi thật khi rebuild (`notification-service` dùng
  quy ước Mongo URI cũ); sửa lỗi mojibake tên file tải lên (Busboy giải mã Latin-1 nhầm UTF-8); thay
  34 bản ghi CRM/dự án rác do e2e sinh ra bằng 12 khách hàng + 24 deal thật.
- **17/09/2026** — Bổ sung mục "Phân quyền 3 cấp Org Admin/Admin/Employee + 15 nhân viên mới" —
  "admin" hoá ra chính là vai trò Manager sẵn có, chỉ cần sửa gate theo quyền thay vì theo tên vai
  trò; giới hạn Project/Task/Customer theo "được giao" cho Employee; phát hiện + sửa 1 lỗi 500 thật
  ở `PATCH /users/:id` (Postgres từ chối khoá dòng qua outer join); mở rộng 8 → 23 nhân viên kèm
  lịch sử chấm công/nghỉ phép thật, kiểm thử sống bằng tài khoản thật cho cả 3 cấp vai trò.
- **24/09/2026** — Bổ sung mục "Nhập Excel hàng loạt + Analytics nâng cao" — nhập nhân viên hàng
  loạt qua Excel (tái dùng nguyên vẹn API mời thành viên có sẵn); Diagnostic drill-down (cột
  `due_date` mới cho `fact_task_events`, panel phễu Tổng → Chưa xong → Quá hạn → Tập trung ở 1
  người); Anomaly Detection — service Python/FastAPI đầu tiên của dự án (`apps/ml-service`,
  scikit-learn `IsolationForest` thật, phát hiện + sửa 2 lỗi thật qua viết `pytest` lần đầu trong
  repo); Recommendation Engine mở rộng "Nhận xét AI" có sẵn thêm "Kế hoạch hành động". Ghi nhận 1
  giới hạn cần Org Admin tổ chức demo tự thao tác thủ công 1 lần (bật quyền mới cho chính vai trò
  mình đang giữ — bị 1 guard chống tự-nâng-quyền chặn cấp qua API như thường lệ).
- **25/09/2026** — Bổ sung mục "Khắc phục sau phản hồi trực tiếp trên hệ thống thật" — 4 nguyên nhân
  độc lập đứng sau 2 phản hồi của người dùng (dữ liệu rác E2E vẫn thấy, không thấy tính năng Anomaly
  Detection): 4 khoá dịch "Hoạt động gần đây" viết ngược thể (chủ động/bị động); E2E test tách sang
  1 tổ chức riêng thay vì chạy thẳng vào tổ chức demo; endpoint Super Admin mới giải quyết triệt để
  giới hạn "không tự cấp được `ml:view`" ghi nhận ngày 24/09 (hoá ra không tự làm được qua UI như
  từng nghĩ); `DELETE /users/:id` mới (chỉ tài khoản đã vô hiệu hoá) — entity `User` cuối cùng có
  API xoá cứng. Đã dọn 5 khách hàng + 17 tài khoản rác thực tế trong tổ chức demo.

## 28/09/2026 — Chuẩn hoá văn phong trình bày toàn bộ tài liệu dự án

Tự rà soát và chuẩn hoá lại cách trình bày (không đổi nội dung nghiệp vụ nào) của toàn bộ `Doc/*.md`
(trừ `Analytics_Upgrade.md` và `ClaudeRule.md`, theo đúng quy ước 2 file này không thuộc phạm vi
chỉnh sửa tự động): thống nhất mọi ngày tháng về định dạng dd/mm/yyyy (bao gồm 44 tiêu đề mục của
chính file này, trước đó ở dạng yyyy-mm-dd), thêm khối trạng thái ngay dưới tiêu đề H1 của mỗi tài
liệu còn lại, chuẩn hoá cách trích dẫn mục bằng ký hiệu `§` thay cho chữ "mục N" rời rạc trước đây,
và soát lại một số đoạn cảnh báo/ghi chú cho rõ ràng hơn bằng blockquote. Không xoá, rút gọn hay đổi
bất kỳ sự kiện/quyết định lịch sử nào — đây thuần tuý là một đợt định dạng lại.

## 28/09/2026 (tiếp — Nhắn tin nội bộ)

Triển khai tính năng nhắn tin nội bộ 1:1 + nhóm/kênh giữa thành viên cùng tổ chức — mục còn treo
lại từ 17/09/2026 (khi đó là 1 trong 7 yêu cầu cùng lúc, riêng mục này chỉ tư vấn bằng lời, chưa
đặc tả hay lập trình gì, xem mục "17/09/2026" ở trên).

**Kiến trúc:** service mới `apps/messaging-service` (NestJS, Postgres riêng `postgres-messaging`),
mirror đúng scaffold `apps/crm-service`. 3 entity `Conversation`/`ConversationParticipant`/`Message`.
Cố ý khác mọi service khác ở 2 điểm: (1) không dùng Kafka/Outbox — không service nào khác cần tiêu
thụ sự kiện nhắn tin; (2) không xây bảng `dim_user` cục bộ — chỉ lưu `userId` thô, tên hiển thị tra
cứu phía client, rút kinh nghiệm trực tiếp từ đợt dọn dữ liệu ma `USER_DELETED` vừa xong (mục
"25/09/2026" ở trên). 6 endpoint REST (tạo hội thoại có dedup cho 1:1, danh sách kèm số chưa đọc,
lịch sử tin nhắn phân trang, gửi tin, đánh dấu đã đọc, quản lý thành viên nhóm) cộng 1 endpoint thu
hồi tin nhắn bổ sung ngoài đặc tả gốc. WebSocket riêng `/ws/messaging` mirror y hệt
`notifications.gateway.ts`. 3 permission mới `message:view`/`message:send`/`message:manage_group`
(2 quyền đầu cho cả 3 vai trò, quyền thứ 3 chỉ Org Admin/Manager).

**Frontend:** cả `apps/web` (trang 2 cột hội thoại + khung chat, mục điều hướng mới có badge số tin
chưa đọc) lẫn `ecap-mobile` (tab thứ 7 "Nhắn tin" — lần đầu ứng dụng này dùng real-time
`socket_io_client` thay vì polling như mọi tính năng trước đó). Nhân tiện bổ sung 2 mục nhỏ còn
thiếu ở `ecap-mobile` theo đúng phạm vi hẹp đã thống nhất: màn hình Quên/Đặt lại mật khẩu (tái dùng
API đã có từ 15/09/2026). Kiểm tra riêng khả năng tự sửa hồ sơ cá nhân — xác nhận `apps/iam-service`
CHƯA có endpoint tự-cập-nhật-hồ-sơ nào (`PATCH /users/:id` yêu cầu quyền `user:manage`, không có
lối tắt `id === callerId`) nên **không** thêm route backend mới ngoài phạm vi, giữ nguyên màn hình
chỉ-đọc và ghi lại đây như một giới hạn đã biết.

**Xác minh sống qua Gateway thật (2 tài khoản thật, không chỉ đọc code):** tạo hội thoại 1:1 → gọi
lại lần 2 giữa đúng 2 người đó xác nhận dedup đúng (không tạo trùng) → gửi tin → người nhận thấy
đúng số chưa đọc + tin nhắn cuối → đánh dấu đã đọc → số chưa đọc về 0; tạo nhóm 3 người → gửi tin
nhóm → thành viên không phải người tạo và không giữ `message:manage_group` bị từ chối `403` khi cố
sửa danh sách thành viên.

**2 phát hiện thật khi xác minh, đã xử lý:**
- Response `GET /conversations` thiếu trường `createdBy` (cần để frontend biết ai được quản lý 1
  nhóm mà không phải gọi thêm request) — bổ sung vào `ConversationsService.findAllForUser()`.
- Permission mới không tự "vá ngược" vào vai trò của tổ chức demo đã đăng ký từ trước — đúng lớp
  giới hạn đã gặp nhiều lần (`ml:view`, CRM-lite/HRM-lite). Lần này phát hiện thêm 1 bước dễ bỏ sót:
  phải REBUILD `iam-service` (nơi seed bảng `permissions` toàn cục) trước khi
  `PATCH /roles/:id/permissions` chấp nhận key mới — chỉ rebuild service sở hữu tính năng
  (`messaging-service`) là chưa đủ. Đã cấp quyền cho cả 3 vai trò (Org Admin qua endpoint Super
  Admin, do guard chống tự-nâng-quyền).

**1 điều tra không phải lỗi hệ thống:** một số request `POST` gọi qua PowerShell
(`Invoke-RestMethod`) trong lúc kiểm thử báo nhầm "thiếu internal shared-secret" — xác nhận qua đối
chiếu trực tiếp (gọi thẳng service bỏ qua Gateway, và gọi lại bằng `curl.exe`) đây là hành vi
`Expect: 100-continue` mặc định của .NET HTTP client, không phải lỗi Gateway/service, không ảnh
hưởng trình duyệt thật hay `ecap-mobile` (Dio). Dọn sạch ngay 2 hội thoại thử nghiệm tạo ra trong
lúc kiểm thử khỏi tổ chức demo trước khi kết thúc. Gate cuối: `typecheck`/`lint`/`lint:i18n-strings`/
`test` sạch toàn workspace (`messaging-service` 43/43, `apps/web`/`ecap-mobile` không hồi quy),
`flutter analyze`/`test`/`build apk --debug` sạch. Chi tiết đầy đủ: `Doc/Technical_Spec.md` §20.

## 03/10/2026 — Tái cấu trúc điều hướng + gộp Lịch công ty + phát hiện nghỉ phép qua chat + khắc phục ERR_EMPTY_RESPONSE

6 yêu cầu lớn cùng lúc, bàn bạc kỹ trước khi code (không code ngay — đúng cách làm việc đã thống
nhất), sau đó triển khai song song bằng 6 agent độc lập cộng 1 việc nhỏ tự làm trực tiếp (Gateway).

**1. Điều hướng ("Trang chủ" gộp 3 mục):** Sidebar chính đổi hẳn sang icon-rail cố định
(`w-[68px]`), chỉ mở rộng (overlay, không đẩy nội dung) khi con trỏ chuột di vào — thay thế hoàn
toàn nút thu/phóng thủ công cũ và luôn cả logic tự thu gọn ở breakpoint tablet (nay dư thừa).
"Trang chủ" (route gốc `/dashboard`) hiện thêm 1 sidebar phụ cố định liệt kê Tổng quan/Dự án và
công việc/Tài liệu/Khách hàng khi đang ở trong nhóm route đó — các route giữ nguyên, chỉ đổi cách
trình bày điều hướng. Thứ tự mới: Trang chủ → Chấm công → Nghỉ phép → Nhắn tin → Báo cáo & Phân
tích → Quản trị.

**2. Xoá trang Thông báo riêng:** gộp hết vào dropdown chuông — hiện toàn bộ thông báo (không chỉ
chưa đọc), phân trang bằng nút "Tải thêm", bấm vào đánh dấu đã đọc + điều hướng bằng
`react-router-dom` (trước dùng `window.location.href`, gây tải lại cả trang không cần thiết) hoặc
mở rộng tại chỗ nếu không có link. Cố ý bỏ bộ lọc theo loại và nhãn phạm vi hiển thị để giữ
dropdown gọn.

**3. Lịch công ty gộp vào Nghỉ phép (60:40), đổi hẳn mô hình phân quyền:** rời khỏi Quản trị hoàn
toàn. Mô hình cũ (chỉ Org Admin CRUD) đổi thành: mọi người xem/tạo được sự kiện thường; ngày lễ
chính thức (ảnh hưởng thật tới chấm công) chỉ Org Admin/Manager tạo được; sửa/xoá dựa trên so
sánh cấp bậc snapshot lúc tạo (1=Employee/2=Manager/3=Org Admin, suy từ bộ quyền người gọi —
không so tên vai trò, đúng bài học 17/09/2026), riêng ngày lễ thì giữ quyền quản lý lịch là đủ
không cần so cấp bậc. Thêm 2 trang xem lịch sử theo từng nhân viên (chấm công + nghỉ phép) cho
Manager/Org Admin — hoá ra backend đã hỗ trợ sẵn tham số `userId` cho cả 2 endpoint liên quan từ
trước, chỉ chưa từng được gọi tới.

**4. Phát hiện nghỉ phép qua chat:** cả web lẫn `ecap-mobile` cùng triển khai 1 bộ quy tắc nhận
diện ngày/giờ tiếng Việt bằng regex thuần (ngày tuyệt đối, ngày tương đối, thứ trong tuần, mốc
tương đối, giờ/khoảng thời gian) — khớp trong tin nhắn của CHÍNH người đang đăng nhập (không bao
giờ hiện cho tin người khác, kể cả trong nhóm) thì hiện chip "Hẹn lịch nghỉ", bấm vào tạo đơn nghỉ
thật qua API sẵn có, đi đúng quy trình duyệt bình thường.

**5. Khắc phục `ERR_EMPTY_RESPONSE` sau khi chạy rảnh rỗi:** gốc rễ là Gateway/mọi service đều
dùng `keepAliveTimeout` mặc định ~5 giây của Node trong khi trình duyệt giữ kết nối lâu hơn nhiều
— sau một lúc rảnh rỗi, trình duyệt tái sử dụng 1 socket đã bị server âm thầm đóng. Khắc phục bằng
cách tắt hẳn HTTP keep-alive ở Gateway (ép `Connection: close` lên mọi response, cả route Nest
thật lẫn route proxy) thay vì cố tinh chỉnh timeout cho khớp nhau.

**Xác minh:** gate `typecheck`/`lint`/`lint:i18n-strings`/`test` sạch toàn bộ 6 nhánh gộp lại (34
test mới web, 14 test mới hrm-service, 14 test mới ecap-mobile). Rebuild + redeploy
`web`/`gateway`/`hrm-service`/`iam-service`. Kiểm thử sống qua Gateway thật: đúng ma trận phân
quyền lịch (Employee tạo EVENT được/HOLIDAY bị chặn, Manager tạo HOLIDAY được/xoá EVENT của
Employee được/bị chặn xoá HOLIDAY của người cấp cao hơn), tra cứu lịch sử nghỉ phép theo nhân
viên đúng quyền, header `Connection: close` xác nhận có trên cả route thật lẫn route proxy. Cấp
quyền `calendar:manage` cho Manager của tổ chức demo (đúng tiền lệ `ml:view`/`message:*`). Dọn
sạch toàn bộ dữ liệu thử nghiệm trước khi kết thúc. Chi tiết đầy đủ: `Doc/Technical_Spec.md` §21.

## 16/10/2026 — Danh mục sản phẩm + Kho hàng (service mới, tích hợp phân tích xu hướng thị trường)

Yêu cầu trực tiếp: hệ thống còn thiếu hẳn phần phân tích xu hướng thị trường, nên không chỉ thêm 1
danh mục sản phẩm/kho đơn lẻ mà phải gán mặt hàng cho từng khách hàng để có dữ liệu phục vụ phân
tích xu hướng về sau, cùng 1 chủ đề mặt hàng (máy tính/linh kiện laptop, PC), ảnh thật tải về nén
WebP, logic kho/danh mục phải chặt chẽ tuyệt đối, và viết tài liệu đầy đủ như mọi microservice
khác. Người dùng phê duyệt toàn bộ thay đổi cần thiết trước, không cần hỏi lại giữa chừng.

**1. Service mới `apps/inventory-service`:** mirror đúng scaffold `crm-service` (NestJS, Postgres
riêng `postgres-inventory`, `InternalAuthGuard`+`PermissionsGuard` toàn cục, Outbox+Kafka, MinIO
bucket riêng `inventory-products` cho ảnh sản phẩm). 6 entity: `ProductCategory`, `Product` (SKU
duy nhất, ảnh qua presigned URL mirror `document-service`, validator magic-byte giới hạn
`jpeg/png/webp`), `Warehouse`, `WarehouseStock` (khoá tổng hợp `warehouseId`+`productId`),
`StockMovement` (`StockMovementType` mới: `IN`/`OUT`/`ADJUSTMENT`, enum dùng chung đặt ở
`packages/common-dto`), `CustomerPurchase` (gán 1 mặt hàng cho 1 khách hàng CRM tại 1 thời điểm,
có thể gắn hoặc không gắn kho xuất).

**2. Logic kho chặt chẽ (yêu cầu cốt lõi của người dùng):** `StockService.recordMovementInTransaction()`
dùng đúng mẫu khoá bi quan + re-check-trong-transaction đã có tiền lệ ở
`DealsService.updateStage()`/`TasksService.updateStatus()`: `INSERT ... ON CONFLICT (warehouseId,
productId) DO NOTHING` để "upsert rồi khoá" 1 dòng tồn kho có thể chưa từng tồn tại (không thể
`SELECT ... FOR UPDATE` lên 1 dòng chưa có), sau đó `SELECT ... FOR UPDATE` khoá đúng dòng đó rồi
mới cộng/trừ số lượng trong cùng transaction — loại bỏ hoàn toàn race condition giữa 2 request ghi
nhận biến động đồng thời trên cùng 1 cặp kho/sản phẩm. `OUT`/`ADJUSTMENT` theo chiều giảm bị từ
chối ngay nếu số dư sau khi trừ sẽ âm (`STOCK_INSUFFICIENT`) — kiểm tra NGAY TRONG transaction sau
khi đã khoá dòng, không kiểm tra trước rồi mới khoá (tránh đúng lớp lỗi "đọc rồi mới khoá" có thể
bị vượt qua bởi request chen giữa). Xoá `Warehouse` bị chặn nếu còn bất kỳ dòng tồn kho > 0 nào
(`WAREHOUSE_HAS_STOCK`); xoá `ProductCategory` bị chặn nếu còn sản phẩm (`PRODUCT_CATEGORY_HAS_PRODUCTS`);
xoá `Product` bị chặn nếu còn lịch sử mua hàng tham chiếu (`PRODUCT_HAS_PURCHASE_HISTORY`) — cả 3
đều là lỗi nghiệp vụ 409, không phải lỗi 500 do vi phạm khoá ngoại. `CustomerPurchase` tạo mới trừ
tồn kho atomic (nếu có `warehouseId`) trong cùng transaction với việc ghi bản thân bản ghi mua
hàng; xoá mua hàng hoàn tác đúng số lượng đã trừ (cộng lại), cũng atomic.

**3. RBAC:** 8 permission mới (`product:view/manage`, `warehouse:view/manage`,
`customer_purchase:view/create/update/delete`) thêm vào `PERMISSIONS`/`DEFAULT_ROLE_PERMISSIONS`
(`packages/common-dto`) — Manager có đủ quyền quản lý (view+manage mọi thứ, CRUD mua hàng đầy
đủ), Employee chỉ xem danh mục/kho + tạo/sửa mua hàng (không xoá, không quản lý danh mục/kho) —
đúng mô hình phân quyền theo quyền hạn đã thống nhất từ 17/09/2026, không gán cứng theo tên vai
trò. Seed tự động qua cơ chế `DEFAULT_ROLE_PERMISSIONS` có sẵn, không cần sửa `RolesService`.

**4. Tích hợp phân tích xu hướng thị trường (mục đích chính của yêu cầu):** mỗi `CustomerPurchase`
tạo mới phát 1 event Kafka `customer_purchase.created` (topic mới `inventory.events`,
`KAFKA_TOPICS.INVENTORY`) qua Outbox Pattern sẵn có. `analytics-service` thêm consumer tiêu thụ
topic này, ghi vào hypertable TimescaleDB mới `fact_product_sales` (tự khởi tạo idempotent qua
`schema-bootstrap.ts` giống `fact_task_events`/`fact_document_events`/`fact_user_activity`, dùng
`ON CONFLICT (time, event_id) DO NOTHING RETURNING event_id` để chống ghi trùng khi Kafka gửi lại).
2 endpoint phân tích mới: `GET /analytics/product-sales-trend` (xu hướng doanh số theo thời gian,
chỉ hỗ trợ 7d/30d — không có mốc quý vì dữ liệu demo chưa đủ dài) và `GET /analytics/top-products`
(xếp hạng mặt hàng bán nhiều nhất, giới hạn kết quả có clamp min/max). Frontend: 2 biểu đồ mới
(`ProductSalesTrendChart`, `TopProductsChart`) thêm vào `AnalyticsPage.tsx`, và 1 khối lịch sử mua
hàng (`CustomerPurchaseHistory.tsx` + 2 modal tạo/sửa) thêm vào `CustomerDetailPage.tsx` (CRM) —
đúng yêu cầu "gán mặt hàng cho từng khách hàng để dễ phân tích xu hướng về sau".

**5. Hạ tầng:** `infra/docker-compose.yml` thêm `postgres-inventory` + `inventory-service` (port
3010) + bucket `inventory-products` vào `minio-init`; Gateway thêm `services.inventory` +
1 route proxy nhóm mới (xác nhận không trùng tiền tố với route nào khác qua `matchesPrefix()`);
Prometheus thêm scrape job. Root `package.json` thêm vào `build`/`typecheck`/`dev:inventory`.

**6. Frontend web — 2 trang mới, cố ý tái dùng layout có sẵn để KHÔNG tái diễn lỗi sidebar đè
nhau đã sửa ở §21.1:** `/products` (lưới thẻ sản phẩm, tìm kiếm debounce 300ms + lọc không dấu
tiếng Việt phía client, lọc danh mục phía server, phân trang tự clamp khi xoá/lọc vượt trang cuối
— mirror chính xác `CustomersListPage.tsx`) và `/warehouse` (2 tab: bảng tồn kho theo
kho/sản phẩm + bảng lịch sử biến động, modal "Ghi nhận biến động" cho người dùng nhập số lượng
luôn dương rồi tự tính dấu phía client trước khi gửi — `IN`→`+`, `OUT`→`-`, `ADJUSTMENT`→theo
chiều người dùng chọn riêng — chỉ là lớp tiện UI, backend vẫn là nơi thực thi quy tắc dấu thật như
mục 2). Cả 2 trang dùng đúng `AppShell`/`nav-items.ts`/`HOME_ROUTE_PREFIXES` có sẵn, không tự viết
cơ chế sidebar riêng.

**7. Ảnh sản phẩm:** 19 ảnh thật tải từ Wikimedia Commons (đều có giấy phép tái sử dụng tự do,
provenance ghi lại đầy đủ nguồn/giấy phép cho từng ảnh), chuyển sang WebP để giảm dung lượng —
tổng 944 KB cho 19 ảnh (thay vì giữ nguyên JPEG/PNG gốc). Script `scripts/seed-inventory.js` mới:
5 danh mục + 19 sản phẩm cùng 1 chủ đề máy tính/linh kiện laptop-PC (đúng yêu cầu "cho chung 1 chủ
đề"), giá VND thực tế, tải ảnh lên qua API `POST /products/:id/image` (FormData/Blob gốc của Node
20, không cần thư viện ngoài), 26 lượt mua hàng của khách hàng CRM có sẵn trải đều 30 ngày (có
trọng số ưu tiên vài SKU để biểu đồ xu hướng có hình dạng rõ rệt, ~50% lượt mua gắn kèm kho xuất
thật) — đủ dữ liệu để 2 biểu đồ xu hướng/mục mới không trống rỗng khi demo. Idempotent theo
tên/SKU, chạy lại nhiều lần không tạo trùng.

**Xác minh:** 41 test mới `inventory-service` (danh mục, sản phẩm, kho, biến động kho — bao gồm
test trực tiếp hành vi "upsert rồi khoá" + từ chối hướng giảm khi không đủ tồn, mua hàng khách
hàng), ~26 test mới/sửa `analytics-service` (151 tổng, gồm `fact_product_sales`, 2 endpoint xu
hướng/top sản phẩm, dispatch Kafka mới). Gate cuối sạch: `typecheck` toàn bộ 11 project TypeScript
(10 service + `apps/web`, kể cả service mới), `lint` 0 lỗi, `lint:i18n-strings` 0 vi phạm trên 180
file (bao gồm 3 file `inventory.json` vi/en/ja mới, 154 khoá mỗi file, xác nhận cấu trúc khớp
nhau), `docker compose config`/`docker compose config --services` xác nhận cú pháp YAML + đăng ký
service + thay biến môi trường đúng (29 service). **Giới hạn đã biết — chưa xác minh SỐNG qua
Gateway thật:** Docker Desktop không chạy được trong môi trường làm việc vào lúc hoàn thành tính
năng (`docker compose build` lỗi kết nối named pipe) — chưa rebuild/redeploy, chưa chạy
`npm run seed:inventory`, chưa kiểm thử qua trình duyệt thật (tạo danh mục/sản phẩm kèm ảnh, ghi
nhận biến động kho, tạo mua hàng có/không gắn kho, xác nhận biểu đồ xu hướng/top sản phẩm hiển thị
dữ liệu thật, xác nhận ma trận RBAC Employee/Manager đúng trên UI thật). Đây là hạn chế môi trường,
không phải lỗi mã nguồn — cần hoàn tất ngay khi Docker Desktop chạy lại được. Chi tiết đầy đủ:
`Doc/Technical_Spec.md` §22.

## 24/10/2026 — Nhận diện khuôn mặt cho Chấm công (verify 1:1, cảnh báo mềm)

Đảo ngược có chủ đích quyết định "KHÔNG nhận diện khuôn mặt" đã ghi nhận từ 05/08/2026 (§17) —
theo yêu cầu trực tiếp, bàn bạc kỹ hướng đi (verify 1:1 thay vì identify 1:N, cảnh báo mềm thay vì
chặn cứng) trước khi code. `apps/ml-service` bổ sung module nhận diện khuôn mặt dùng 2 model
pretrained có sẵn (không tự train — chỉ "huấn luyện" duy nhất là bước đăng ký 1 ảnh mẫu/người
dùng), bảng `face_enrollments` riêng, và 4 endpoint `/api/v1/ml/face/*` (dùng lại permission
`attendance:checkin`, không thêm permission mới). `hrm-service` thêm 4 cột vào `Attendance`
(điểm khớp + cờ `matched` thô/check-in và check-out), mirror đúng mô hình cờ mềm GPS on-site/
off-site đã có — server tự tính lại cờ `matched` từ ngưỡng riêng, không tin thẳng giá trị từ
client. Frontend: khối đăng ký khuôn mặt mới ở trang Hồ sơ cá nhân (bắt buộc tick đồng ý trước khi
đăng ký — dữ liệu sinh trắc học), tái dùng component camera chấm công có sẵn cho bước chụp ảnh
đăng ký, badge mới hiển thị % khớp ở mọi nơi trang Chấm công đã hiện cờ GPS.

**Lỗi thật phát hiện khi tự kiểm thử sống qua Gateway:** điểm tự-so-khớp-với-chính-mình (trường hợp
phổ biến nhất trong thực tế) trả về từ model lệch nhẹ ra ngoài khoảng `[-1, 1]` lý thuyết do sai số
làm tròn số thực dấu phẩy động (float32) — hoàn toàn bình thường về mặt toán học, nhưng bị bước
kiểm tra giá trị phía `hrm-service` từ chối thẳng bằng lỗi 400, **vô hiệu hoá hoàn toàn chức năng
check-in thật** mỗi khi khuôn mặt khớp gần như hoàn hảo — đi ngược chính thiết kế "không bao giờ
chặn chấm công" mà tính năng này đặt ra. Sửa bằng cách kẹp (clamp) giá trị lệch nhỏ về đúng biên
`[-1, 1]` thay vì từ chối, chỉ còn từ chối giá trị lệch lớn thật sự vô lý (vd gửi nhầm 50).

**Kiểm thử chéo bằng 2 agent độc lập (theo yêu cầu trực tiếp — sau khi code xong, 2 agent cùng
kiểm thử và soi lỗi lẫn nhau, rồi tổng hợp và sửa):** 1 agent hướng backend/bảo mật, 1 agent hướng
frontend/UX, chạy song song trên cùng tính năng, kết quả được đối chiếu chéo rồi tự xác minh lại
từng phát hiện trước khi sửa. Phát hiện quan trọng nhất là **1 lỗi NGHIÊM TRỌNG mà toàn bộ gate tự
động và kiểm thử sống trước đó đều KHÔNG bắt được**: `face.py` chuẩn hoá đầu vào `(x-127.5)/128`
theo README công khai của model, nhưng tự kiểm tra lại graph của CHÍNH file ONNX đã tải (qua
`onnx.load()`) cho thấy model đã TỰ chứa 2 node `Sub(127.5)` → `Mul(1/128)` ngay trước `conv0` —
nghĩa là chuẩn hoá bị áp 2 LẦN liên tiếp, nén mọi pixel gần thành 1 hằng số bất kể ảnh là gì, khiến
verify() báo "khớp" (~0.9+) với **BẤT KỲ ai** chứ không chỉ chủ nhân — tính năng mất hoàn toàn khả
năng phân biệt. Lý do mọi test trước đó pass: chỉ tự so khớp 1 khuôn mặt với chính nó (2 phía cùng
1 embedding, chuẩn hoá sai cỡ nào vẫn ra 1.0). Sửa bằng cách bỏ hẳn bước tự chuẩn hoá; xác minh
lại bằng ảnh mẫu 92 khuôn mặt thật: 2 người khác nhau cho điểm 0.02–0.22 (dưới xa ngưỡng 0.35),
tự-so-khớp vẫn ~1.0; thêm test hồi quy so 2 người khác nhau để lớp lỗi này không thể tái diễn âm
thầm. Các phát hiện khác đã sửa cùng đợt: JPEG bị cắt cụt (upload lỗi giữa đường) có thể được
`cv2.imdecode()` giải mã "thành công" trên vùng nhớ cũ còn sót (nguy cơ lẫn dữ liệu giữa các lượt
gọi) → tự kiểm tra marker SOI/EOI trước khi giải mã; không giới hạn dung lượng ảnh và không thu nhỏ
trước khi xử lý (ảnh 8000x4492 mất ~25s/lượt, RAM tăng hàng GB) → giới hạn 5MB + thu nhỏ về 640px,
đồng thời đổi 2 endpoint từ `async def` sang `def` thường để không chiếm event loop khi xử lý
ảnh/DB; frontend không có timeout riêng cho lượt verify (có thể chờ 120s theo timeout chung nhóm
`/ml/*` nếu `ml-service` treo) → thêm timeout 5s mirror `getCurrentLocationSoft()`; xoá tài khoản
vĩnh viễn không dọn `face_enrollments` (dữ liệu sinh trắc học) → bổ sung vào handler `USER_DELETED`
sẵn có; `extractErrorMessage()` dùng chung toàn `apps/web` không nhận diện dạng lỗi `{detail}` của
FastAPI nên mọi lỗi từ `ml-service` hiện chuỗi kỹ thuật tiếng Anh của axios → sửa tập trung 1 chỗ;
cùng vài lỗi UI nhỏ (checkbox đồng ý không reset sau xoá, trạng thái lỗi tải bị hiểu nhầm thành
"chưa đăng ký", alt text ảnh xem trước dùng nhầm chuỗi check-in). Ghim commit SHA + checksum SHA256
cho 2 model tải lúc build Docker (trước đó dùng nhánh `main` trôi), đúng tinh thần ghim digest đã
áp dụng 22/08/2026. **Cố ý không sửa, ghi nhận là giới hạn đã biết:** điểm khớp do client gửi lên
không có cơ chế ký chống giả mạo — cùng mức tin cậy (và cùng mức giả mạo được) như toạ độ GPS của
cờ on-site/off-site đã chấp nhận từ 13/08/2026; cân nhắc ký HMAC nhưng không làm vì không tương xứng
với bản chất "cảnh báo mềm" của tính năng.

**Xác minh cuối:** `pytest` `apps/ml-service` 36/36 pass (gồm pipeline thật với model/ảnh mẫu thật
kết nối Postgres thật, không mock model; có test phân biệt 2 người khác nhau và test ảnh cắt cụt/
trống); `jest` `apps/hrm-service` 115/115 pass (phát hiện thêm, sửa luôn 1 lỗi thật KHÔNG liên quan
tính năng này: 2 test ở `calendar-events`/`leave-requests` tính "hôm nay" bằng giờ UTC thô trong khi
logic nghiệp vụ so sánh theo giờ GMT+7, khiến test tự fail trong khung giờ 00:00–07:00 GMT+7 mỗi
ngày — sửa bằng cách dùng lại đúng hàm quy đổi GMT+7 chuẩn đã có sẵn); `vitest` `apps/web` 38/38
pass. `typecheck`/`lint`/`lint:i18n-strings`/`test`/`build` sạch toàn bộ workspace. Kiểm thử sống
qua Gateway thật (tài khoản demo thật + các tổ chức thử nghiệm riêng, tạo mới để không ảnh hưởng dữ
liệu chấm công thật của tổ chức demo trong ngày): đăng ký khuôn mặt → xem trạng thái → verify
tự-so-khớp (score ~1.0, matched=true) → verify bằng ảnh NGƯỜI KHÁC (score 0.02, matched=false) →
xoá đăng ký; ảnh cắt cụt/trống bị từ chối rõ ràng (400, không phải 500); check-in thật ghi đúng điểm
khớp vào cả 2 trường mới và vẫn thành công bình thường khi không có dữ liệu khuôn mặt nào. Chi tiết
kỹ thuật đầy đủ: `Doc/Technical_Spec.md` §24.

## 24/10/2026 (tiếp) — Giảm tải RAM Docker + Chat bot nội bộ RAG + rà soát cuối toàn hệ thống

Theo yêu cầu trực tiếp gồm 3 bước: (1) 2 agent đối chiếu trên vai trò người sử dụng và khách hàng để
tìm tính năng có thể xoá/tinh gọn nhằm giảm RAM, vì Docker Desktop tự tắt nhiều lần; (2) 1 agent lập
trình chatbot RAG, song song 2 agent kiểm thử và sửa lỗi; (3) 2 agent rà soát lần cuối toàn hệ thống,
tạo mock data dùng lại được (`Mock_data.md`), vá lỗi ngay khi phát hiện.

**Giảm tải RAM:** cả 2 agent cùng kết luận không xoá tính năng nghiệp vụ nào, chỉ tinh chỉnh hạ tầng.
Nguyên nhân gốc là máy ảo WSL2 không giới hạn RAM (đo 6,4GB) và MongoDB dùng bộ đệm mặc định ~3,3GB.
Đã áp dụng: `.wslconfig` giới hạn máy ảo 5GB, MongoDB `wiredTigerCacheSizeGB 0.25`, heap Kafka
256–384MB, `mem_limit` cho MongoDB/Kafka/ml-service, đưa Prometheus/Alertmanager/kafka-exporter/
Grafana vào profile `observability` (không chạy mặc định). Tổng RAM container còn ~1,8GB. Các phương
án đã loại và lý do: `Technical_Spec.md` §25.

**Chat bot RAG:** triển khai khác kế hoạch §23 ban đầu ở 3 điểm, đều để tiết kiệm RAM: không tạo
service mới (đặt trong `analytics-service`), không dùng `pgvector` (vector lưu dạng mảng số thực trong
`document-service`), lập chỉ mục bằng job quét định kỳ thay cho sự kiện Kafka. 5 tool tra dữ liệu
sống qua Gateway bằng JWT người hỏi (tài liệu, việc của tôi, tiến độ dự án, chấm công hôm nay, số dư
phép), giới hạn 30 câu/người/ngày theo GMT+7, nút chat nổi trên mọi trang web.

**Kiểm thử song song trong lúc lập trình:** 2 agent (phía tài liệu/RAG và phía chatbot) tìm và vá 9
lỗi, kèm unit test cho từng lỗi. Đáng chú ý nhất:
- **Lỗ hổng phân quyền có từ 28/07/2026, RAG làm lộ ra:** thư mục con thường nằm trong thư mục
  `restricted` mở cho mọi người vì mã chỉ xét thư mục trực tiếp chứa tệp — nhân viên tìm được đoạn
  "Bảng lương thưởng quý 4" qua chatbot. Nay kiểm tra quyền đi ngược lên mọi thư mục cha.
- Chia đoạn tệp 9MB chặn event loop ~38 giây (còn 0,7 giây); trích văn bản tốn +155MB RAM (còn +4MB).
- Tệp hỏng và lỗi Gemini gây vòng thử lại vô hạn; DOCX "zip bomb" có thể làm cạn RAM rồi lặp sập sau
  khởi động lại.
- Xoá hội thoại khi bot đang trả lời gây 500; 2 câu hỏi cùng lúc làm hỏng lịch sử hội thoại.
Bảng đầy đủ: `Technical_Spec.md` §23.8.

**2 lỗi cũ của "Quên mật khẩu" (có từ 15/09/2026), phát hiện khi kiểm tra cấu hình:**
`/api/v1/auth/forgot-password` và `/api/v1/auth/reset-password` chưa từng nằm trong danh sách route
công khai của Gateway, nên người chưa đăng nhập bị 401 và không bao giờ nhận được email. Đợt 15/09 chỉ
xác minh bằng unit test của iam-service và mở trang trên Vite dev server, chưa đi qua Gateway thật.
Đồng thời `JWT_RESET_SECRET` không có trong `infra/.env` (compose không có giá trị mặc định) nên khoá
ký token rỗng. Sửa cả 2, xác minh sống: yêu cầu → email trong MailHog → đặt lại → đăng nhập bằng mật
khẩu mới; dùng lại cùng link lần 2 bị từ chối 400.

**Sự cố vận hành:** máy treo và phải khởi động lại khi 3 agent cùng chạy build Docker và
`typecheck`/`test`/`build` toàn workspace. Từ đây mọi lệnh nặng dùng chung 1 khoá, `jest
--maxWorkers=2`. Ngoài ra đường chuyển tiếp IPv6 của Docker Desktop bị treo sau khi tạo lại container,
khiến `http://localhost` treo trong khi `127.0.0.1` vẫn chạy — đổi cổng gateway/web/minio sang chỉ
lắng nghe IPv4 (`0.0.0.0:<cổng>`, vẫn mở mạng LAN cho app di động).

**Rà soát cuối bằng 2 agent:** 1 agent nghiệm thu toàn hệ thống theo từng vai trò (9 kịch bản kiểm
thử sống phủ mọi module + giao diện, tạo bộ mock data), 1 agent rà soát mã nguồn mọi phần thay đổi
trong đợt. Lỗi phát hiện và vá ngay, mỗi lỗi kèm unit test:
- **Phân quyền tài liệu (3 lỗi mức Cao, 1 Trung bình):** nhân viên tải tệp được vào thư mục
  `restricted` mình không mở được (tệp đó rồi được RAG đưa vào ngữ cảnh chatbot của người có quyền —
  đường chèn lệnh độc hại); tạo được thư mục con trong thư mục `restricted`; xoá thư mục cha xoá luôn
  thư mục con `restricted` của người khác; người chỉ có quyền XEM qua chia sẻ tệp vẫn tải phiên bản
  mới, xoá tệp và tự nâng quyền lên SỬA.
- **Rate limit Gateway dùng chung cả tổ chức:** khoá đếm là tổ chức + IP, 100 request/phút — văn phòng
  thật đi chung 1 IP qua NAT nên cả tổ chức dùng chung 100 request, trong khi 1 trang SPA gọi 8–15
  request (kiểm thử giao diện 3 người dùng nhận 50 lần 429). Nay đếm theo người dùng, 300 request/phút;
  chưa đăng nhập vẫn theo IP, 100 request/phút. Xác minh sống: đúng request thứ 301 nhận 429.
- **Org Admin của tổ chức cũ thiếu quyền mới:** tổ chức đăng ký trước khi có quyền mới không bao giờ
  nhận quyền đó (tổ chức E2E có 40/52 quyền, 10 tổ chức thiếu `chatbot:use`) và không sửa được qua API
  hay giao diện. iam-service nay bổ sung quyền còn thiếu cho mọi vai trò Org Admin lúc khởi động (không
  đụng Manager/Employee).
- **Ma trận phân quyền (web)** thiếu 20 quyền ra đời sau (chatbot, Kho, Nhắn tin, `ml:view`...), rơi vào
  nhóm "Khác" với nhãn là key kỹ thuật — bổ sung nhóm và nhãn vi/en/ja.
- **Tìm kiếm tài liệu không giới hạn tần suất:** gọi thẳng được `search-chunks`, đốt được hạn ngạch
  Gemini dùng chung toàn nền tảng — giới hạn 40 lần/10 phút/người dùng.
- **Healthcheck Kafka** khởi động 1 JVM mỗi 10 giây (CPU vọt 140–220%) — giữ lệnh kiểm tra, đổi nhịp
  thành 5 giây lúc khởi động và 60 giây khi đã khoẻ.
- Nhỏ: thanh tiến độ ở bảng Tiến độ dự án thiếu thuộc tính trợ năng (làm 1 test e2e luôn thất bại);
  toast che panel chat trên điện thoại; câu trả lời chatbot lặp tên tệp.

**Đã kiểm tra, không phải lỗi:** cảnh báo `client.query() while already executing` của
document-service chỉ xuất hiện 1 lần lúc TypeORM khởi tạo kết nối (pg 8.22); cảnh báo
`MaxListenersExceededWarning` của Gateway chỉ xuất hiện 1 lần, do số proxy route vừa vượt 10 (mỗi
proxy gắn 1 listener ở lần dùng đầu), không tăng theo request. Gemini có lúc chậm (7–49 giây, có lúc
503 quá tải) — đo trực tiếp cho thấy kết nối mạng nhanh, độ trễ nằm phía máy chủ Google; chatbot vẫn
trả lời trong giới hạn 45 giây, Groq dự phòng truy cập được.

**Mock data:** `Doc/Mock_data.md` (tài khoản theo vai trò, file mẫu, 9 kịch bản kèm kết quả mong đợi,
cơ chế dọn dẹp) + `scripts/mock-data/` (kịch bản đọc URL/tài khoản từ biến môi trường, tự xoá mọi thứ
đã tạo).

**Còn tồn đọng:** 6/17 test Playwright `e2e/` thất bại do selector cũ so với giao diện hiện tại (vd nút
"Dự án mới" đã đổi thành "Tạo dự án") — thao tác thực tế vẫn thành công, cần cập nhật spec.

**Xác minh cuối:** bộ kịch bản `scripts/mock-data/run-all.js` chạy lại sau mọi lần rebuild: 186/186
PASS (01–07); 08–09 PASS ở lần chạy của agent nghiệm thu. Gate toàn workspace sau lần sửa cuối cùng: `typecheck`/`lint` (0 lỗi)/`lint:i18n-strings` (sạch, 188 file)/`test` (1.072 test qua)/`build` đều thành công; 26 container chạy thường trực đều healthy.
Chi tiết kỹ thuật: `Technical_Spec.md` §8, §23, §25.

## 25/10/2026 — Merge nhánh Frontend2 (Tiến) vào main + khắc phục CI

Merge 6 commit mới của nhánh `Frontend2`: tối ưu toàn bộ code frontend (tách trang lớn thành các
component nhỏ), cập nhật biểu đồ Dashboard, ngôn ngữ các module và giao diện mobile/tablet, giao diện
Danh mục sản phẩm & Kho, và tính năng nhân viên **tự hủy đơn nghỉ phép đang chờ duyệt** (endpoint mới
`PATCH /api/v1/leave-requests/:id/cancel` ở `hrm-service`).

**6 file conflict, cách xử lý:**
- `RolesPermissionsPage.tsx`: Frontend2 tách bảng quyền sang `roles-permissions.constants.ts` — chuyển
  phần bổ sung của main (8 quyền Sản phẩm & Kho, quyền `chatbot:use`) vào file mới; dùng khoá nhóm
  `message` của Frontend2 (nhãn đổi thành "Nhắn tin & Trợ lý AI") thay cho khoá `messaging` trùng ý.
- `ProfilePage.tsx` và `AttendancePage.tsx`: Frontend2 tách thành các card/bảng con — thẻ đăng ký
  khuôn mặt chuyển thành component riêng `ProfileFaceEnrollmentCard.tsx`; badge khớp khuôn mặt
  chuyển vào `attendance-shared.tsx` và gắn vào thẻ chấm công hôm nay, 2 bảng lịch sử, modal ảnh.
- `ProjectProgressTable.tsx`: lấy bản Frontend2 (đã tự có `role="progressbar"`).
- `LoginPage.tsx`: giữ màu badge mới của Frontend2, giữ email demo hậu tố `+227860` khớp DB hiện tại.
- `vi/errors.json`: lấy bản dịch đầy đủ của Frontend2, bổ sung mã lỗi chatbot/RAG/khuôn mặt.

**Lỗi do merge tự động gây ra, phát hiện và sửa:** Git gộp được 3 file `admin.json` (vi/en/ja) không báo
conflict nhưng để lại **11 khoá trùng** trong mỗi file (cả 2 nhánh cùng thêm nhãn cho các quyền giải
trình/tăng ca/lịch/nhắn tin/`ml:view`) — JSON hợp lệ về cú pháp nên không gate nào bắt được. Giữ nhãn
của Frontend2, bỏ bản trùng.

**Gate `lint:i18n-strings` đỏ sau merge — 102 chuỗi tiếng Việt viết thẳng trong code của Frontend2:**
74 chỗ `t('khoá', 'chuỗi dự phòng')` mà khoá đã có đủ vi/en/ja → bỏ chuỗi dự phòng; 5 khoá chưa có →
bổ sung vi/en/ja; ~10 chỗ chữ hiển thị viết thẳng → chuyển sang khoá (ưu tiên khoá sẵn có); 16 dòng so
khớp dữ liệu (tên vai trò, loại khách hàng, loại nghỉ phép) → đánh dấu `i18n-lint-ignore` theo quy
ước sẵn có. Cập nhật 1 test (`MonthlyTimesheetTable.test.tsx`) đang so chuỗi cứng.

**CI trên GitHub đỏ liên tục từ 11/10/2026 (3 lần push gần nhất):** bước `npm run test:coverage` thất
bại. Tái hiện ở máy với `TZ=UTC` như runner CI: `inventory-service` (thêm 16/10) chép nguyên ngưỡng
coverage của `crm-service` (45/55/45/45%) trong khi số đo thật chỉ 39/35/40/29% — đặt lại ngưỡng
bằng số đo thật làm sàn chặn thụt lùi, đúng quy ước đặt ngưỡng của dự án từ 22/08/2026. npm dừng ở
workspace lỗi đầu tiên nên chạy lần lượt từng workspace còn lại: tất cả qua.

**Ghi nhận cho tính năng hủy đơn của Frontend2 (chưa sửa):** đơn bị hủy chuyển sang `REJECTED` và phát
sự kiện `LEAVE_REQUEST_REJECTED`, nên chính người hủy nhận 1 thông báo "đơn bị từ chối" và số liệu
phân tích tính đơn đó là bị từ chối. Lỗi `403` khi hủy đơn của người khác chưa có `errorCode`.

**Xác minh:** `typecheck`/`lint` (0 lỗi)/`lint:i18n-strings` (sạch, 230 file)/`test`/`build` toàn
workspace; `test:coverage` ở `TZ=UTC` qua mọi workspace; `package-lock.json` khớp manifest. Rebuild
`hrm-service` + `web`: kịch bản `02-hrm` 28/28, `09-ui-smoke` 32/32 (3 vai trò × 26 trang, 0 lần 429);
hủy đơn sống: người khác hủy → 403, chủ đơn hủy → 200, hủy lần 2 → 400.

## 25/10/2026 (tiếp) — Merge nhánh test-cdc (Thành): CDC Debezium + rà soát chéo + lỗi Kafka không lưu dữ liệu

**Phần Thiều Quang Thành xây dựng** (nhánh `test-cdc`, 3 commit ngày 05/09 và 25/09/2026): connector
Debezium Postgres kèm Outbox Event Router đọc bảng `outbox_events` của `project-task-service`, định
tuyến sang `project-task.events` với key và envelope đúng định dạng `DomainEvent`; service
`debezium/connect:2.7.3.Final`, `wal_level=logical` cho `postgres-pt`, cờ `ENABLE_OUTBOX_POLLING`,
script đăng ký connector và hướng dẫn trong README. Kiến trúc và cách ánh xạ cột đúng, nhưng chưa sự
kiện nào đi trọn luồng tới consumer vì 2 chi tiết cấu hình: trường timestamp của SMT đòi INT64 trong
khi `occurred_at` là `timestamptz` (task `FAILED` ngay sự kiện đầu), và biến tắt schema của converter
không được image đọc nên mọi message bị bọc `{"schema", "payload"}` rồi bị consumer đẩy vào DLQ.

**Merge (commit `51dcf6b`):** conflict duy nhất ở `infra/docker-compose.yml` (chủ yếu do nhánh định
dạng lại) — giữ bản của `main`, thêm phần CDC bằng tay; `package-lock.json` giữ nguyên bản `main` (bản
của nhánh tạo bằng npm cũ, âm thầm làm mất 13 mục `"libc"`). Sửa 2 lỗi cấu hình trên; `debezium` đưa
vào profile tuỳ chọn `cdc` (tắt mặc định, giới hạn heap/RAM, cổng chỉ `127.0.0.1`);
`snapshot.mode=no_data`, slot/publication đặt tên cố định, mật khẩu DB qua config provider; trần WAL
cho slot `max_slot_wal_keep_size=512MB`; thay script đăng ký bằng `scripts/cdc-on.ps1`/`cdc-off.ps1`
có thứ tự bước bảo đảm không mất sự kiện (OFF đánh dấu `published` các dòng đã được xác nhận tới Kafka
qua `confirmed_flush_lsn` để polling không gửi lại hàng loạt); sửa README ghi sai tên biến
(`OUTBOX_POLLING_ENABLED`); thêm unit test cho cờ polling.

**Rà soát chéo:** 2 người rà soát độc lập — 1 kiểm thử sống dưới tải trên PowerShell 5.1, 1 rà soát
tĩnh + CI. 9 vấn đề được xác nhận, sửa rồi được 1 người xác minh độc lập kiểm lại (đều PASS), commit
`775c518`:
- **CAO, có từ trước, không do CDC gây ra — Kafka chưa từng lưu dữ liệu:** volume gắn ở
  `/var/lib/kafka/data` nhưng thiếu `KAFKA_LOG_DIRS` nên Kafka ghi vào `/tmp/kafka-logs`; mỗi lần tạo
  lại container là mất hết topic và offset consumer group (`notification-service` dùng
  `fromBeginning: false` nên có thể bỏ qua sự kiện); với CDC, topic `debezium_*` bị tạo lại sai
  `cleanup.policy` làm Debezium khởi động lỗi liên tục. Nay `KAFKA_LOG_DIRS=/var/lib/kafka/data`, sau
  `--force-recreate kafka` cả 12 topic và offset còn nguyên.
- Đường tắt của `cdc-on.ps1` đòi thêm slot `active`; phát hiện slot mất (`wal_status = 'lost'`) và báo
  "chạy cdc-off rồi cdc-on"; healthcheck `debezium` phản ánh trạng thái connector + task (connector
  chết hiện `unhealthy`); config provider chỉ cho đọc biến `PT_DB_*`;
  `null.behavior=optional_bytes` giữ trường `null` giống polling; cờ polling đọc qua
  `configuration.ts`/`ConfigService`; script so khớp cờ không phân biệt hoa thường; README bổ sung cách
  dừng cả stack (`cdc-off` rồi `docker compose --profile cdc down`) và nói rõ 512MB là trần WAL giữ cho
  slot, không phải tổng `pg_wal`.

**Số đo:** độ trễ tới Analytics qua CDC 0,40–0,62 giây (polling khoảng 2,0 giây); RAM `debezium`
410–577MiB trên giới hạn 768MiB; image 2,2GB. Người rà soát sống: 1.862 sự kiện, 0 mất, 0 trùng lặp lộ
ra với người dùng, khởi động lại Postgres/Kafka trong lúc CDC chạy đều tự phục hồi. Người xác minh:
416/416 sự kiện qua ON, OFF và 3 vòng phục hồi.

**Giới hạn đã biết:** `debezium` đã dừng sẵn thì `cdc-off.ps1` không xoá được connector/offset (phục
hồi vẫn đúng); mỗi lần chuyển chế độ tạo lại `project-task-service`, và trên máy Docker Desktop/WSL
`localhost` có thể treo khoảng 90 giây sau khi tạo lại container (`wslrelay.exe` giữ `127.0.0.1` ở cổng
3000/80/9010) — chuyển chế độ trước khi demo; topic nội bộ của Debezium vẫn còn sau khi tắt (nhỏ).

**Phân công cho Thành:** chốt vai trò và giao 5 gói việc — P1 phụ trách CDC (diễn tập, kịch bản demo,
trình bày khi bảo vệ, tuỳ chọn mở rộng sang service thứ 2), P1 kiểm thử hiệu năng (polling so với CDC,
độ trễ/thông lượng Gateway, đưa số đo vào phần NFR của báo cáo), P2 e2e Playwright (sửa 6/17 test lỗi
selector, thêm e2e chatbot/chấm công khuôn mặt/Kho), P3 tuỳ chọn dự báo xu hướng (Upgrade Tier 4
Layer 4) và việc backend nhỏ (trạng thái `CANCELLED` cho đơn nghỉ phép, bộ lọc "giao cho tôi" cho API
công việc), kèm quy tắc làm việc (1 nhánh/gói việc, Pull Request, đồng bộ `main` hằng tuần).

Chi tiết kỹ thuật: `Technical_Spec.md` §26 (và cuối §25); phân công: `Script.md` §3.3–§3.4.

## 26/10/2026 — Danh sách nhân viên & kho ảnh nhận diện (phân tích + kế hoạch, chưa code)

Phân tích để chuẩn bị tính năng "Danh sách nhân viên": xem thông tin cá nhân, email, số điện thoại, ảnh
nhận diện; Org Admin và Manager (trong phạm vi) cập nhật avatar + ảnh nhận diện, mọi người tự cập nhật
của mình; nhân viên chỉ xem hồ sơ của chính mình; nhập danh sách kèm ảnh nhận diện qua Excel. Hai luồng
phân tích độc lập: 1 luồng thiết kế, 1 luồng phản biện tìm lỗ hổng (42 mục), sau đó đối chiếu và chốt.
Chỉ sửa tài liệu, không đổi mã nguồn.

**3 câu hỏi hiện trạng (có bằng chứng file:line ở `Technical_Spec.md` §27.1):**
1. Kho khuôn mặt nằm ở `ml-service` (`ml_db`, bảng `face_enrollments`: `user_id`, `organization_id`,
   `embedding` 512 chiều, `enrolled_at`) — **chỉ lưu embedding, không lưu ảnh gốc**. Ảnh check-in/out ở
   bucket `hrm-attendance`, lưu vô thời hạn (không lifecycle, hrm-service không xử lý `USER_DELETED`).
2. Chỉ chính chủ sửa được (4 endpoint `/ml/face/*` luôn dùng `ctx.user_id`); không có đường nào cho Org
   Admin/Manager; ô đồng ý chỉ là state phía client.
3. Nhập Excel (§19.1) có cho nhân viên nhưng không có ảnh, không cập nhật được người đã có, mật khẩu mặc
   định dùng chung `Password123!`.

**Lỗ hổng chính tìm được:** hồ sơ cá nhân web còn giả lập (số điện thoại cố định `0912 345 678`, nút Lưu
chỉ `setTimeout`, avatar chỉ xem trước); `users` không có số điện thoại/avatar/mã NV; `GET /users` mở cho
mọi nhân viên nên không thể thêm trường riêng tư vào đó; truy vấn khuôn mặt ở ml-service chỉ lọc
`user_id` — sẽ thành lỗ hổng xuyên tenant ngay khi thêm "đăng ký hộ"; model nạp lười không khoá (2
request đầu có thể nạp 2 lần ArcFace 261 MB dưới giới hạn 1 GB) và detector dùng chung giữa các thread;
vô hiệu hoá tài khoản không xoá embedding; ảnh đăng ký nhiều mặt bị chọn bừa mặt tin cậy nhất; không kiểm
tra trùng khuôn mặt giữa các nhân viên (gian lận chấm công hộ); SheetJS bản cộng đồng không đọc được ảnh
nhúng trong Excel; Nginx web mặc định 1 MB (đã sửa sẵn thành 26 MB).

**Quyết định chốt:** lưu ảnh nhận diện gốc trong bucket private `ml-face-references` (mất EXIF/GPS), chỉ
đọc qua proxy ml-service có kiểm tra phạm vi + `no-store` + nhật ký từng lượt xem, không presigned URL;
avatar tách riêng ở `iam-avatars` (presigned TTL ngắn); đồng ý lưu phía server (`face_consents`), ảnh tải
hộ/nhập ở trạng thái `PENDING_CONSENT` không dùng để so khớp cho tới khi nhân viên xác nhận, tự huỷ sau
30 ngày; phạm vi Manager theo `departmentId` trong JWT, chỉ với Employee phòng mình; cho tự đăng ký lại
có nhật ký + kiểm tra trùng 1:N (≥ 0,5 chặn, 0,35–0,5 cảnh báo); nhập Excel + ZIP có xem trước, kiểm tra
phía server và báo cáo lỗi; cột mật khẩu tuỳ chọn + email kích hoạt; xoá dữ liệu khuôn mặt khi vô hiệu
hoá; không có công tắc theo tổ chức; `ecap-mobile` để đợt sau. Giai đoạn 0 sửa trước 2 lỗi ml-service.
Trong 42 mục phản biện: loại hẳn 4 mục (#7 công tắc mặc định tắt, #8 không lưu ảnh gốc, #26 phạm vi
theo `managerId`, #30 permission mới), hoãn 1 mục (#36 mobile), nhận một phần 7 mục (#4, #10, #11, #15,
#16, #22, #29 — vd bỏ quy trình duyệt khi tự đăng ký lại, chưa mã hoá embedding); còn lại nhận toàn bộ.
Lý do ở `Technical_Spec.md` §27.14–§27.15.

**Cập nhật pháp lý:** căn cứ hiện hành từ 01/01/2026 là Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và
Nghị định 356/2025/NĐ-CP (thay Nghị định 13/2023/NĐ-CP); dữ liệu sinh trắc là dữ liệu cá nhân nhạy cảm.
Bảng ánh xạ điều khoản → cơ chế lập theo bản tóm tắt, cần đối chiếu toàn văn trước khi trích vào báo cáo.

**Kế hoạch:** 6 giai đoạn bắt buộc (0–5, ≈ 14 người-ngày) + 1 giai đoạn tuỳ chọn (xoá ảnh chấm công sau
90 ngày, thông báo khi người khác đổi avatar, avatar trên mobile, mã hoá embedding).

Chi tiết kỹ thuật: `Technical_Spec.md` §27 (và ghi chú cuối §24); giao diện: `Wireframe.md` §16.

## 26/10/2026 (tiếp) — Tài liệu theo phạm vi dự án + phạm vi dữ liệu của Manager

Hai yêu cầu làm cùng đợt vì chạm cùng một câu hỏi "ai được thấy gì": (1) tài liệu đi theo dự án thay vì
mở cho cả tổ chức; (2) Manager phải cao hơn Employee nhưng thấp hơn Org Admin ở **mọi** module — trước đây
Manager xem dự án, khách hàng, đơn nghỉ phép, số liệu Analytics của cả tổ chức giống Org Admin, tự duyệt
được đơn của mình, còn Employee thấy mọi deal và hồ sơ đầy đủ của mọi người. Làm theo 4 vòng: 2 luồng
triển khai song song, 1 vòng rà soát và sửa, 1 vòng kiểm tra chéo cuối trước commit (`54ba030`).

**Chính sách chốt:** người thuộc dự án = người phụ trách/thành viên/người tạo (giao Task tự thêm thành
viên); dự án liên quan tới phòng ban = 1 trong 3 vai trò đó thuộc phòng ban. `resolveDataScope()` dùng
chung cho mọi service: Employee — của mình; Manager — của mình + phòng ban (`departmentId` trong JWT);
Org Admin — toàn tổ chức. Tài liệu: thư mục cấp gốc gắn dự án, chỉ người thuộc dự án (Manager: thêm dự án
liên quan phòng ban) xem được; cây toàn công ty ai cũng xem nhưng chỉ Org Admin ghi (trừ chia sẻ tường
minh); RAG dùng chung bộ lọc. Document Service lần đầu tiêu thụ Kafka: 3 read-model (`project_refs`,
`project_member_refs`, `user_department_refs`), 3 sự kiện mới (`project.member_added`,
`project.member_removed`, `project.lead_changed`), backfill qua endpoint nội bộ lúc khởi động và không chặn
consumer khi lỗi. Project-Task, CRM, HRM có bảng `dim_user` riêng để biết thành viên phòng ban.

**Lỗi tìm ra ở vòng rà soát (cả hai chỉ xuất hiện khi ghép 2 luồng):**
- **Cao — ghi theo id vượt phạm vi (IDOR):** phạm vi mới chỉ thu hẹp đường đọc. Manager phòng Kỹ thuật
  `GET /projects/:id` → 404 nhưng `PATCH` → 200 và tự thêm mình làm thành viên → 201, sau đó thấy cả dự án
  lẫn tài liệu dự án; Employee sửa Task, tự giao Task cho mình ở dự án không được xem. Sửa: mọi thao tác ghi
  theo id ở dự án/Task/CRM kiểm tra phạm vi, ngoài phạm vi trả 404 cùng mã "không tồn tại".
- **Trung bình — ghi đè tệp toàn công ty:** tệp ở thư mục gốc ai cũng ghi được (Employee tải phiên bản mới
  đè tệp của Org Admin → 201, Manager xoá → 200). Sửa thành "cây toàn công ty chỉ Org Admin ghi".
- Thấp: migration phụ thuộc 1 lần chờ 5 giây ở seed (thêm thử lại 10 × 3 giây).

**Vòng kiểm tra chéo:** đồng ý toàn bộ bản sửa; xác minh lại sống 92/92 đường ghi/đọc theo id. Thêm 2
quyết định của chủ dự án: gỡ thành viên còn Task chưa xong → 409 `PROJECT_MEMBER_HAS_OPEN_TASKS` (giao lại
Task trước); nút thao tác trên từng tệp theo quyền ghi của chính tệp (`canWrite`, tệp được chia sẻ EDIT
trong cây toàn công ty vẫn hiện nút). Bổ sung biến môi trường còn thiếu trong `.env.example`
(`PROJECT_TASK_SERVICE_URL`, `INTERNAL_SHARED_SECRET`).

**Nginx 1 MB:** container `web` dùng giới hạn mặc định 1 MB của Nginx nên tải tệp > 1 MB qua giao diện
nhận 413 dù Document Service cho tới 25 MB — nâng `client_max_body_size` lên 26 MB (commit `652f3ce`), đã
thử tải 5 MB qua `http://127.0.0.1/api/v1/files/upload` → 201.

**Bộ 20 tài liệu mẫu:** 4 tài liệu Word/PDF/Excel/PowerPoint cho mỗi dự án demo (đặc tả website, catalogue
sản phẩm, hướng dẫn CRM, mẫu báo giá, hướng dẫn Docker, đề xuất cấu hình máy chủ, hướng dẫn app di động,
từ điển KPI, báo cáo KPI quý…), tiếng Việt có dấu, số liệu ghi rõ "minh hoạ". `scripts/seed-project-docs.js`
tải vào thư mục của từng dự án (idempotent, tên tệp = tiêu đề); RAG lập chỉ mục 10 tài liệu PDF/DOCX (263
đoạn), Excel/PowerPoint chỉ lưu trữ. Lỗi nhỏ lúc viết script: tiêu đề chứa dấu `/` bị phần tải lên cắt
thành phần sau dấu `/` nên lần chạy thứ 2 tải trùng — đổi tiêu đề, xoá 2 bản trùng. Kiểm tra sống: mọi tài
khoản thấy tài liệu dự án ⇔ thấy dự án, chat bot trả đoạn "Từ điển chỉ số KPI" đúng người (28/28).

**Dữ liệu demo CRM:** seed tạo mọi khách hàng bằng Org Admin nên CRM của Manager demo trống sau đợt này —
`scripts/migrate-demo-ownership.js` giao 8 khách hàng cho phòng Kinh doanh (Manager thấy 8 khách hàng/16
deal, nhân viên demo 3/6).

**Sao lưu:** `npm run backup` bỏ sót 3 CSDL ra đời sau (ml, messaging, inventory) và bucket ảnh sản phẩm —
nay sao lưu 8 Postgres + TimescaleDB + MongoDB + mọi bucket MinIO đang có (11/11). Kiểm tra bằng cách phục
hồi từng dump vào CSDL tạm: số dòng khớp hoàn toàn; không chạy `restore.js` đè lên hệ thống đang chạy vì
dump dạng thường (không `--clean`) chỉ phục hồi đúng vào CSDL trống.

**Kết quả:** gate tương đương CI (typecheck, lint 0 lỗi, kiểm tra chuỗi i18n, test có coverage, build) đều
qua; 9/9 image Docker của CI build được; mock-data 01–08 PASS (04: 55/55, 08: 12/12).

Chi tiết kỹ thuật: `Technical_Spec.md` §28; giao diện: `Wireframe.md` §5.1; kịch bản: `Mock_data.md` §4.4,
§4.7, §9.

---

## 26/10/2026 (tiếp 2) — Danh sách nhân viên & kho ảnh nhận diện: triển khai giai đoạn 0–5

Triển khai kế hoạch `Technical_Spec.md` §27 (mục 26/10/2026 ở trên) theo 2 luồng: 1 luồng lập trình, 1 luồng
kiểm thử độc lập; lỗi do luồng kiểm thử tìm ra được sửa rồi xác minh lại trước commit. Giai đoạn 6 (tuỳ
chọn) chưa làm.

**Đã làm:**
- **ml-service:** nạp model 1 lần lúc khởi động, giới hạn 2 lượt phân tích đồng thời + khoá riêng cho
  detector, mọi truy vấn khuôn mặt lọc `organization_id`. Kho ảnh nhận diện trong bucket private
  `ml-face-references`, chỉ đọc qua proxy `no-store` có nhật ký `VIEW_REF`. Đồng ý lưu phía server; ảnh tải
  hộ/nhập ở trạng thái chờ, không dùng để so khớp tới khi nhân viên xác nhận, tự huỷ sau 30 ngày. Kiểm tra
  trùng 1:N trong tổ chức (≥ 0,5 chặn, 0,35–0,5 cảnh báo). Vô hiệu hoá/xoá tài khoản xoá sạch dữ liệu khuôn
  mặt và object MinIO.
- **iam-service:** số điện thoại, mã nhân viên, avatar thật (bucket `iam-avatars`, presigned); danh sách nhân
  viên theo phạm vi (Org Admin cả tổ chức, Manager chỉ Employee phòng mình, Employee không vào được);
  `GET /users` không bao giờ trả SĐT/mã NV; mời không cần mật khẩu, gửi email kích hoạt.
- **web:** tab "Danh sách nhân viên", cửa sổ Hồ sơ nhân viên, panel ảnh nhận diện 4 trạng thái, hộp đồng ý
  + banner chờ xác nhận, trình nhập Excel + ZIP 4 bước có báo cáo lỗi. Hồ sơ cá nhân bỏ hết phần giả lập.
- **CI:** job mới `ml-service-test` chạy pytest cho ml-service.

**Lỗi tìm ra ở vòng kiểm thử độc lập (8, đã sửa hết):**
- **Cao, toàn hệ thống — giả mạo header nội bộ qua Gateway:** Gateway chỉ ghi đè header nó đặt; khi JWT
  không có phòng ban, `x-department-id` do client tự gửi lọt xuống service, nên Manager chưa có phòng ban đọc
  được danh sách nhân viên/ảnh chờ của phòng khác. Lỗi có từ trước, lộ ra khi đợt này dựa vào header phòng
  ban. Sửa: Gateway xoá mọi header tin cậy do client gửi trước khi đặt lại từ JWT, cả với WebSocket.
- Tải ảnh hộ được cho tài khoản đã vô hiệu hoá → nay 409 `USER_INACTIVE` (event mới `iam.user.reactivated`).
- Avatar gửi thẳng API còn giữ EXIF/GPS → iam bỏ khối metadata của JPEG/PNG/WebP.
- Người do Manager mời không có vai trò nào → gán vai trò "Employee"; user cũ được gán bù lúc iam khởi động.
- Đổi mật khẩu ở Hồ sơ là giả lập → endpoint thật `PATCH /users/me/password`, thu hồi mọi refresh token.
- Kích hoạt lại tài khoản vẫn bị 401 → xoá khoá blacklist trong Redis khi kích hoạt lại.
- UX trình nhập: dòng trùng chỉ đánh lỗi từ dòng thứ 2, ô ảnh của dòng lỗi không treo "Đang kiểm tra…".
- Ảnh mẫu CI (opencv_zoo) là ảnh đã vẽ khung phát hiện → đổi sang ảnh tổ bay STS-130 của NASA (phạm vi công
  cộng), tải theo URL + SHA256 ghim.

**Kết quả:** pytest ml-service 64 test, jest Gateway 42 test; kịch bản sống `10-employee-directory.js`
45/45, hồi quy mock-data 01–07 195/195, 10/10 kiểu giả mạo header bị chặn; RAM ml-service 579–645 MiB
(giới hạn 1 GB). Gate tương đương CI: xem `Technical_Spec.md` §27.16.

**Giới hạn đã biết:** giai đoạn 6 chưa làm (ảnh chấm công vẫn lưu vô thời hạn); lọc trạng thái ảnh chỉ trên
trang đang xem; ngưỡng độ nét/1:N chưa tinh chỉnh bằng dữ liệu thật; rate limit route công khai tin
`X-Real-IP` khi gọi thẳng cổng 3000 (có từ trước); ml-service chưa nằm trong ma trận build Docker của CI.

Chi tiết kỹ thuật: `Technical_Spec.md` §27.16, §6; giao diện: `Wireframe.md` §16; kịch bản: `Mock_data.md`
§4.9, §10.

---

## 28/10/2026 — Xem trước tài liệu trong ứng dụng, dọn kho tài liệu demo, chụp ảnh nhận diện bằng camera

Làm theo 3 vòng: 4 luồng triển khai song song (dọn kho tài liệu demo; mọi lối "xem tệp" mở cửa sổ xem trước;
xem trước Word/Excel/PowerPoint trong trình duyệt; chụp ảnh nhận diện bằng camera), 4 vòng rà soát độc lập (mỗi
vòng 1 luồng, kiểm bằng cách chạy thật chứ không chỉ đọc code), 1 vòng tích hợp cuối. Chủ dự án chọn dựng tài
liệu Office ngay trong trình duyệt (không thêm container chuyển đổi), xoá thư mục rỗng `RA-repro-view-share`
và 85 object MinIO mồ côi, giữ nguyên Chấm công trên điện thoại (chưa thêm đường dự phòng camera).

**Lỗi tìm ra ở vòng rà soát:**
- **Cao — chèn CSS qua tệp Word:** `docx-preview` dựng thẻ `<style>` bằng cách nối chuỗi giá trị lấy từ tệp và
  chép nguyên `style` của hình VML. 1 tệp `.docx` độc hại (ai có quyền tải lên thư mục dùng chung đều tạo được)
  đổi giao diện cả ứng dụng, phủ lớp kín màn hình che cả nút đóng (giả mạo giao diện) và gọi `url(...)` ra máy
  chủ ngoài khi người khác mở xem. Bộ lọc liên kết/thẻ của luồng triển khai không chạm tới chỗ này. Sửa: tài liệu
  nằm trong iframe sandbox không cho chạy script, có CSP riêng chặn mọi tài nguyên ngoài; 27 tệp độc hại kiểm
  lại đều bị giam trong khung.
- Trung bình: đóng cửa sổ khi tệp Office đang tải làm tệp mở sau kẹt vòng xoay mãi (đặt lại cờ + huỷ lượt tải);
  1 lần Escape đóng mọi cửa sổ chồng nhau — camera, hộp tải ảnh và Hồ sơ nhân viên cùng lúc, mất ảnh vừa chụp và
  chỉnh sửa chưa lưu (`Modal` nay có ngăn xếp, chỉ lớp trên cùng nhận Escape — áp dụng toàn ứng dụng); 2 tài liệu
  công ty sai 7 điểm so với hệ thống mà chat bot lại trích làm "Nguồn" (sửa nội dung, sinh lại, tải lại); kịch
  bản E2E Tài liệu còn chờ tab mới (viết lại theo cửa sổ xem trước + kiểm tra tải xuống).
- Thấp (sửa ở vòng rà soát hoặc vòng tích hợp): tên tệp dài tràn ngang ở 390px; ô chọn ảnh bấm được khi ảnh trước
  còn đang kiểm tra; đóng/mở lại camera quá nhanh để camera cũ sáng mãi, URL ảnh xem trước không thu hồi; Esc lúc
  chip nguồn đang tải để cửa sổ bật lên sau khi panel đã đóng; `.docx` nhỏ chứa 100.000 đoạn văn treo tab 4–5
  giây (thêm trần 5 MB cho `word/document.xml`, 20 MB cho trang tính); `.xlsx` rỗng/đổi đuôi hiện bảng trống thay
  vì báo lỗi; dòng kết quả cũ hiện lại khi mở lại hộp tải ảnh; vòng xoay nằm nhầm nút; nút tải xuống không có tên
  ở màn hình hẹp.

**Dữ liệu demo:** bỏ 15 tệp mẫu `.txt/.csv` (cả trong `seed.js`), thay 2 tệp `.txt` công ty bằng "Nội quy làm
việc.pdf" và "Sổ tay nhân viên.docx" thật, xoá 85 object MinIO mồ côi (3,73 MiB) → 22 tệp, 22 object, 12 tệp lập
chỉ mục RAG / 286 đoạn.

**Hiệu năng tải trang:** cấu hình chia chunk cũ kéo `vendor-pdf` (~587 kB) vào mọi trang vì hàm preload của Vite
nằm trong chunk đó; đổi `manualChunks` sang dạng hàm → JS của trang đăng nhập 1.449 → 852 kB (gzip 435 → 256 kB).

**Kết quả:** gate tương đương CI qua (1.186 test jest + 170 test vitest); kiểm thử sống trên bản production 45/45
(4 vai trò, 390px, camera giả, tệp độc hại); E2E Tài liệu 1/1; mock-data 01–07 và 10 đều PASS.

**Giới hạn đã biết:** PowerPoint chỉ là bản giản lược chữ; chưa có CSP ở Nginx; kích thước khai báo trong ZIP có
thể bị làm giả (chặn bởi trần 15 MB); Chấm công trên điện thoại qua http chưa có dự phòng camera; URL presigned ký
cho `localhost:9010` nên máy khác trong LAN cần đặt `MINIO_PUBLIC_ENDPOINT`.

Chi tiết kỹ thuật: `Technical_Spec.md` §29; giao diện: `Wireframe.md` §5, §16.3, §16.5; kịch bản: `Mock_data.md`
§2, §11.

---

## 28/10/2026 (tiếp) — Merge 4 nhánh frontend của Tiến vào main

Merge `Frontend2`, `tien/review-ui-responsive`, `tien/fix-documents-grid`, `tien/add-unit-tests` (chỉ thay đổi
`apps/web`, không đụng backend):
- **Frontend2:** nút/panel chatbot màu accent, bảng chấm công tỉ lệ 4:8, form Đăng ký gọn hơn + cảnh báo mật khẩu
  có dấu tiếng Việt (dùng lại `containsVietnameseDiacritics`). Nhánh đổi email tài khoản demo ở trang Đăng nhập
  sang hậu tố `+246317` (seed trên máy khác) — Git gộp im lặng không báo xung đột; đã giữ lại `+227860` khớp DB
  demo và `Mock_data.md`. Bổ sung chú thích ngày cho các chỗ sửa (nhánh chưa ghi).
- **review-ui-responsive:** badge GPS/khớp khuôn mặt không vỡ dòng. 1 xung đột ở `ProfileFaceEnrollmentCard.tsx`:
  giữ `id` + `scroll-mt-20` của main (banner "Xem ngay" cuộn tới khối ảnh nhận diện) cùng chú thích của nhánh.
- **fix-documents-grid:** tên tệp ở chế độ Lưới tối đa 2 dòng + tooltip tên đầy đủ, gộp tự động với thay đổi
  "bấm thẻ mở cửa sổ xem trước". **Lỗi phát hiện khi kiểm tra trên bản build thật:** class `block` đứng cùng
  `line-clamp-2` — Tailwind sinh `display: block` sau nên đè `display: -webkit-box`, tên tệp vẫn hiện 3–6 dòng
  (đo trên trình duyệt). Bỏ `block`; đo lại: mọi tên ≤ 2 dòng ở 390px và 1366px.
- **add-unit-tests:** 24 unit test (MobileRolesView, CustomerCard, OrgAttendanceLogTable, PersonalAttendanceTable,
  leave-shared), chạy lại trên main hiện tại đều qua.

**Kết quả:** gate tương đương CI (TZ=UTC) — typecheck, lint 0 lỗi, `lint:i18n-strings`, `test:coverage` (13
workspace jest + web 35 file / 194 test), build — đều qua; build lại image `web`; kịch bản giao diện `09-ui-smoke.js`
32/32; kiểm tra riêng các phần vừa merge trên bản thật (Đăng ký 2 bước + cảnh báo dấu, Lưới tài liệu, nút chatbot,
bảng chấm công, 390px và 1366px, không lỗi console) 18/18.

---

## 28/10/2026 (tiếp 2) — Điểm khuôn mặt do máy chủ ký, hiển thị phần trăm, hướng dẫn Trợ lý ECAP

Rà soát trước buổi bảo vệ phát hiện 3 vấn đề trên bản đang chạy:
- **Giả mạo được điểm khuôn mặt:** web tự gọi ml-service rồi gửi `faceMatchScore` lên hrm-service, máy chủ tin con
  số đó (`scripts/mock-data/02-hrm.js` gửi thẳng 0.9 vẫn ra "Khớp").
- **Phần trăm gần như không bao giờ hiện:** chưa đăng ký, không thấy mặt, ml-service chậm quá 5 giây đều bị bỏ qua
  im lặng.
- **Trợ lý ECAP khó dùng:** lời chào không nói làm được gì; câu gợi ý "Quy định làm việc từ xa" không có tài
  liệu demo nào trả lời được.

Đã sửa:
- **Ký điểm:** ml-service trả token HMAC-SHA256 gồm tổ chức, người dùng, điểm, SHA-256 của ảnh, hạn 5 phút; khoá
  suy ra từ `INTERNAL_SHARED_SECRET` với nhãn riêng. hrm-service chỉ nhận điểm qua `faceMatchToken` khi chữ ký,
  người gọi, hạn và hash ảnh chấm công đều khớp; sai thì bỏ điểm, ghi log, chấm công vẫn thành công. Đổi quyết
  định "không ký" ghi ở `Technical_Spec.md` §24.
- **Hiển thị:** thông báo sau chấm công ghi ngay phần trăm và ngưỡng khớp, hoặc lý do không đối chiếu được;
  tooltip badge ghi phần trăm và ngưỡng; Hồ sơ cá nhân có nút "Thử nhận diện" (không tạo bản ghi chấm công).
- **Trợ lý ECAP:** lời chào chia "Mình có thể giúp" / "Chưa hỗ trợ" / mẹo, bám đúng 5 công cụ; câu gợi ý đổi sang
  "Làm thêm giờ tối đa bao nhiêu giờ một tháng?" và thêm "Quên chấm công thì tôi phải làm gì?"; khung trống không
  còn tự cuộn xuống cuối.

**Kết quả:**
- Kiểm thử đơn vị: hrm-service 130 test (10 ca mới cho token, có vector dùng chung với Python); ml-service 67 test;
  web 64 test ở hrm/chatbot/profile/face; typecheck, lint, `lint:i18n-strings` sạch.
- Kiểm tra sống qua Gateway sau khi build lại 3 image: `10-employee-directory.js` 47/47 (thêm D7a: chấm công đúng
  ảnh kèm token → khớp, điểm bằng điểm verify; D7b: dùng lại token cho ảnh khác → bỏ điểm), `02-hrm.js` 22/22
  (điểm thô 0.99 và token giả bị bỏ qua).
- Kiểm tra giao diện bằng trình duyệt: lời chào đủ 8 dòng phạm vi và 4 câu gợi ý; câu "làm thêm giờ" trả lời 40
  giờ/tháng kèm chip nguồn; check-in của tài khoản chưa đăng ký khuôn mặt báo đúng lý do (bản ghi thử đã xoá).

**Còn lại:** tệp demo `Hướng dẫn sử dụng web-app ECAP.pdf` vẫn liệt kê câu gợi ý cũ; lịch sử chấm công trong dữ
liệu seed không có điểm khuôn mặt; ngưỡng 0,35 chưa hiệu chỉnh trên dữ liệu thật.

Chi tiết kỹ thuật: `Technical_Spec.md` §23.9 và phần bổ sung cuối §24; giao diện: `Wireframe.md` §15; kịch bản:
`Mock_data.md` §4.2.

---

## 28/10/2026 (tiếp 3) — Tổ chức demo thứ hai: Nội thất An Gia

Để trả lời câu hỏi của giảng viên "ứng dụng có dùng cho loại doanh nghiệp khác được không" bằng minh chứng chạy
được: thêm bộ dữ liệu seed cho một công ty nội thất – xây dựng hư cấu, chạy trên cùng hệ thống, không sửa dòng code
ứng dụng nào.

- `scripts/seed-datasets/noi-that.js`: phòng ban, nhân viên, 5 công trình, khách hàng, cơ hội bán hàng, vật tư và
  kho, 2 tài liệu chính sách (viết bằng văn bản, sinh DOCX lúc seed — không thêm tệp nhị phân).
- `scripts/seed-datasets/index.js`: chọn bộ dữ liệu theo `SEED_DATASET`; `seed.js`, `seed-inventory.js`,
  `migrate-project-documents.js`, `seed-project-docs.js` lấy dữ liệu từ đó khi có, không đặt biến thì giữ nguyên
  dữ liệu công ty máy tính. `seed-inventory.js` bỏ qua tải ảnh cho sản phẩm không có ảnh.
- `npm run seed:noi-that` (`scripts/seed-noi-that.js`, cùng kiểu `seed-e2e.js`).

**Kết quả:** seed thành công (5 dự án, 42 công việc, 10 khách hàng, 12 vật tư, 2 kho, 2 tài liệu đã lập chỉ mục);
kiểm tra trên trình duyệt các trang chính của tổ chức mới không lỗi; Trợ lý ECAP trả lời từ sổ tay của công ty nội
thất. Chi tiết: `Mock_data.md` mục 12.
