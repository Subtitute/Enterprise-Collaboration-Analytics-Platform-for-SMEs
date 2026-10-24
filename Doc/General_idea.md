# General Idea — Nền tảng Cộng tác & Phân tích Dữ liệu cho Doanh nghiệp Vừa và Nhỏ

> Trạng thái: **ĐÃ TRIỂN KHAI** — toàn bộ phạm vi MVP (§3–§8) đã hoàn thành; phần lớn hạng mục
> "Phạm vi — Mở rộng" (§3) cũng đã triển khai (đánh dấu ~~gạch ngang~~ kèm ngày, gồm cả Nhận diện
> khuôn mặt cho Chấm công và chatbot nội bộ RAG, cùng bổ sung 24/10/2026), riêng CDC (Debezium) và
> dự báo xu hướng ML/thống kê vẫn chưa triển khai. Chi tiết lịch sử đầy đủ: xem `RevisionHistory.md`.

**Tên đề tài (VN):** Nền tảng Cộng tác Doanh nghiệp & Phân tích Dữ liệu cho Doanh nghiệp Vừa và Nhỏ
**Tên đề tài (EN):** Enterprise Collaboration & Analytics Platform for SMEs
**Loại đề tài:** Đồ án tốt nghiệp — Khoa Khoa Học Máy Tính
**Quy mô thực hiện:** 3 sinh viên, 1 học kỳ (~4 tháng)
**Ngày khởi tạo tài liệu:** 18/07/2026
**Múi giờ áp dụng cho toàn bộ hệ thống:** GMT+7 (Asia/Ho_Chi_Minh)

---

## 1. Đặt vấn đề

Các doanh nghiệp vừa và nhỏ (SME) tại Việt Nam hiện nay thường vận hành bằng một tập hợp rời rạc các công cụ không liên kết với nhau: Excel để quản lý công việc, Zalo/Messenger để trao đổi nội bộ, Google Drive để lưu tài liệu, và sổ sách giấy hoặc bảng tính riêng lẻ để chấm công. Hệ quả trực tiếp là:

- **Dữ liệu phân mảnh (data silo):** không có nơi duy nhất tổng hợp hoạt động của toàn doanh nghiệp.
- **Thiếu khả năng ra quyết định dựa trên dữ liệu:** lãnh đạo SME không có báo cáo, KPI, hay xu hướng theo thời gian thực để đánh giá hiệu suất đội nhóm, tiến độ dự án.
- **Chi phí phần mềm enterprise quá cao:** các giải pháp như SAP, Salesforce, Microsoft Viva được thiết kế cho tập đoàn lớn, chi phí license và triển khai vượt ngân sách của SME.
- **Thiếu tính mở rộng:** các công cụ rời rạc (Excel, Zalo) không thể mở rộng thành hệ thống phân tích dữ liệu khi doanh nghiệp tăng trưởng.

Đề tài này đặt ra bài toán: **xây dựng một nền tảng cộng tác nội bộ hợp nhất (CRUD nghiệp vụ theo kiến trúc microservices), đồng thời biến mọi hoạt động nghiệp vụ thành dữ liệu sự kiện (event) chảy vào một pipeline phân tích, để tạo ra dashboard, KPI, báo cáo thời gian thực và phân tích xu hướng** — với chi phí hạ tầng thấp (tự triển khai bằng Docker) và kiến trúc có thể mở rộng theo đúng nguyên lý phần mềm doanh nghiệp hiện đại.

## 2. Mục tiêu đề tài

### Mục tiêu tổng quát
Thiết kế và triển khai một nền tảng phần mềm dạng SaaS đa người thuê (multi-tenant), gồm hai trụ cột:
1. **Core Platform** — các module nghiệp vụ CRUD vận hành theo kiến trúc microservices, đóng gói bằng Docker.
2. **Analytics Pipeline** — hệ thống thu thập sự kiện (event) phát sinh từ Core Platform theo thời gian thực, xử lý và tổng hợp thành dashboard, KPI, báo cáo và phân tích xu hướng.

### Mục tiêu cụ thể
1. Thiết kế kiến trúc microservices với ranh giới nghiệp vụ (bounded context) rõ ràng, mỗi service sở hữu cơ sở dữ liệu riêng (database-per-service).
2. Xây dựng cơ chế event-driven bằng message broker (Kafka), áp dụng Outbox Pattern để đảm bảo tính nhất quán giữa ghi dữ liệu nghiệp vụ và phát sự kiện.
3. Xây dựng Analytics Service tiêu thụ sự kiện, tổng hợp theo thời gian thực và theo lô (batch rollup), lưu trữ vào cơ sở dữ liệu tối ưu cho truy vấn phân tích.
4. Xây dựng Dashboard bằng React hiển thị KPI, biểu đồ xu hướng, cập nhật thời gian thực qua WebSocket.
5. Áp dụng xác thực — phân quyền (JWT + RBAC) xuyên suốt toàn bộ nền tảng, hỗ trợ mô hình đa tổ chức (multi-tenant).
6. Đóng gói toàn bộ hệ thống bằng Docker/Docker Compose, có thể triển khai bằng một lệnh duy nhất trên máy đơn.
7. Viết tài liệu kỹ thuật, kiểm thử tự động ở mức tối thiểu chấp nhận được (unit test cho logic nghiệp vụ cốt lõi) để chứng minh tính đúng đắn của hệ thống.

## 3. Đối tượng và phạm vi

### Đối tượng sử dụng
Chủ doanh nghiệp, quản lý phòng ban và nhân viên tại các doanh nghiệp vừa và nhỏ (quy mô ước lượng 10–200 nhân sự) cần một công cụ cộng tác nội bộ đi kèm khả năng nhìn thấy bức tranh tổng thể qua dashboard.

### Phạm vi — MVP (bắt buộc hoàn thành trong học kỳ)
Do nguồn lực thực hiện là 1 sinh viên trong 1 học kỳ, phạm vi bắt buộc được giới hạn ở **5 service nghiệp vụ + 1 API Gateway**, đủ để chứng minh trọn vẹn cả hai trụ cột (Core Platform + Analytics Pipeline) mà không dàn trải quá mỏng. Chi tiết xem [Danh sách module](#4-danh-sách-module).

### Phạm vi — Mở rộng (không bắt buộc, chỉ thực hiện nếu còn thời gian)
Các hạng mục sau được xác định là **stretch goal**, không tính vào tiêu chí đạt của đồ án, tránh rủi ro trễ tiến độ:
- ~~Module Nhân sự/Chấm công (HRM-lite)~~ — **đã triển khai 05/08/2026**: service mới `apps/hrm-service` (chấm công photo-proof kèm ảnh chụp qua camera trình duyệt, ~~không nhận diện khuôn mặt~~ — xem dòng bổ sung 24/10/2026 ngay dưới, đã đảo ngược quyết định này; nghỉ phép có quy trình duyệt), tích hợp Gateway/RBAC/Kafka/Notification, bucket MinIO riêng, frontend `features/hrm`. Chi tiết xem `Technical_Spec.md` §17.
- ~~Nhận diện khuôn mặt cho Chấm công (verify 1:1, cảnh báo mềm)~~ — **đã triển khai 24/10/2026**: đảo ngược có chủ đích quyết định ban đầu ở trên, theo yêu cầu trực tiếp. `apps/ml-service` bổ sung nhận diện khuôn mặt bằng model pretrained có sẵn (không tự train); kết quả chỉ là tín hiệu tham khảo đính kèm ảnh chấm công, không bao giờ chặn check-in/out — mirror đúng triết lý cờ mềm GPS on-site/off-site đã có. Chi tiết xem `Technical_Spec.md` §24.
- ~~Module CRM-lite (khách hàng, cơ hội bán hàng)~~ — **đã triển khai 05/08/2026**: service mới `apps/crm-service` (Customer + Deal pipeline dạng Kanban 6 giai đoạn), tích hợp Gateway/RBAC/Kafka/Notification, frontend `features/crm`. Chi tiết xem `Technical_Spec.md` §16.
- ~~Observability hạ tầng (Prometheus + Grafana) tách biệt khỏi Analytics Dashboard nghiệp vụ~~ — **đã triển khai 04/08/2026**: `prometheus`/`grafana`/`kafka-exporter` trong `docker-compose.yml`, package dùng chung `packages/common-metrics` áp dụng cho toàn bộ 6 service nghiệp vụ + Gateway. Chi tiết xem `Technical_Spec.md` §15.
- Triển khai Kubernetes thay cho Docker Compose.
- CDC (Change Data Capture) bằng Debezium thay cho Outbox polling đơn giản.
- Dự báo xu hướng bằng mô hình thống kê/ML (forecasting) trong Analytics.
- ~~Lịch công ty (ngày lễ + sự kiện nội bộ) cho Org Admin~~ — **đã triển khai 15/09/2026** (theo góp ý của GVHD, không nằm trong danh sách mở rộng ban đầu): entity `CalendarEvent` mới trong `apps/hrm-service` (2 loại mục `HOLIDAY`/`EVENT`), 1 permission riêng `calendar:manage` chỉ Org Admin có, trang mới `/admin/calendar`. Chi tiết xem `Technical_Spec.md` mục "15/09/2026 (phản hồi GVHD)".
- ~~Chức năng "Quên mật khẩu" (trang + logic)~~ — **đã triển khai 15/09/2026** (theo góp ý của GVHD): entity `PasswordResetToken`, `EmailService` (nodemailer) gửi qua SMTP giả lập MailHog cho dev/demo, 2 trang mới `/forgot-password`/`/reset-password`. Chi tiết xem `Technical_Spec.md` mục "15/09/2026 (phản hồi GVHD)".
- ~~Ứng dụng đồng hành trên điện thoại Android (ECAP Mobile)~~ — **đã scaffold 06/08/2026, mở rộng 12/08/2026**: dự án Flutter/Dart tách biệt hoàn toàn ở tầng mã nguồn/build (`ecap-mobile/` — từ 12/08/2026 là thư mục con của repo này, thuần vì lịch sử commit chung, không dùng chung `node_modules`/pipeline build), chỉ gọi REST API có sẵn của Gateway (không sửa backend), phạm vi: chấm công (camera thật)/nghỉ phép/công việc (xem + đổi trạng thái)/tài liệu (xem + tải lên)/thông báo. Không có ngân sách cho iOS. Chi tiết xem `Doc/ECAP_Mobile.md`.
- ~~Phân tích KPI theo phòng ban (department) cho Project & Task / Analytics~~ — **đã triển khai 28/07/2026**, đúng theo hướng đã ghi nhận (enrichment qua event, không gắn cứng `departmentId` lên Project/Task): Analytics Service tự xây bảng chiều `dim_user` từ sự kiện IAM phát ra. Chi tiết xem Technical_Spec.md §4.6. *(Bổ sung 21/07/2026, cập nhật 28/07/2026.)*
- ~~Access-control chi tiết theo người dùng/phòng ban cho chia sẻ tài liệu (Document Service)~~ — **đã triển khai 28/07/2026** (đợt nâng cấp sau MVP, không phải trong phạm vi học kỳ ban đầu): opt-in theo từng thư mục, không đổi hành vi dữ liệu cũ. Chi tiết xem Technical_Spec.md mục "Access-control tài liệu theo thư mục". *(Bổ sung 21/07/2026, cập nhật 28/07/2026.)*
- ~~Tính năng AI (đợt đầu tiên) — "Nhận xét AI" bằng ngôn ngữ tự nhiên trên số liệu KPI~~ — **đã triển khai 28/07/2026**: gọi Google Gemini API (gói miễn phí, không tự lưu trữ mô hình cục bộ do điều kiện tài nguyên hiện tại) để sinh nhận xét tiếng Việt từ số liệu đã tổng hợp sẵn ở Analytics Service. Chi tiết xem Technical_Spec.md §4.7. Đây là hạng mục ĐẦU TIÊN trong loạt nâng cấp tính năng AI đã bàn bạc (còn lại: hỏi-đáp trên tài liệu nội bộ, trợ lý tạo việc bằng ngôn ngữ tự nhiên, cảnh báo rủi ro trễ hạn bằng mô hình thống kê/ML — xem thêm dòng "Dự báo xu hướng..." bên dưới, vẫn CHƯA triển khai). *(Bổ sung 28/07/2026.)*
- ~~Nhắn tin nội bộ giữa nhân viên cùng tổ chức~~ — **đã triển khai 28/09/2026**: nêu lần đầu 17/09/2026 nhưng chỉ tư vấn bằng lời lúc đó. Service mới `apps/messaging-service` (1:1 + nhóm/kênh, real-time qua WebSocket riêng, cố ý không dùng Kafka/Outbox và không cache identity cục bộ — xem lý do ở Technical_Spec.md §20), có mặt cả ở `apps/web` lẫn `ecap-mobile`. Chi tiết xem Technical_Spec.md §20. *(Bổ sung 28/09/2026.)*
- ~~Chatbot nội bộ "hỏi-đáp trên tài liệu nội bộ"~~ — **đã triển khai 24/10/2026** (kế hoạch chốt cùng ngày): chính là hạng mục AI còn treo từ 28/07/2026 (dòng "Nhận xét AI" ở trên). Mô hình lai — RAG thật (tìm kiếm vector) cho Tài liệu, tool-calling gọi thẳng API Gateway cho Dự án/Task/Chấm công/Nghỉ phép (dữ liệu đổi liên tục, không nên vector-hoá). Người dùng hỏi qua nút chat nổi trên mọi trang; câu trả lời chỉ dựa trên dữ liệu người hỏi vốn được xem, kèm nguồn tài liệu bấm mở được; 30 câu hỏi/người/ngày. Đặc tả kỹ thuật đầy đủ: Technical_Spec.md §23. *(Bổ sung 24/10/2026.)*

### Ngoài phạm vi (Non-goals)
- Không xây dựng ứng dụng mobile native (chỉ web responsive).
- Không triển khai high-availability/multi-region (đồ án chạy trên một máy chủ/máy cá nhân duy nhất).
- Không tích hợp thanh toán, hóa đơn điện tử hay các nghiệp vụ kế toán/tài chính.
- ~~Không xây cơ chế đa ngôn ngữ (i18n) đầy đủ — giao diện tiếng Việt là mặc định.~~ — **đã triển khai 20-21/08/2026**: toàn bộ giao diện `apps/web` và thông báo lỗi backend hỗ trợ Việt/Anh/Nhật (nút chọn ngôn ngữ ở màn đăng nhập và mọi trang), tiếng Việt vẫn là mặc định, không đổi hành vi/chuỗi hiện có. Chi tiết xem `Technical_Spec.md` §18. `ecap-mobile` vẫn ngoài phạm vi này — tiếp tục 100% tiếng Việt như từ đầu (xem `Doc/ECAP_Mobile.md`).

## 4. Người dùng & vai trò (Actors)

**(Làm rõ 15/09/2026, sau phản hồi của GVHD — nhầm lẫn giữa "Admin" và "Org Admin")** Bảng dưới đây liệt kê 4 vai trò, nhưng chỉ **3 trong 4 vai trò đã thực sự được lập trình**: `Org Admin`, `Manager`, `Employee` — đây là 3 giá trị `Role.name` DUY NHẤT tồn tại trong hệ thống (`packages/common-dto/src/enums/permission.enum.ts` → `DefaultRoleName`), được `RolesService.seedDefaultRoles()` (iam-service) tự tạo cho MỌI tổ chức mới đăng ký, và là 3 nhãn DUY NHẤT hiển thị trên giao diện (Quản trị > Thành viên, ma trận Vai trò & Phân quyền...). **Không có vai trò nào tên là "Admin" (khác với "Org Admin") trong hệ thống** — nếu thấy nhãn "Quản trị" ở đâu đó (menu Topbar, tiêu đề khu vực trang), đó là tên của MỤC MENU (khu vực trang dành cho Org Admin), không phải tên 1 vai trò riêng biệt.

`Super Admin` **đã được lập trình từ 16/09/2026** — trước đó (tính đến bản rà soát 15/09/2026),
đây là vai trò DUY NHẤT trong bảng dưới đây chưa từng được lập trình, chỉ tồn tại như một khái niệm
định hướng (quản trị nhiều tổ chức/toàn nền tảng) từ lúc khởi tạo tài liệu (18/07/2026). Phạm vi
triển khai thực tế cố ý HẸP hơn định hướng ban đầu: Super Admin CHỈ quản lý được vòng đời của entity
`Organization` (xem danh sách, khoá/mở khoá 1 tổ chức) trong `iam-service` — KHÔNG nhìn xuyên/thao
tác được dữ liệu nghiệp vụ (dự án, tài liệu, khách hàng, chấm công, báo cáo...) của bất kỳ tổ chức
nào, giữ nguyên bất biến "đa tổ chức, không tổ chức nào nhìn xuyên tổ chức khác" cho MỌI dữ liệu
nghiệp vụ. Đây KHÔNG phải 1 `Role`/`Permission` theo tổ chức như 3 vai trò còn lại (cột
`User.isSuperAdmin` riêng, tách biệt hoàn toàn khỏi ma trận RBAC theo tổ chức) và không có luồng tự
đăng ký — tài khoản đầu tiên được tạo tự động qua biến môi trường lúc `iam-service` khởi động. Chi
tiết đầy đủ: `Technical_Spec.md` mục "16/09/2026 (tính năng mới: Super Admin)".

| Vai trò | Mô tả | Quyền hạn chính | Trạng thái |
|---|---|---|---|
| **Super Admin** | Quản trị viên nền tảng, quản lý vòng đời tổ chức trên nền tảng | Xem danh sách, khoá/mở khoá từng tổ chức (tenant) đã đăng ký; xem số liệu tổng quan nền tảng | ✅ Đã lập trình (16/09/2026) |
| **Org Admin** | Chủ doanh nghiệp / quản trị viên của một tổ chức | Quản lý user, phòng ban, phân quyền trong tổ chức mình | ✅ Đã lập trình |
| **Manager** | Trưởng phòng/trưởng nhóm | Quản lý dự án, công việc, tài liệu của phòng ban; xem dashboard phòng ban | ✅ Đã lập trình |
| **Employee** | Nhân viên | Thao tác CRUD trong phạm vi được giao (task, tài liệu), xem thông báo | ✅ Đã lập trình |

Mô hình đa tổ chức (multi-tenant, shared-schema với `organization_id` trên mọi bảng nghiệp vụ) cho phép nền tảng phục vụ nhiều SME độc lập trên cùng một lần triển khai — đúng với chữ "SMEs" (số nhiều) trong tên đề tài. **Lưu ý:** đây là "đa người thuê" (nhiều tổ chức dùng chung 1 lần triển khai), khác với "Super Admin quản lý được nhiều tổ chức" — 2 khái niệm độc lập nhau. Từ 16/09/2026, Super Admin là NGOẠI LỆ DUY NHẤT nhìn xuyên được nhiều tổ chức, nhưng CHỈ ở phạm vi entity `Organization` (xem/khoá/mở khoá tổ chức) — mọi dữ liệu nghiệp vụ khác (dự án, tài liệu, khách hàng, chấm công, báo cáo...) vẫn do guard/middleware lọc cứng theo `organizationId` của chính người gọi như trước, kể cả với Org Admin (xem §6 `Technical_Spec.md`, và mục "16/09/2026 (tính năng mới: Super Admin)" để biết chi tiết ranh giới này).

## 5. Tổng quan giải pháp

Giải pháp gồm hai trụ cột vận hành song song, liên kết qua một event backbone (Kafka):

```
   [ Core Platform: các microservice CRUD ]
                    │  mọi thay đổi trạng thái nghiệp vụ
                    │  → phát sự kiện (Outbox → Kafka)
                    ▼
   [ Analytics Pipeline: consume → aggregate → store → serve ]
                    │
                    ▼
   [ Dashboard: KPI, biểu đồ xu hướng, cập nhật real-time ]
```

Chi tiết kiến trúc, công nghệ và các quyết định kỹ thuật được trình bày đầy đủ trong [Technical_Spec.md](Technical_Spec.md).

## 6. Danh sách module

| # | Module (Service) | Mô tả ngắn | Thuộc phạm vi |
|---|---|---|---|
| 1 | **API Gateway** | Cổng vào duy nhất: xác thực JWT, định tuyến, rate limiting | MVP |
| 2 | **IAM Service** | Đăng ký/đăng nhập, Organization (tenant), User, Department, Role/Permission (RBAC) | MVP |
| 3 | **Project & Task Service** | Quản lý Dự án, Công việc (Kanban: Todo/Doing/Done), Comment, phân công | MVP |
| 4 | **Document Service** | Quản lý Thư mục/Tệp tin, upload, chia sẻ nội bộ, versioning đơn giản | MVP |
| 5 | **Notification Service** | Nhận sự kiện, lưu và đẩy thông báo real-time (WebSocket) | MVP |
| 6 | **Analytics Service + Dashboard** | Kafka consumer, tổng hợp KPI, lưu trữ time-series, API + dashboard React | MVP |
| 7 | HRM-lite Service | Chấm công (check-in/out), nghỉ phép | Đã triển khai (05/08/2026) |
| 8 | CRM-lite Service | Khách hàng, cơ hội bán hàng (deal pipeline) | Đã triển khai (05/08/2026) |
| 9 | Messaging Service | Nhắn tin nội bộ 1:1 + nhóm/kênh, real-time qua WebSocket riêng | Đã triển khai (28/09/2026) |

## 7. Ví dụ đầu ra minh họa (Dashboard/KPI)

Để cụ thể hóa "giá trị phân tích" mà đề tài hướng tới, dashboard MVP sẽ hiển thị tối thiểu các chỉ số sau (dữ liệu tổng hợp từ sự kiện của các module MVP):

- **Tỷ lệ hoàn thành công việc** theo dự án, theo tuần (line chart xu hướng). *(Điều chỉnh 21/07/2026: bỏ chiều "phòng ban" — `Project`/`Task` không lưu `departmentId`; phân tích theo phòng ban chuyển thành hướng mở rộng, xem Technical_Spec.md §14.)*
- **Số lượng công việc theo trạng thái** hiện tại (Todo/Doing/Done) — biểu đồ donut/bar.
- **Hoạt động tài liệu**: số tệp được tải lên/chia sẻ theo ngày (bar chart).
- **Hoạt động người dùng theo thời gian thực**: feed hoạt động gần nhất (real-time activity feed qua WebSocket).
- **Tiến độ dự án tổng thể**: % công việc hoàn thành trên tổng số, so sánh giữa các dự án.

## 8. Tiêu chí thành công (Definition of Done)

Đồ án được xem là đạt mục tiêu khi:
1. Toàn bộ 6 service MVP chạy đồng thời bằng `docker compose up` trên một máy duy nhất, không lỗi.
2. Người dùng có thể đăng ký tổ chức, đăng nhập, thực hiện đầy đủ CRUD trên Project/Task và Document.
3. Một thao tác nghiệp vụ (ví dụ: đổi trạng thái task) phản ánh trên Dashboard trong vòng vài giây mà không cần tải lại trang (chứng minh tính real-time của pipeline).
4. Notification được đẩy tới người dùng liên quan ngay khi sự kiện xảy ra.
5. Có tài liệu kiến trúc, API documentation (Swagger) và bộ unit test tối thiểu cho logic nghiệp vụ cốt lõi của mỗi service.

## 9. Rủi ro & giả định

| Rủi ro | Mức độ | Biện pháp giảm thiểu |
|---|---|---|
| Đường cong học tập Kafka + event-driven architecture với 1 sinh viên | Cao | Bắt đầu bằng Outbox polling đơn giản thay vì CDC; ưu tiên chạy được pipeline tối giản trước khi tối ưu |
| Timeline 4 tháng cho 6 service + dashboard là chặt | Cao | Giới hạn phạm vi MVP nghiêm ngặt (§3); các module mở rộng chỉ làm nếu còn dư thời gian |
| Độ phức tạp vận hành Docker Compose với nhiều container (DB riêng cho từng service, Kafka, Redis, MinIO) | Trung bình | Viết `docker-compose.yml` theo từng giai đoạn, kiểm thử tăng dần từng service một |
| Thiếu kinh nghiệm thiết kế multi-tenant | Trung bình | Áp dụng mô hình đơn giản nhất (shared-schema, cột `organization_id`), không triển khai database-per-tenant |
| Rủi ro dữ liệu demo không đủ phong phú để dashboard "có ý nghĩa" | Trung bình | Xây script seed dữ liệu giả lập (fake data generator) chạy được nhiều kịch bản theo thời gian |

**Giả định:** Đồ án được đánh giá trên môi trường demo cục bộ (local/VPS đơn), không yêu cầu chịu tải sản xuất thực tế; hội đồng chấp nhận kiến trúc "sẵn sàng mở rộng về mặt thiết kế" (designed-for-scale) hơn là đã được kiểm chứng ở quy mô lớn.

## 10. Timeline tổng quan (16 tuần)

| Giai đoạn | Tuần | Nội dung |
|---|---|---|
| 1. Đề cương & thiết kế | 1–2 | Hoàn thiện 3 tài liệu nền tảng (General_idea, Technical_Spec, Wireframe), thiết kế ERD chi tiết |
| 2. Hạ tầng nền | 3–4 | Dựng khung monorepo, Docker Compose cho hạ tầng (Postgres, Kafka, Redis, MinIO), IAM Service |
| 3. Core modules | 5–9 | Project & Task Service, Document Service, API Gateway, tích hợp Outbox → Kafka |
| 4. Analytics pipeline | 10–12 | Analytics Service (consumer + aggregation), Notification Service, Dashboard React (KPI, biểu đồ, real-time) |
| 5. Hoàn thiện & kiểm thử | 13–14 | Unit test, seed dữ liệu demo, sửa lỗi, tối ưu UX |
| 6. Module mở rộng (nếu còn thời gian) | 15 | HRM-lite hoặc CRM-lite (tùy chọn) |
| 7. Viết báo cáo & bảo vệ | 16 | Hoàn thiện báo cáo, chuẩn bị demo và slide bảo vệ |

## 11. Thuật ngữ (Glossary)

| Thuật ngữ | Giải thích |
|---|---|
| SME | Small and Medium Enterprise — Doanh nghiệp vừa và nhỏ |
| Tenant | Một tổ chức (doanh nghiệp) độc lập sử dụng chung nền tảng |
| Bounded Context | Ranh giới nghiệp vụ rõ ràng của một service trong kiến trúc microservices |
| Outbox Pattern | Kỹ thuật đảm bảo phát sự kiện nhất quán với thay đổi dữ liệu nghiệp vụ trong cùng transaction |
| KPI | Key Performance Indicator — Chỉ số hiệu suất cốt lõi |
| RBAC | Role-Based Access Control — Kiểm soát truy cập theo vai trò |

---

## Lịch sử thay đổi tài liệu

> Theo quy định của đồ án: mọi lần chỉnh sửa, tái cấu trúc, thêm/bớt nội dung đều phải ghi nhận ngày và nội dung thay đổi tại đây.

- **18/07/2026** — Khởi tạo tài liệu `General_idea.md`: xác định bài toán, mục tiêu, phạm vi MVP/mở rộng, actor, danh sách module, tiêu chí thành công, rủi ro và timeline tổng quan cho đồ án.
- **21/07/2026** — Sau khi hoàn thành build MVP, tiến hành rà soát toàn diện (code review theo vai trò giảng viên phản biện) và điều chỉnh tài liệu theo kết quả: chuyển "KPI theo phòng ban" (§7) và "access-control chi tiết cho chia sẻ tài liệu" sang Phạm vi — Mở rộng (§3), do hạn chế kiến trúc hiện tại (`Project`/`Task` chưa có `departmentId`; `FileShare` mới dừng ở mức hiển thị). Chi tiết đầy đủ của đợt rà soát nằm ở `Technical_Spec.md §14`.
- **28/07/2026** — Bắt đầu loạt nâng cấp sau MVP đã lên kế hoạch (thứ tự: chất lượng Frontend → Dead Letter Queue/access-control tài liệu/KPI theo phòng ban → tính năng AI). Đợt đầu tiên (chất lượng Frontend) bổ sung bộ kiểm thử E2E (Playwright, workspace `e2e/`) — phần còn thiếu cuối cùng của tiêu chí §8.5 (unit test tối thiểu) nay đã có thêm một lớp kiểm thử luồng người dùng thật trên trình duyệt, không chỉ dừng ở unit test logic nghiệp vụ. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md`, mục 28/07/2026.
- **28/07/2026 (tiếp)** — Đợt 2 (Dead Letter Queue) và đợt 3 (access-control tài liệu theo thư mục) của cùng loạt nâng cấp hoàn tất. §3: mục "Access-control chi tiết theo người dùng/phòng ban cho chia sẻ tài liệu" chuyển từ Phạm vi — Mở rộng sang **đã triển khai** (xem §3 đã sửa). Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md`, các mục cùng ngày.
- **28/07/2026 (tiếp, đợt 4 — cuối loạt nâng cấp trước tính năng AI)** — "Phân tích KPI theo phòng ban" (§3) chuyển từ Phạm vi — Mở rộng sang **đã triển khai**. Đến đây, loạt nâng cấp 4 hạng mục đã thống nhất (Frontend, Dead Letter Queue, access-control tài liệu, KPI theo phòng ban) đã hoàn tất toàn bộ; hạng mục còn lại (tính năng AI) chưa bắt đầu. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §4.6.
- **28/07/2026 (kiểm tra tổng thể + bắt đầu tính năng AI)** — Trước khi bắt đầu tính năng AI, thực hiện một đợt kiểm tra toàn diện hệ thống ("ultimate check": `typecheck`/`lint`/`build`/`test`/E2E toàn workspace, log container, Outbox, Kafka consumer lag, kiểm thử lại 3 tính năng vừa nâng cấp) — phát hiện và sửa 1 lỗi thật (test fixture thiếu trường) và 1 lỗ hổng thiết kế thật (phạm vi hiển thị DLQ bỏ sót nhóm lỗi nghiêm trọng nhất), dọn dữ liệu demo bị trùng lặp do seed nhiều lần. Chi tiết ở `Technical_Spec.md`, mục cùng ngày. Ngay sau đó, bắt đầu tính năng AI — hạng mục đầu tiên "Nhận xét AI" (§3, đã chuyển sang đã triển khai) chọn gọi Google Gemini API (gói miễn phí) thay vì tự lưu trữ mô hình cục bộ, do điều kiện tài nguyên hiện tại không phù hợp để tự host.
- **04/08/2026** — Dự án chuyển sang mô hình 3 người (chi tiết phân công tại `Doc/Script.md`, tài liệu mới). Phân công tạm thời (chờ xác nhận): CDC (Debezium) và dự báo xu hướng ML/thống kê trong Analytics giao cho thành viên thứ 3; frontend (`apps/web`) giao cho thành viên thứ 2, kèm 2 lớp bảo vệ để lỗi trên nhánh này không ảnh hưởng `main` (container `web` không bị service backend nào phụ thuộc trong `docker-compose.yml`; pipeline CI hiện có — `Technical_Spec.md` §11 — chạy `typecheck`/`lint`/`build`/`test` toàn workspace trên mọi Pull Request). Cùng đợt: chuẩn hoá 2 file `README.md` (gốc và `e2e/`) từ tiếng Việt không dấu sang có dấu đầy đủ. Bắt đầu triển khai 2 hạng mục mở rộng còn lại theo đúng thứ tự Observability → CRM-lite → HRM-lite (chi tiết kỹ thuật từng hạng mục cập nhật vào `Technical_Spec.md`/`Wireframe.md` khi hoàn tất).
- **04/08/2026 (tiếp, Observability)** — Hạng mục đầu tiên trong 2 hạng mục mở rộng còn lại đã hoàn tất và xác minh sống: §3 (Observability hạ tầng) chuyển sang đã triển khai. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §15.
- **05/08/2026 (CRM-lite)** — Hạng mục thứ hai trong 2 hạng mục mở rộng còn lại đã hoàn tất và xác minh sống: §3 và §6 (CRM-lite Service) chuyển sang đã triển khai. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §16. Còn lại duy nhất HRM-lite trong danh sách mở rộng đã thống nhất ban đầu.
- **05/08/2026 (HRM-lite, tiếp)** — Hạng mục cuối cùng trong danh sách mở rộng đã thống nhất ban đầu, hoàn tất và xác minh sống cùng ngày: §3 và §6 (HRM-lite Service) chuyển sang đã triển khai. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §17. **Toàn bộ danh sách mở rộng ban đầu đã hoàn tất, trừ CDC (Debezium) và dự báo xu hướng ML/thống kê — 2 hạng mục này tạm giao Thiều Quang Thành theo `Doc/Script.md`, chưa triển khai.**
- **06/08/2026 (rà soát toàn diện + ECAP Mobile)** — Rà soát lại toàn bộ hệ thống sau đợt Observability/CRM-lite/HRM-lite (typecheck/lint/build/test toàn workspace, kiểm tra container, Prometheus target — không phát hiện lỗi code, chỉ có 1 sai lệch tài liệu đã sửa, xem `Technical_Spec.md` mục cùng ngày). Ngay sau đó, bắt đầu hạng mục mới ngoài danh sách mở rộng ban đầu: **ECAP Mobile**, ứng dụng đồng hành trên Android (§3). Quyết định kiến trúc chính: dựng thành repo Flutter/Dart hoàn toàn tách biệt (`ecap-mobile`) thay vì đóng gói lại `apps/web` bằng WebView, để đảm bảo tách bạch thật sự giữa các phần của dự án (cùng tinh thần đã áp dụng cho nhánh frontend — `Doc/Script.md` §4); không sửa bất kỳ dòng nào ở backend. Chi tiết kỹ thuật đầy đủ ở `Doc/ECAP_Mobile.md`.
- **20/08/2026 → 21 (Đa ngôn ngữ Việt/Anh/Nhật)** — Mục "Ngoài phạm vi" (§3) — dòng "không xây cơ chế đa ngôn ngữ" chuyển sang **đã triển khai**: toàn bộ giao diện `apps/web` và thông báo lỗi nghiệp vụ/validate của backend nay hỗ trợ Việt (mặc định)/Anh/Nhật. Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §18. `ecap-mobile` không nằm trong phạm vi thay đổi này.
- **15/09/2026 (làm rõ vai trò — phản hồi của GVHD)** — §4 (Người dùng & vai trò) bổ sung cột "Trạng thái" và ghi chú rõ: chỉ 3/4 vai trò trong bảng đã thực sự lập trình (`Org Admin`/`Manager`/`Employee`, seed tự động cho mọi tổ chức mới); `Super Admin` CHƯA từng được lập trình, chỉ là khái niệm định hướng từ 18/07/2026 — không có "vai trò Admin" nào khác "Org Admin" trong hệ thống. Không phải lỗi code (đã xác minh qua rà soát mã nguồn trực tiếp), chỉ là bảng vai trò ban đầu không phân biệt rõ "đã lập trình" và "định hướng tương lai", gây hiểu nhầm. Chi tiết đầy đủ: `Doc/RevisionHistory.md` mục "15/09/2026 (phản hồi GVHD)".
- **15/09/2026 (3 hạng mục còn lại — phản hồi của GVHD)** — Cùng đợt phản hồi ở trên, 3 mục còn lại: (1) sửa lỗi thật ở chức năng "Nghỉ phép" — `DatePicker.tsx` khai báo prop `minDate` nhưng chưa từng dùng tới (dead prop), cho phép chọn ngày quá khứ; vá cả frontend lẫn backend (`hrm-service`), thêm mã lỗi `LEAVE_START_DATE_IN_PAST`. (2) Mục "Phạm vi — Mở rộng" bổ sung 2 dòng mới: "Lịch công ty" (ngày lễ + sự kiện, chỉ Org Admin) và "Quên mật khẩu" (trang + logic + hạ tầng gửi email demo qua MailHog) — cả 2 đã triển khai đầy đủ, xem 2 dòng ngay phía trên trong mục "Phạm vi — Mở rộng". Chi tiết kỹ thuật đầy đủ cho cả 3 hạng mục: `Technical_Spec.md` và `Doc/RevisionHistory.md`, cùng mục "15/09/2026 (phản hồi GVHD)".
- **16/09/2026 (Super Admin)** — §4 (Người dùng & vai trò) — dòng "Super Admin" trong bảng vai trò chuyển từ "⏳ Chưa lập trình" sang **✅ Đã lập trình**, phạm vi thực tế cố ý HẸP hơn định hướng ban đầu (chỉ quản lý vòng đời entity `Organization`, không nhìn xuyên dữ liệu nghiệp vụ của bất kỳ tổ chức nào). Cập nhật lại ghi chú đa-tổ-chức ngay bên dưới bảng cho khớp (Super Admin nay là ngoại lệ DUY NHẤT nhìn xuyên nhiều tổ chức, nhưng chỉ ở phạm vi đó). Chi tiết kỹ thuật đầy đủ: `Technical_Spec.md` và `Doc/RevisionHistory.md`, cùng mục "16/09/2026 (tính năng mới: Super Admin)". Cùng ngày, cũng đã giải quyết xong đợt merge nhánh `frontend` thứ 3 của Tiến (23 file conflict + các hồi quy phát sinh) — xem `Doc/RevisionHistory.md` mục "16/09/2026" để biết chi tiết, không lặp lại ở đây vì không ảnh hưởng tới nội dung tài liệu này.
- **28/09/2026 (Nhắn tin nội bộ)** — §3 bổ sung dòng mới: "Nhắn tin nội bộ giữa nhân viên cùng tổ chức" chuyển thẳng sang **đã triển khai** (nêu lần đầu 17/09/2026 nhưng chưa từng đặc tả trước đó). Service mới `apps/messaging-service` (1:1 + nhóm/kênh), có mặt cả ở `apps/web` lẫn `ecap-mobile`. Chi tiết kỹ thuật đầy đủ: `Technical_Spec.md` §20, `Doc/RevisionHistory.md` mục "28/09/2026 (tiếp — Nhắn tin nội bộ)".
- **24/10/2026 (Chatbot nội bộ RAG — kế hoạch)** — §3 bổ sung dòng mới: "Chatbot nội bộ hỏi-đáp trên tài liệu nội bộ" — chính là hạng mục AI còn treo từ 28/07/2026, nay được bàn bạc và chốt mô hình lai (RAG thật cho Tài liệu + tool-calling gọi API Gateway cho dữ liệu đổi liên tục) TRƯỚC khi code, theo yêu cầu trực tiếp. **Chỉ là kế hoạch, chưa có dòng code nào.** Đặc tả kỹ thuật đầy đủ: `Technical_Spec.md` §23. Theo dõi trạng thái: `Doc/Upgrade.md` Tier 5.
- **24/10/2026 (Nhận diện khuôn mặt cho Chấm công)** — §3 cập nhật: đảo ngược có chủ đích quyết định "không nhận diện khuôn mặt" của HRM-lite (05/08/2026), theo yêu cầu trực tiếp — verify 1:1 bằng model pretrained có sẵn, kết quả chỉ là tín hiệu tham khảo đính kèm ảnh chấm công, không bao giờ chặn check-in/out. Chi tiết kỹ thuật đầy đủ: `Technical_Spec.md` §24, `Doc/RevisionHistory.md` mục "24/10/2026 — Nhận diện khuôn mặt cho Chấm công".
- **24/10/2026 (Chatbot nội bộ RAG — triển khai)** — §3: dòng "Chatbot nội bộ hỏi-đáp trên tài liệu nội bộ" chuyển sang **đã triển khai** (gạch ngang + ngày), bổ sung mô tả ngắn cách người dùng sử dụng; khối trạng thái đầu file cập nhật tương ứng. Chi tiết kỹ thuật: `Technical_Spec.md` §23.
