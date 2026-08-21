# ECAP Mobile (Flutter) — Ứng dụng đồng hành trên điện thoại Android

Tài liệu đặc tả cho `ecap-mobile` — một dự án Flutter/Dart **độc lập ở tầng mã nguồn/build**
khỏi `Enterprise Collaboration and Analytics Platform for SMEs` (repo chính, sau đây gọi tắt là
"nền tảng"). Từ 12/08/2026, `ecap-mobile/` là thư mục con nằm TRONG repo Git của nền tảng (lý do
và lịch sử chuyển vị trí — xem "Lịch sử thay đổi tài liệu" — thuần tuý để có một lịch sử
commit/một chỗ lưu trữ duy nhất, KHÔNG đổi bất kỳ đặc điểm kỹ thuật nào mô tả ở mục 1 dưới đây:
vẫn không dùng chung mã nguồn, không dùng chung `node_modules`/npm workspaces, không có mặt
trong bất kỳ pipeline build nào của nền tảng (`package.json`/Docker Compose ở gốc repo giữ
nguyên, không thêm toolchain Flutter/Dart nào vào đó). Bổ sung 06/08/2026, sau khi Observability,
CRM-lite, HRM-lite đã hoàn tất.

## 1. Vì sao một dự án tách biệt ở tầng mã nguồn, thay vì đóng gói lại web app

Nền tảng đã có sẵn một React SPA (`apps/web`) hiển thị đầy đủ mọi nghiệp vụ. Có 2 hướng để
"đưa lên điện thoại":

1. Đóng gói `apps/web` bằng một lớp vỏ WebView (Capacitor) — nhanh, tái dùng gần như toàn bộ
   giao diện đã có, nhưng KHÔNG tạo ra sự tách biệt thật sự: đây vẫn là cùng một mã nguồn, nên
   một lỗi trong `apps/web` sẽ tự động xuất hiện trên "bản mobile" vì bản chất chỉ là một khung
   hiển thị khác của cùng một ứng dụng.
2. Viết một ứng dụng khách hoàn toàn độc lập (Flutter/Dart), chỉ gọi REST API của Gateway giống
   hệt cách `apps/web` đang gọi — đây là hướng đã chọn.

Lý do chọn (2): kiến trúc Gateway/REST API của nền tảng vốn đã trung lập với client (client-
agnostic) ngay từ đầu — không có gì trong 7 service nghiệp vụ giả định người gọi là trình
duyệt. Một ứng dụng khách hoàn toàn mới, ở một ngôn ngữ khác, không import bất kỳ dòng nào từ
`apps/web`, không chung `pubspec.yaml`/`package.json` hay pipeline build nào với nền tảng, là
cách duy nhất đảm bảo lỗi ở một bên (vd nhánh frontend web) không bao giờ lan sang bên còn lại —
đúng tinh thần tách bạch đã áp dụng cho nền tảng nói chung (`Doc/Script.md` mục 4). Ranh giới
tách biệt nằm ở TẦNG MÃ NGUỒN/BUILD (không import, không chung dependency, không chung Docker
image) — việc `ecap-mobile/` và phần còn lại của nền tảng có nằm trong cùng một repo Git hay
không là một quyết định KHÁC, độc lập với ranh giới này (xem đoạn mở đầu tài liệu).

**Hệ quả quan trọng: `ecap-mobile` không đổi bất kỳ dòng code nào của nền tảng.** Toàn bộ 7
service NestJS, `apps/web`, Docker Compose, test suite của nền tảng giữ nguyên 100%.
`ecap-mobile` chỉ là một client mới gọi các endpoint REST đã tồn tại sẵn và đã được xác minh
sống trong các đợt kiểm thử trước (Technical_Spec.md mục 16, 17).

## 2. Phạm vi — "ứng dụng đồng hành tập trung" (không phải bản sao toàn bộ nền tảng)

Chỉ bao phủ các luồng nghiệp vụ tự nhiên nhất trên điện thoại — vốn cũng là các luồng đã dùng
camera (giờ là camera thật của điện thoại thay vì webcam laptop trong bản demo web ban đầu):

- Đăng nhập / tự động đăng nhập lại.
- **Chấm công** (`HRM-lite`): chấm công vào làm/ra về kèm ảnh chụp bằng camera thật, xem lại
  trạng thái hôm nay và lịch sử.
- **Nghỉ phép**: tạo yêu cầu nghỉ phép mới, xem trạng thái các yêu cầu của chính mình.
- **Thông báo**: xem danh sách, đánh dấu đã đọc (từng cái hoặc tất cả).
- **Công việc** (bổ sung 12/08/2026 — xem mục 12): xem danh sách công việc được giao cho chính
  mình ở mọi dự án, đổi trạng thái theo đúng luồng TODO → DOING → DONE. Không có bảng Kanban
  kéo-thả, không tạo/xoá công việc mới trên điện thoại.
- **Tài liệu** (bổ sung 12/08/2026 — xem mục 12): duyệt cây thư mục, xem file trực tiếp (mở
  ngay trong trình duyệt/trình xem PDF mặc định của điện thoại, không tải về thủ công), tải file
  mới lên. Không tạo/xoá/đổi tên thư mục, không quản lý chia sẻ.
- Hồ sơ cá nhân (chỉ đọc) + đăng xuất.

**Cố ý KHÔNG đưa vào phạm vi này** (để giữ đúng tinh thần tối giản, ClaudeRule.md mục 8):
CRM (khách hàng/cơ hội bán hàng — quản lý pipeline bán hàng không phải thao tác tự nhiên trên
điện thoại, dù `Employee` có quyền `customer:view`/`deal:*`, xem tranh luận ở mục 12), Báo cáo &
Phân tích (biểu đồ), Quản trị (người dùng/vai trò/phòng ban), quản trị Dự án và Kanban kéo-thả
đầy đủ, quản trị thư mục/chia sẻ tài liệu, và chức năng duyệt/từ chối nghỉ phép (dành cho
Manager/Org Admin — vốn là thao tác quản trị, tự nhiên hơn khi thực hiện trên màn hình lớn của
web). Đây không phải giới hạn kỹ thuật — có thể mở rộng sau nếu cần, chỉ là phạm vi đã thống
nhất.

## 3. Không đổi backend — tái sử dụng đúng cơ chế xác thực đã có

`POST /api/v1/auth/login`/`refresh` của `iam-service` trả `refreshToken` qua **httpOnly
cookie** (`ecap_refresh_token`, giới hạn `path=/api/v1/auth`), không bao giờ trả trong JSON
body — cố ý, để chống XSS đọc cắp token (xem `Technical_Spec.md` mục 6, sửa 21/07/2026). Trình
duyệt xử lý cookie này tự động; một ứng dụng native thì không.

Thay vì mở lại token qua body cho riêng client mobile (sẽ làm yếu đúng lớp phòng thủ vừa nêu),
`ecap-mobile` dùng `dio` + `cookie_jar` (`PersistCookieJar`, lưu xuống bộ nhớ trong của app qua
`path_provider`) để mô phỏng lại đúng hành vi cookie jar của trình duyệt — cookie được gửi kèm
tự động cho các request tới `/auth/*`, và được ghi xuống đĩa nên mở lại app sau khi tắt không
bắt đăng nhập lại nếu cookie còn hạn (7 ngày, khớp `JWT_REFRESH_EXPIRES_IN`). Kết quả: **không
cần sửa bất kỳ dòng nào ở `apps/iam-service`.**

CORS cũng không phải vấn đề: `app.enableCors()` ở Gateway chỉ áp dụng cho request có header
`Origin` (khái niệm của trình duyệt) — một client native như Flutter (dùng `dio`, không phải
WebView) không bao giờ gửi header này, nên không bao giờ bị chặn bởi CORS.

`lib/core/api_client.dart` xử lý toàn bộ luồng trên: gắn `Authorization: Bearer <accessToken>`
(access token 15 phút, giữ trong bộ nhớ qua `AuthSession`, KHÔNG ghi đĩa) cho mọi request, và
tự gọi `/auth/refresh` một lần khi gặp `401` rồi thử lại request gốc (mirror hành vi phía web).

**(Bổ sung 20-21/08/2026, không đổi CNA)** Nền tảng thêm rollout đa ngôn ngữ (Việt/Anh/Nhật) cho
`apps/web` và mở rộng CỘNG THÊM 3 trường tùy chọn (`errorCode`/`errorParams`/`details`) vào body
lỗi JSON để phục vụ dịch thông báo phía web (`Technical_Spec.md` §18) — 4 trường gốc
(`statusCode`/`error`/`message`/`timestamp`) `_toApiException()` đang đọc giữ nguyên 100% giá trị
và hành vi. Đã xác minh trực tiếp bằng cách gọi thật `POST /api/v1/auth/login` sai mật khẩu qua
Gateway đã rebuild: response vẫn đúng hình dạng cũ, `message` tiếng Việt y hệt trước đây, chỉ có
thêm field lạ mà `_toApiException()` vốn đã bỏ qua (parse JSON→Map permissive). CNA tiếp tục
100% tiếng Việt, không có nút chọn ngôn ngữ, không cần sửa dòng nào.

## 4. Kết nối mạng — Wi-Fi/LAN, không cần cáp USB

Vì đây là ứng dụng native (không phải WebView proxy qua Nginx như hướng Capacitor đã cân
nhắc), ứng dụng gọi thẳng tới địa chỉ LAN của máy chạy Docker Compose:
`http://<IP-LAN-cua-may>:3000/api/v1` (cổng của `gateway`, xem `Enterprise Collaboration and
Analytics Platform for SMEs/README.md`). Cấu hình tại `lib/core/app_config.dart` — đổi hằng số
`gatewayBaseUrl` nếu chạy trên mạng khác (địa chỉ LAN của máy có thể đổi mỗi lần kết nối Wi-Fi
mới).

Yêu cầu duy nhất: điện thoại và máy chạy Docker Compose ở cùng mạng Wi-Fi/LAN, và Windows
Firewall cho phép kết nối đến vào cổng 3000 (đã xác minh có sẵn quy tắc cho phép trên máy phát
triển — xem mục 7). Vì backend hiện chỉ chạy HTTP thuần (không TLS, đúng quy ước môi trường
dev/demo cục bộ của toàn nền tảng), `AndroidManifest.xml` khai báo
`android:usesCleartextTraffic="true"`.

## 5. Cấu trúc thư mục

Từ 12/08/2026, `ecap-mobile/` là thư mục con ở gốc repo `Enterprise Collaboration and Analytics
Platform for SMEs` (cùng cấp với `apps/`, `packages/`, `Doc/` — xem đoạn mở đầu tài liệu). Cây
thư mục bên dưới là cấu trúc NỘI BỘ của `ecap-mobile/`, không đổi so với trước:

```
ecap-mobile/
  lib/
    main.dart                      # Diem vao - quyet dinh Login hay Home dua tren AuthSession
    core/
      app_config.dart              # Hang so fallback + URL cau hinh Gateway tu xa (muc 13.1)
      gateway_config.dart          # Giai quyet dia chi Gateway hien tai luc khoi dong app (muc 13.1)
      api_client.dart              # Dio + cookie jar + refresh-on-401 + upload anh multipart
      auth_session.dart            # Trang thai dang nhap trong bo nho (ChangeNotifier)
      date_format.dart             # Quy doi GMT+7 (ClaudeRule.md muc 4), khong dung thu vien timezone
    models/                        # AppUser, Attendance, LeaveRequest, NotificationItem, Task,
                                    # Project, FolderItem, DocumentFile, PaginatedResponse
    features/
      auth/login_page.dart
      attendance/attendance_page.dart      # Cham cong - chup anh bang image_picker (camera that)
      leave_requests/leave_requests_page.dart
      tasks/tasks_page.dart                # Cong viec cua toi - xem + doi trang thai (muc 12)
      documents/documents_page.dart        # Tai lieu - duyet thu muc, xem inline, tai len (muc 12)
      notifications/notifications_page.dart
      home_shell.dart              # Bottom navigation 6 tab + tab Ho so/dang xuat
  android/                         # Du an Android sinh boi `flutter create --platforms=android`
  test/widget_test.dart            # Test don vi cho ham thuan tuy (date/label) - xem muc 14
```

Không sinh các thư mục nền tảng khác (`ios/`, `web/`, `windows/`...) — `flutter create` chạy
với `--platforms=android`, đúng phạm vi "không có ngân sách iOS" đã nêu ban đầu.

## 6. Danh sách endpoint đã dùng (đều là API có sẵn của nền tảng)

| Method | Path | Dùng ở |
|---|---|---|
| POST | `/api/v1/auth/login` | `LoginPage` |
| POST | `/api/v1/auth/refresh` | `ApiClient.tryAutoLogin()`, tự động khi gặp `401` |
| POST | `/api/v1/auth/logout` | Tab Hồ sơ |
| POST | `/api/v1/attendance/check-in` (multipart, field `photo` + field text tuỳ chọn `latitude`/`longitude`) | `AttendancePage` |
| POST | `/api/v1/attendance/check-out` (multipart, field `photo` + field text tuỳ chọn `latitude`/`longitude`) | `AttendancePage` |
| GET | `/api/v1/attendance/me` | `AttendancePage` |
| POST | `/api/v1/leave-requests` | `LeaveRequestsPage` (dialog tạo mới) |
| GET | `/api/v1/leave-requests/me` | `LeaveRequestsPage` |
| GET | `/api/v1/notifications` | `NotificationsPage` |
| PATCH | `/api/v1/notifications/:id/read` | `NotificationsPage` |
| PATCH | `/api/v1/notifications/read-all` | `NotificationsPage` |
| GET | `/api/v1/tasks?limit=500` | `TasksPage` (lọc lại `assignees` chứa `userId` của mình ở client — API không có tham số lọc theo người phụ trách) |
| GET | `/api/v1/projects?limit=500` | `TasksPage` (dựng bản đồ `projectId` → tên dự án) |
| PATCH | `/api/v1/tasks/:id/status` | `TasksPage` (đổi trạng thái, chỉ hiện các bước hợp lệ theo `TASK_STATUS_TRANSITIONS`) |
| GET | `/api/v1/folders?parentFolderId=` | `DocumentsPage` (trả về **mảng thô**, khác mọi danh sách khác của nền tảng) |
| GET | `/api/v1/files?folderId=` | `DocumentsPage` |
| GET | `/api/v1/files/:id/download?disposition=inline` | `DocumentsPage` (mở `downloadUrl` bằng `url_launcher`, giống hệt "Xem tệp" của web) |
| POST | `/api/v1/files/upload` (multipart, field `file` + field `folderId`) | `DocumentsPage` (nút tải lên) |

Thông báo hiện lấy theo kiểu polling khi vào trang/kéo-để-làm-mới (`RefreshIndicator`), không
nối `/ws/notifications` (WebSocket real-time mà web đang dùng) — chấp nhận được cho phạm vi
bản đầu (mục 2); có thể bổ sung sau nếu cần cập nhật tức thời.

## 7. Xác minh đã thực hiện (06/08/2026)

- **Toolchain có sẵn trên máy phát triển**, không cần cài mới: Flutter 3.44.2 (kênh stable),
  Android SDK 36.1.0 (`platform-tools`, `build-tools`, NDK), JDK 21 đi kèm Android Studio
  (`flutter doctor` xác nhận toàn bộ mục Android toolchain đều pass — mục duy nhất KHÔNG pass
  là "Visual Studio - develop Windows apps", không liên quan tới build Android).
- `flutter analyze`: **không lỗi** (0 issues sau khi sửa 2 cảnh báo info ban đầu —
  `withOpacity` đổi sang `withValues`, và một doc-comment chứa `<T>` bị hiểu nhầm thành HTML).
- `flutter test`: **2/2 test qua** (test cho `todayGmt7DateString()` và
  `leaveRequestStatusLabelVi()` — 2 hàm thuần không phụ thuộc mạng/plugin nên kiểm thử được
  ngay; test cho luồng đăng nhập/chấm công đầy đủ cần mock `dio`/`path_provider`, để lại cho
  đợt mở rộng sau).
- `flutter build apk --debug`: **build thành công**, sinh
  `build/app/outputs/flutter-apk/app-debug.apk` (~143 MB — kích thước bình thường cho debug
  APK, chưa tối ưu/minify; bản `--release` sẽ nhỏ hơn nhiều).
- Cổng 3000 của `gateway` xác nhận truy cập được từ địa chỉ LAN của máy
  (`Test-NetConnection 192.168.1.40 -Port 3000` → `TcpTestSucceeded: True`) — không cần thêm
  quy tắc Windows Firewall thủ công.
- **Chưa xác minh trên thiết bị Android thật** (cài APK qua `adb install` và chạy thử luồng
  đăng nhập/chấm công/nghỉ phép end-to-end với stack Docker thật) — bước tiếp theo hợp lý
  trước khi dùng để trình bày.

## 8. Rà soát lỗi (07/08/2026)

Sau khi báo cáo scaffold hoàn tất, người dùng thử lệnh sai cú pháp (`flutter run build apk` —
`flutter run` không nhận tham số con `build apk`; đúng ra là 2 lệnh riêng: `flutter run` để
chạy trực tiếp, `flutter build apk` để đóng gói) và yêu cầu rà soát lại toàn bộ mã nguồn của
`ecap-mobile`. Đọc lại từng file kèm đối chiếu trực tiếp với API thật của backend (không chỉ
đọc lại code của chính mình) phát hiện 4 lỗi thật, đã sửa toàn bộ:

- **Lỗi nghiêm trọng — vỡ (crash) trên MỌI lỗi validate dữ liệu:** `ApiClient._toApiException()`
  ép cứng `data['message'] as String`, nhưng `vietnameseValidationExceptionFactory`
  (`packages/common-guard`) LUÔN trả `message` dạng **mảng chuỗi**, kể cả khi chỉ có 1 lỗi
  (khác với các exception nghiệp vụ khác như `UnauthorizedException('...')` trả `message` dạng
  chuỗi đơn) — `AllExceptionsFilter` không chuẩn hoá lại 2 dạng này về cùng 1 kiểu. Hậu quả: bất
  kỳ lỗi 400 nào từ validate DTO (vd bỏ trống lý do nghỉ phép, chọn thiếu ngày) sẽ ném
  `TypeError` ngay trong khối `catch`, thay vì hiện thông báo lỗi tiếng Việt cho người dùng. Sửa
  bằng cách kiểm tra kiểu trước khi ép (`String` dùng thẳng, `List` nối bằng `; `).
- **Lỗi logic — có thể lặp vô hạn khi refresh token:** interceptor tự làm mới access token khi
  gặp `401` gọi lại chính request gốc qua `_dio.fetch()`, vốn đi lại qua TOÀN BỘ chain
  interceptor (gọi lại chính `onError` nếu request lặp lại vẫn `401`) — trước đó không có cờ
  đánh dấu "đã thử lại", nên một request cứ `401` liên tục (không phải do token hết hạn) có thể
  khiến `onError` gọi đệ quy vô hạn. Sửa bằng cờ `extra['ecapRetried']`, giới hạn đúng 1 lần thử
  lại cho mỗi request gốc.
- **Lỗi UX — nút chấm công như không phản hồi khi từ chối quyền camera:** `AttendancePage`
  gọi `ImagePicker().pickImage()` NẰM NGOÀI khối `try/catch` — nếu quyền camera bị từ chối hoặc
  camera không khả dụng (`PlatformException`), lỗi này không được bắt ở đâu cả, người dùng chỉ
  thấy nút bấm không có phản ứng gì thay vì một thông báo lỗi rõ ràng. Sửa bằng cách đưa lệnh
  gọi camera vào trong `try`, thêm nhánh `catch (_)` chung cho các lỗi không phải `ApiException`.
- **Lỗi UX — thông báo lỗi cũ không tự biến mất:** cả 3 trang danh sách (`AttendancePage`,
  `LeaveRequestsPage`, `NotificationsPage`) chỉ ĐẶT `_errorMessage` khi tải thất bại, không bao
  giờ XOÁ khi bắt đầu một lần tải mới — dẫn tới thông báo lỗi của lần tải trước vẫn hiển thị
  ngay cả khi lần tải lại (kéo-để-làm-mới) sau đó đã thành công. Sửa bằng cách đặt
  `_errorMessage = null` cùng lúc bật `_loading = true` ở đầu mỗi hàm tải dữ liệu.

Tiện thể sửa luôn 1 điểm chưa tối ưu (không phải lỗi, nhưng liên quan trực tiếp tới cùng đoạn
code vừa sửa): `_refresh()` trước đó chỉ cập nhật `accessToken`, bỏ qua field `user` mà
`/auth/refresh` đã trả kèm — nay cập nhật cả hai để hồ sơ hiển thị không bị cũ nếu quyền/vai
trò đổi giữa lúc dùng app. Xoá luôn `AuthSession.updateAccessToken()` (không còn nơi nào gọi sau
thay đổi này).

**Xác minh sau khi sửa:** `flutter analyze` (0 lỗi), `flutter test` (2/2 qua),
`flutter build apk --debug` (build lại thành công, ~92 giây nhờ cache Gradle đã ấm từ lần build
trước).

## 9. Thương hiệu ứng dụng — "CollabNAnalytic" (CNA)

Bổ sung 08/08/2026: đặt tên hiển thị chính thức và icon cho ứng dụng.

- **Tên:** "CollabNAnalytic", viết tắt "CNA". Cả 2 dạng đều được dùng, đúng chỗ:
  `AndroidManifest.xml` khai báo `android:label="CollabNAnalytic"` ở `<application>` (dùng cho
  Cài đặt > Ứng dụng, hộp thoại xin quyền) nhưng `android:label="CNA"` riêng ở `<activity
  android:name=".MainActivity">` (activity launcher) — tên đầy đủ 15 ký tự bị nhiều launcher
  Android cắt bớt thành "..." khi hiển thị dưới icon trên màn hình chính/khay ứng dụng, "CNA"
  hiển thị đủ, không bị cắt. `MaterialApp.title` (`lib/main.dart`) và tiêu đề trên màn hình đăng
  nhập (`lib/features/auth/login_page.dart`) dùng tên đầy đủ "CollabNAnalytic" vì có đủ chỗ
  hiển thị. Tên gói Dart nội bộ (`ecap_mobile` trong `pubspec.yaml`, `package:ecap_mobile/...`
  trong mọi câu lệnh `import`) giữ nguyên — đây là định danh kỹ thuật không hiển thị cho người
  dùng, đổi nó kéo theo sửa lại toàn bộ import trong dự án mà không mang lại lợi ích nào.
- **Icon:** lấy từ `Pic/Icon.png` (repo chính, `The Finale/Pic/`, ảnh vuông bo góc 1024×1024,
  đã có sẵn hình khối/nền, dùng thẳng làm icon "legacy" — không cần tách lớp adaptive icon).
  Sao chép vào `assets/icon/icon.png` trong `ecap-mobile` (`Pic/` nằm ngoài repo Git — không chỉ
  ngoài `ecap-mobile/` — nên không thể tham chiếu trực tiếp, phải sao chép vào bên trong cây thư
  mục được theo dõi), dùng gói `flutter_launcher_icons` (dev-dependency, chỉ chạy 1 lần
  lúc build, không phải dependency lúc chạy app) sinh lại toàn bộ `mipmap-{m,h,x,xx,xxx}dpi` ở
  `android/app/src/main/res/`. Lệnh sinh icon: `flutter pub run flutter_launcher_icons` — lưu ý
  dùng `flutter pub run` chứ KHÔNG phải `dart run flutter_launcher_icons`, vì `dart run` (khác
  với các lệnh con của `flutter`) gọi một bước kiểm tra phiên bản engine cần `git`, và máy phát
  triển hiện chưa cài Git (xem mục 14).

**Xác minh:** rebuild `flutter build apk --debug` thành công; dùng `aapt dump badging` trên APK
đã build xác nhận đúng `application: label='CollabNAnalytic'` và
`launchable-activity: ... label='CNA'`, cùng 5 icon mipmap trỏ đúng tới ảnh mới.

## 10. Kết nối qua Internet — Cloudflare Tunnel (10/08/2026)

Bối cảnh: cộng tác viên Nguyễn Lê Tiến thử đăng nhập bằng CNA nhưng không cùng mạng Wi-Fi/LAN
với máy chạy Docker Compose — theo đúng thiết kế ở mục 4, trường hợp này KHÔNG kết nối được
(`192.168.1.40` là địa chỉ LAN riêng, không định tuyến được từ bên ngoài mạng đó; đây không phải
lỗi, xác nhận qua `ApiClient._toApiException()` rơi đúng vào nhánh "không có response" khi test).
Giải pháp được chọn là mở một tunnel công khai thay vì VPN hay triển khai lên máy chủ thật (nằm
ngoài phạm vi/thời gian hiện có).

- **Công cụ:** `cloudflared` (Cloudflare Tunnel), tải trực tiếp binary Windows từ GitHub release
  (`C:\D\cloudflared\cloudflared.exe`) — không cần cài đặt qua trình cài đặt, không cần tài
  khoản Cloudflare cho loại "quick tunnel" đang dùng.
- **Lệnh chạy:** `cloudflared tunnel --url http://localhost:3000` — trỏ thẳng vào cổng Gateway
  (giống hệt cách CNA gọi trực tiếp Gateway qua LAN ở mục 4, chỉ đổi địa chỉ đích), KHÔNG qua
  cổng 80/Nginx của `web` vì CNA không dùng đường đó.
  Tunnel sinh ra 1 URL HTTPS ngẫu nhiên, ví dụ `https://repairs-age-wish-evanescence.trycloudflare.com`.
- **Cập nhật `app_config.dart`:** `gatewayBaseUrl` đổi từ địa chỉ LAN sang URL tunnel này. CNA
  gọi tới đây y hệt cách gọi LAN trước đó — không có thay đổi logic nào khác trong app, vì bản
  chất vẫn là "gọi thẳng REST API của Gateway", chỉ khác địa chỉ đích.
- **QUAN TRỌNG — tính chất tạm thời:** đây là "quick tunnel" không đăng ký tài khoản
  (`cloudflared` tự in cảnh báo "no uptime guarantee" khi khởi động). URL **sẽ đổi** mỗi khi
  tiến trình `cloudflared` khởi động lại (tắt máy, mất mạng, đóng terminal đang chạy nó...) —
  không có cách giữ cố định URL này mà không tạo tài khoản Cloudflare + tunnel có tên riêng.
  Khi URL đổi, `app_config.dart` phải cập nhật lại và **build lại APK mới** (`flutter build apk
  --debug`) rồi gửi lại cho người dùng cuối — APK cũ với URL cũ sẽ báo lỗi "Không kết nối được
  tới máy chủ" y hệt như trước khi có tunnel.
- **Đánh đổi bảo mật cần biết:** khác với LAN (chỉ máy trong cùng mạng Wi-Fi mới chạm tới
  được), tunnel khiến Gateway của máy phát triển **truy cập được từ toàn bộ Internet** bởi bất
  kỳ ai biết URL (chuỗi ngẫu nhiên, không dễ đoán/không được lập chỉ mục, nhưng không phải bí
  mật mật mã học). Rủi ro được giảm nhẹ nhờ các lớp bảo vệ đã có sẵn từ trước (rate-limit theo
  IP+organization, JWT bắt buộc cho mọi route trừ `/auth/login`, `/auth/register-organization`,
  `/health` — xem `Technical_Spec.md` mục 6/9) nhưng đây vẫn là thay đổi có chủ đích, chỉ nên
  bật khi cần demo/chia sẻ thật sự, tắt tiến trình `cloudflared` khi xong (đóng cửa sổ đang chạy
  nó) để đóng lại đường truy cập công khai này.
- Muốn quay lại chế độ LAN thuần (không cần Internet, không có rủi ro truy cập công khai): đổi
  `gatewayBaseUrl` về lại `http://<IP-LAN-cua-may>:3000/api/v1` và build lại APK — không cần
  đổi gì khác trong `AndroidManifest.xml` (`usesCleartextTraffic="true"` vẫn giữ nguyên, phục vụ
  đúng cho trường hợp LAN dùng HTTP thuần; tunnel dùng HTTPS nên không bị ảnh hưởng bởi cờ này).

**Xác minh:** đăng nhập thật qua tunnel (`an.nguyen+141603@demo-sme.vn`) và chấm công vào làm
thành công đầu-cuối qua đúng URL tunnel (ảnh upload lên MinIO, bản ghi `Attendance` tạo trong
Postgres) — xác nhận toàn bộ chuỗi tunnel → Gateway → hrm-service → MinIO/Postgres hoạt động
đúng, không chỉ dừng ở tầng mạng.

## 11. Tài khoản demo & lỗi RBAC đã sửa (10/08/2026)

**Tài khoản để đăng nhập thử CNA** (tổ chức demo cố định, xem
`Enterprise Collaboration and Analytics Platform for SMEs/scripts/seed.js`):

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Org Admin | `admin@demo-sme.vn` | `Password123!` |
| Employee | `an.nguyen+141603@demo-sme.vn` (hoặc `binh.tran`/`chi.le`/`dung.pham`/`duc.hoang`/`em.vu`/`phong.do`/`giang.ngo`, cùng hậu tố `+141603@demo-sme.vn`) | `Password123!` |

Đây là tài khoản Employee thật (không phải Org Admin) — phù hợp đúng đối tượng dùng CNA (nhân
viên tự chấm công/xin nghỉ phép), khác với tài khoản Org Admin dùng để quản trị trên web.

**Lỗi phát hiện khi thử đăng nhập bằng tài khoản Employee:** check-in/tạo yêu cầu nghỉ phép bị
từ chối vì vai trò "Employee" và "Manager" của tổ chức demo này **thiếu toàn bộ quyền CRM-lite
và HRM-lite** (`attendance:checkin`, `leave_request:create`, `customer:*`, `deal:*`) — Employee
chỉ có 7/13 quyền lẽ ra phải có, Manager chỉ có 13/26. Nguyên nhân: `RolesService.seedDefaultRoles()`
(`apps/iam-service`) chỉ gán quyền cho vai trò **một lần duy nhất**, tại thời điểm tổ chức đăng
ký — tổ chức demo này đăng ký ngày 28/07/2026, TRƯỚC KHI permission CRM-lite (04/08) và HRM-lite
(05/08) tồn tại trong code. `PermissionsSeederService` (chạy mỗi lần `iam-service` khởi động) chỉ
đảm bảo permission **tồn tại** trong bảng `permissions` toàn cục, KHÔNG tự động gắn permission
mới vào vai trò của tổ chức đã đăng ký từ trước — đây là hành vi đúng thiết kế (permission theo
tổ chức là dữ liệu riêng, Org Admin có thể tự chỉnh qua `PATCH /roles/:id/permissions`, không
nên bị ghi đè ngầm mỗi khi code đổi), nhưng vai trò Org Admin của CHÍNH tổ chức demo này đã được
gán đủ quyền theo cách thủ công từ đợt xác minh CRM-lite/HRM-lite trước đó, còn Manager/Employee
thì chưa — dẫn tới hiện tượng "tài khoản Employee dùng được web các trang cũ nhưng luôn bị từ
chối ở chấm công/nghỉ phép/CRM".

**Đã sửa:** gọi `PATCH /api/v1/roles/:id/permissions` (đúng API mà màn hình Quản trị > Vai trò
& Phân quyền của web đã dùng, không phải thao tác trực tiếp lên DB) để cập nhật vai trò Manager
và Employee của tổ chức demo này khớp đúng `DEFAULT_ROLE_PERMISSIONS` hiện tại trong code
(Manager: 13 → 26 quyền; Employee: 7 → 13 quyền).

**Lưu ý cho tổ chức MỚI đăng ký:** vấn đề này chỉ ảnh hưởng tổ chức demo cố định đã tồn tại từ
trước — bất kỳ tổ chức nào đăng ký MỚI từ bây giờ sẽ được seed đúng, đầy đủ quyền hiện hành
ngay từ đầu, không gặp lại vấn đề này.

**Xác minh:** đăng nhập lại bằng `an.nguyen+141603@demo-sme.vn`, giải mã JWT xác nhận có đủ
`attendance:checkin`/`leave_request:create`; gọi thật `POST /attendance/check-in` qua tunnel
(mục 10) với ảnh thật — trả về `200` kèm bản ghi `Attendance` đầy đủ, xác nhận sửa đúng vấn đề.

## 12. Mở rộng phạm vi — Công việc & Tài liệu (12/08/2026)

**Bối cảnh:** sau khi dùng thử CNA, nảy sinh câu hỏi vì sao ứng dụng không có đầy đủ chức năng
như web (không cần biểu đồ, nhưng ít nhất cần đủ chức năng), và nhận thấy tài khoản
Employee trên web có nhiều hơn 4 tính năng đã đưa vào CNA. Trước khi sửa code, cân nhắc lại
phạm vi (không triển khai ngay) — kết luận rút ra từ tra cứu trực tiếp
`packages/common-dto/src/enums/permission.enum.ts` thay vì suy đoán:

- Giả định ban đầu khi scaffold CNA (mục 2) — coi Dự án/Công việc và Tài liệu là "việc bàn giấy,
  tự nhiên hơn trên web" — không được đối chiếu với quyền `DEFAULT_ROLE_PERMISSIONS` thực tế của
  vai trò `Employee`. Trên thực tế Employee có `PROJECT_VIEW`, `TASK_CREATE/UPDATE/VIEW`,
  `DOCUMENT_UPLOAD/VIEW/SHARE` — đây là công việc thường nhật của một nhân viên, không phải thao
  tác quản trị, nên phạm vi ban đầu hẹp hơn mức Employee được phép làm trên web.
- Employee cũng có `CUSTOMER_VIEW`, `DEAL_CREATE/UPDATE/VIEW` (CRM-lite), nhưng mục này bị loại
  khỏi CNA có chủ đích: quản lý một cơ hội bán hàng (chọn khách hàng, nhập giá trị deal, đổi giai
  đoạn pipeline) không phải thao tác tự nhiên khi thao tác bằng ngón tay trên màn hình nhỏ, khác
  hẳn "xem 1 danh sách rồi bấm 1 nút" như Công việc/Tài liệu — quyền tồn tại không đồng nghĩa nên
  đưa lên di động. Có thể xem lại nếu sau này có nhân viên làm việc thực địa (sales ngoài văn
  phòng) thật sự cần việc này.

**Đã triển khai** (chỉ thêm màn hình mới trong `ecap-mobile`, KHÔNG sửa bất kỳ dòng nào ở nền
tảng — endpoint đều đã tồn tại sẵn và được `apps/web` dùng từ trước):

- **`TasksPage`** (`lib/features/tasks/tasks_page.dart`): gọi `GET /tasks?limit=500` +
  `GET /projects?limit=500`, lọc lại ở client những Task có `assignees` chứa `userId` của người
  đang đăng nhập (API `TaskQueryDto` không có tham số lọc theo người phụ trách — quy mô SME nhỏ
  nên lấy `limit=500` rồi lọc client chấp nhận được, xem `packages/common-dto/src/dto/pagination.dto.ts`
  cho trần `limit` tối đa 500). Đổi trạng thái qua `PATCH /tasks/:id/status`, menu chỉ hiện các
  bước hợp lệ theo bản sao `taskStatusTransitions` (khớp `TASK_STATUS_TRANSITIONS` phía backend)
  — không cho chọn bước sai để tránh gọi API rồi nhận lỗi 400. Không có tạo/xoá Task, không có
  Kanban kéo-thả (đúng quyết định phạm vi ở trên).
- **`DocumentsPage`** (`lib/features/documents/documents_page.dart`): duyệt đệ quy qua
  `GET /folders?parentFolderId=` (lưu ý: endpoint này trả về **mảng thô**, không bọc
  `{data, meta}` như phần còn lại của hệ thống — `ApiClient` có thêm hàm `getList()` riêng cho
  trường hợp này) và `GET /files?folderId=`. Bấm vào 1 file gọi
  `GET /files/:id/download?disposition=inline` lấy `downloadUrl` (URL MinIO có chữ ký trước) rồi
  mở bằng gói `url_launcher` (`LaunchMode.externalApplication`) — trình duyệt/trình xem PDF mặc
  định của điện thoại tự render nhờ đúng `Content-Disposition: inline` đã xác minh khi làm trang
  Tài liệu thật trên web (`Technical_Spec.md`, mục Lịch sử thay đổi tài liệu, mục
  2026-08-10 "dữ liệu thật cho trang Tài liệu"), KHÔNG viết
  logic render PDF riêng trong app. Nút tải lên dùng gói `file_picker` chọn file bất kỳ từ bộ nhớ
  máy, gửi `POST /files/upload` qua `ApiClient.postFile()` (hàm multipart mới, khác `postPhoto()`
  ở tên field `file` và cho phép kèm field text `folderId`).
- **Điều hướng:** `HomeShell` (`lib/features/home_shell.dart`) mở rộng từ 4 lên 6 tab (`Chấm
  công`, `Nghỉ phép`, `Công việc`, `Tài liệu`, `Thông báo`, `Hồ sơ`), giữ nguyên
  `NavigationBar` sẵn có, không đổi cấu trúc điều hướng.
- **Phụ thuộc mới** (`pubspec.yaml`): `file_picker` (chọn file bất kỳ, khác `image_picker` chỉ
  dùng cho camera chấm công) và `url_launcher` (mở URL ngoài app). `AndroidManifest.xml` bổ sung
  1 `<intent>` trong khối `<queries>` đã có sẵn (mở `https://` qua trình duyệt — bắt buộc từ
  Android 11/API 30 theo package visibility, nếu không có thể báo "không tìm thấy ứng dụng xử lý"
  dù máy có trình duyệt thật).
- **Sự cố công cụ build gặp phải khi thêm `file_picker`** (không phải lỗi code của CNA):
  `compileSdk` mặc định của dự án (kế thừa từ Flutter SDK cài trên máy, đang trỏ tới API 34)
  thấp hơn mức phụ thuộc bắc cầu `flutter_plugin_android_lifecycle` yêu cầu (>= 36) — sửa bằng
  cách ép cứng `compileSdk = 36` tại `android/app/build.gradle.kts`. Bản `file_picker` mới nhất
  lúc viết tài liệu này (11.0.3) áp dụng Kotlin Gradle Plugin theo cách sẽ bị Flutter tương lai
  từ chối build (cảnh báo rõ trong log, chưa phải lỗi) và thực tế build thất bại thật trên máy
  này (thiếu class `FilePickerPlugin` lúc biên dịch) — hạ xuống bản `10.3.10` (bản `10.3.11` mới
  hơn đã bị chính nhà phát triển gói rút lại - "retracted" trên pub.dev) build thành công, chỉ
  còn cảnh báo (không phải lỗi) về Kotlin Gradle Plugin, xem thêm mục 14.

**Xác minh:** `flutter analyze` (0 lỗi), `flutter test` (2/2 qua, không đổi so với trước),
`flutter build apk --debug` build thành công (~164 MB, chưa tối ưu/minify — tăng so với bản
trước do 2 phụ thuộc mới). Chưa thử trên thiết bị Android thật luồng Công việc/Tài liệu đầy đủ
(đăng nhập → đổi trạng thái Task thật → mở 1 PDF thật từ trang Tài liệu, vốn đã có dữ liệu thật
(xem `Technical_Spec.md`, mục 2026-08-10 "dữ liệu thật cho trang Tài liệu") → tải lên 1 file
mới) — bước tiếp theo hợp lý trước khi dùng để trình bày, giống lưu ý đã có ở mục 7 cho bản đầu
tiên.

**Rà soát ngay sau đó (cùng ngày 12/08/2026):** đọc lại toàn bộ mã
nguồn (không chỉ dựa vào `flutter analyze`, vốn không bắt được lỗi logic) để xác nhận "chạy ổn
hay không", phát hiện và sửa 2 vấn đề thật:

- **Lỗi thật — có thể crash âm thầm khi tải tài liệu lên:** `DocumentsPage._uploadFile()` dùng
  `result?.files.single`, ném `StateError` KHÔNG được bắt nếu vì lý do nào đó platform trả về
  danh sách rỗng hoặc nhiều hơn 1 file — đúng dạng lỗi đã từng sửa ở mục 8 (gọi camera nằm ngoài
  `try/catch`). Sửa bằng cách kiểm tra `isEmpty` trước, dùng `.first` thay vì `.single`.
- **Nội dung lỗi thời — không phải lỗi code:** màn hình đăng nhập (`LoginPage`) vẫn ghi tagline
  "Chấm công & Nghỉ phép" từ bản đầu tiên (mục 2), chưa cập nhật sau khi thêm Công việc/Tài liệu
  ở trên cùng ngày. Sửa thành "Chấm công · Nghỉ phép · Công việc · Tài liệu".

Xác minh lại sau khi sửa: `flutter analyze` (0 lỗi), `flutter test` (2/2 qua), `flutter build apk
--debug` build lại thành công.

## 13. Kết nối bền vững & cờ vị trí chấm công (13/08/2026)

Hai hạng mục riêng, cùng ngày.

### 13.1. Địa chỉ Gateway không cần build lại APK mỗi khi tunnel đổi URL

Vấn đề còn tồn đọng từ mục 10: Cloudflare Tunnel loại "quick tunnel" đổi URL mỗi khi khởi động
lại — trước đây mỗi lần đổi phải sửa `AppConfig.gatewayBaseUrl`, build lại APK, cài lại cho từng
người dùng. Giải pháp: `GatewayConfig.resolveBaseUrl()` (`lib/core/gateway_config.dart`) đọc địa
chỉ Gateway từ 1 file JSON công khai nhỏ lúc khởi động app, theo thứ tự ưu tiên:

1. Fetch `AppConfig.remoteConfigUrl` thật (timeout 5 giây, không chặn khởi động app quá lâu nếu
   mạng chậm/không có mạng).
2. Nếu fetch thất bại: dùng giá trị đã cache cục bộ từ lần fetch thành công gần nhất (file
   `.gateway_base_url` trong thư mục tài liệu ứng dụng).
3. Nếu cả 2 bước trên đều không có giá trị (cài app lần đầu, chưa từng fetch thành công, và
   không có mạng ngay lúc đó): dùng `AppConfig.fallbackGatewayBaseUrl` (hằng số, giống cơ chế cũ).

**Cách thiết lập** (làm 1 lần duy nhất):

1. Tạo 1 Gist công khai trên `gist.github.com` (cần tài khoản GitHub — không thể tự động hoá
   bước này, cần con người xác nhận danh tính), tên file bất kỳ (vd `ecap-gateway-config.json`),
   nội dung:
   ```json
   { "gatewayBaseUrl": "https://ten-tunnel-hien-tai.trycloudflare.com/api/v1" }
   ```
2. Lấy URL "Raw" của Gist (dạng `https://gist.githubusercontent.com/<user>/<id>/raw/<filename>`
   — KHÔNG kèm mã hash phiên bản trong đường dẫn, để URL này luôn trỏ tới bản MỚI NHẤT thay vì
   đóng băng ở bản lúc tạo).
3. Điền URL đó vào `AppConfig.remoteConfigUrl` (`lib/core/app_config.dart`), build lại APK **1
   LẦN DUY NHẤT** để kích hoạt cơ chế này.
4. Từ đó về sau, mỗi khi tunnel Cloudflare khởi động lại (URL đổi): chỉ cần sửa lại nội dung
   Gist (trực tiếp trên `gist.github.com`, kể cả từ trình duyệt điện thoại — không cần máy tính,
   không cần Git) — APK đã cài trên máy mọi người tự nhận địa chỉ mới ở lần mở app tiếp theo,
   **không cần build lại/cài lại**.

Vẫn cần Docker Compose + tunnel đang chạy trên máy phát triển để app thực sự kết nối được — cơ
chế này chỉ giải quyết "APK biết địa chỉ nào để gọi", KHÔNG giải quyết "địa chỉ đó có đang hoạt
động hay không" (vẫn phụ thuộc máy phát triển bật, giống mục 10).

### 13.2. Cờ "on-site"/"off-site" cho chấm công (soft flag, không chặn check-in/out)

Chi tiết kỹ thuật đầy đủ ở `Technical_Spec.md` §17 (mục bổ sung 13/08/2026). Tóm tắt riêng phần
liên quan `ecap-mobile`: `AttendancePage` gửi kèm toạ độ GPS (gói `geolocator`, quyền Android
`ACCESS_FINE_LOCATION`) cùng lúc chụp ảnh check-in/out — HOÀN TOÀN TUỲ CHỌN, không chặn cham
công nếu thiếu quyền/dịch vụ vị trí tắt/timeout (xem `_getCurrentLocationSoft()`). Kết quả
("Tại văn phòng"/"Ngoài văn phòng", hoặc không hiện gì nếu chưa có dữ liệu để đánh giá) hiển thị
ngay trên màn hình "Hôm nay" và lịch sử chấm công cá nhân — không phải điều kiện chặn, chỉ là
tín hiệu thêm cùng cấp với ảnh, để Manager tự đối chiếu trên web (bảng "Chấm công toàn tổ chức"
mới ở `AttendancePage.tsx`, `apps/web`). Áp dụng CẢ web lẫn mobile — cố ý, nếu chỉ mobile có cờ
này thì ai cũng có thể né bằng cách luôn chấm công qua web.

## 14. Giới hạn đã biết & hướng mở rộng

- Địa chỉ Gateway gốc (tunnel Cloudflare, mục 10) vẫn đổi mỗi khi `cloudflared` khởi động lại —
  mục 13.1 đã bỏ được bước "build lại APK" mỗi lần đổi, nhưng vẫn cần 1 bước thủ công (sửa Gist)
  và không có màn hình cài đặt để nhập địa chỉ Gateway ngay trong app (phải sửa qua
  `gist.github.com`, ngoài ứng dụng).
- Không có test widget cho các màn hình gọi mạng thật (`LoginPage`, `AttendancePage`,
  `LeaveRequestsPage`, `NotificationsPage`) — cần mock `Dio`/`path_provider` để test cô lập,
  chưa thực hiện trong bản đầu.
- Thông báo dùng polling (kéo-để-làm-mới), chưa nối WebSocket real-time.
- Duyệt/từ chối nghỉ phép (phía Manager) không có trên mobile — xem mục 2.
- Không có phiên bản `--release` đã ký (signing key) — bản `debug` đủ dùng để cài thử/trình bày
  qua `adb install`, nhưng không phù hợp phân phối thật.
- Cờ "on-site"/"off-site" (mục 13.2) dựa vào GPS của thiết bị — có thể bị giả mạo qua ứng dụng
  giả lập vị trí khi bật Tuỳ chọn nhà phát triển trên Android, và độ chính xác GPS trong nhà có
  thể lệch vài chục mét. Đây là lý do thiết kế CỐ Ý không dùng để chặn check-in/out (xem
  `Technical_Spec.md` §17) — chấp nhận được vì chỉ là tín hiệu tham khảo, không phải kiểm soát an
  ninh. Web/mobile cũng chưa có màn hình xem lại ảnh chấm công của người khác (endpoint
  `GET /attendance/:id/photo` đã có sẵn từ trước nhưng chưa được gọi ở bảng "Chấm công toàn tổ
  chức" mới) — Manager hiện chỉ đối chiếu được cờ vị trí, chưa xem trực tiếp ảnh trên cùng màn
  hình.
- Vai trò Manager/Employee của các tổ chức khác (nếu có, đăng ký trước 04-05/08/2026) có thể
  gặp đúng lỗi thiếu quyền mô tả ở mục 11 — cần rà soát/cập nhật tương tự nếu phát hiện.
- **Công việc** (mục 12): chỉ xem/đổi trạng thái Task đã được giao — không tạo Task mới dù
  Employee có quyền `TASK_CREATE`, không có Kanban kéo-thả, không xem/sửa Task của người khác,
  không bình luận. Danh sách "của tôi" lọc ở client trên tối đa 500 Task gần nhất của tổ chức
  (đủ dùng ở quy mô SME, xem `General_idea.md` mục 7) — tổ chức có hơn 500 Task đang mở cùng lúc
  sẽ cần cách lọc phía server (ngoài phạm vi bản này).
- **Tài liệu** (mục 12): chỉ xem/tải lên — không tạo/xoá/đổi tên thư mục, không quản lý chia sẻ,
  không xoá/thay phiên bản file. `file_picker` (chọn file tải lên) đang ghim ở bản `10.3.10` do
  bản mới hơn (`11.x`) build lỗi trên máy phát triển hiện tại (xem mục 12) — cần thử lại khi
  nâng cấp Flutter/Android Gradle Plugin trên máy phát triển.

## Lịch sử thay đổi tài liệu

- **2026-08-06** — Khởi tạo tài liệu, đồng thời với việc scaffold `ecap-mobile` (Flutter/Dart,
  repo tách biệt hoàn toàn khỏi nền tảng chính). Quyết định kỹ thuật chính: tái sử dụng nguyên
  cơ chế xác thực cookie hiện có qua `dio` + `cookie_jar` (không sửa backend), gọi trực tiếp
  Gateway qua Wi-Fi/LAN (không cần cáp USB/`adb reverse`), phạm vi giới hạn ở chấm công/nghỉ
  phép/thông báo. Xác minh: `flutter analyze`/`flutter test` sạch, build APK debug thành công.
- **2026-08-07 (rà soát lỗi)** — Rà soát toàn bộ mã nguồn, phát hiện và
  sửa 4 lỗi thật (1 lỗi khiến app vỡ trên mọi lỗi validate dữ liệu, 1 lỗi có thể lặp vô hạn khi
  refresh token, 2 lỗi UX). Chi tiết đầy đủ ở mục 8 (mới). Bổ sung `README.md` cho `ecap-mobile`
  (trước đó vẫn là README mặc định do `flutter create` sinh ra).
- **2026-08-08 (thương hiệu)** — Đặt tên chính thức "CollabNAnalytic" (viết tắt "CNA") và icon
  (từ `Pic/Icon.png` của repo chính) cho ứng dụng. Chi tiết đầy đủ ở
  mục 9 (mới, các mục sau dịch xuống 1 số). Xác minh bằng `aapt dump badging` trên APK debug đã
  build lại.
- **2026-08-10 (Cloudflare Tunnel + sửa lỗi RBAC)** — Cộng tác viên Nguyễn Lê Tiến không kết nối
  được bằng CNA vì không cùng Wi-Fi/LAN với máy chạy Docker Compose (đúng thiết kế ban đầu, xem
  mục 4). Mở Cloudflare Tunnel (quick tunnel, không cần tài khoản) trỏ
  vào Gateway để CNA kết nối được qua Internet — chi tiết đầy đủ, gồm cảnh báo về tính tạm thời
  của URL và đánh đổi bảo mật, ở mục 11 (mới). Trong lúc xác minh, phát hiện và sửa 1 vấn đề dữ
  liệu thật (không phải lỗi code): vai trò Manager/Employee của tổ chức demo cố định thiếu toàn
  bộ quyền CRM-lite/HRM-lite do được đăng ký trước khi 2 hạng mục đó tồn tại trong code — chi
  tiết đầy đủ, gồm danh sách tài khoản demo, ở mục 12 (mới). Các mục giới hạn/lịch sử dịch số
  tương ứng. Xác minh: đăng nhập + chấm công thật thành công đầu-cuối qua tunnel bằng tài khoản
  Employee sau khi sửa quyền.
- **2026-08-12 (mở rộng phạm vi — Công việc & Tài liệu)** — Sau khi dùng thử CNA, nảy sinh
  câu hỏi vì sao ứng dụng thiếu nhiều chức năng so với web; cân nhắc lại phạm vi trước khi sửa
  code, đối chiếu trực tiếp `DEFAULT_ROLE_PERMISSIONS` của vai trò Employee thay vì suy đoán —
  phát hiện phạm vi ban đầu (mục 2) hẹp hơn mức Employee thực sự được phép làm trên web (có
  quyền Task/Document nhưng CNA chưa có màn hình tương ứng). Quyết định: thêm `TasksPage` (xem +
  đổi trạng thái, không Kanban/không tạo) và `DocumentsPage` (duyệt + xem inline + tải lên,
  không quản trị thư mục); cố ý loại CRM (Deal) dù Employee cũng có quyền — không phải thao tác
  tự nhiên trên điện thoại. Chi tiết đầy đủ, gồm 1 sự cố công cụ build (`compileSdk`/xung đột
  phiên bản `file_picker`) phát sinh khi thêm phụ thuộc mới, ở mục 12 (mới, chèn trước mục Giới
  hạn — đồng thời lấp khoảng trống đánh số mục 10 còn sót từ lần sửa trước). Mục Kết nối
  Internet (11→10) và Tài khoản demo & RBAC (12→11) dịch số tương ứng. Xác minh: `flutter
  analyze`/`flutter test` sạch, `flutter build apk --debug` thành công.
- **2026-08-12 (rà soát mã nguồn + chuyển `ecap-mobile/` và `Doc/` vào repo Git chính)** — Hai
  việc riêng trong cùng ngày. (1) Rà soát lại toàn bộ mã nguồn
  `ecap-mobile` (không chỉ dựa vào `flutter analyze`) ngay sau khi thêm Công việc/Tài liệu ở
  trên — phát hiện và sửa 2 vấn đề, chi tiết ở cuối mục 12. (2) Đưa cả
  `ecap-mobile/` và `Doc/` (trừ `ClaudeRule.md` — chỉ dẫn nội bộ cho trợ lý AI, không phải tài
  liệu dự án, thêm vào `.gitignore`) vào lịch sử Git của repo `Enterprise Collaboration and
  Analytics Platform for SMEs` — máy phát triển không có `git` cài đặt độc lập, dùng bản `git`
  đi kèm GitHub Desktop đã cài sẵn (`resources/app/git/mingw64/bin/git.exe`). Vì git chỉ theo
  dõi được nội dung NẰM TRONG thư mục gốc của repo, và `Doc/`/`ecap-mobile/` trước đó nằm CÙNG
  CẤP với thư mục repo (không phải bên trong), cả hai được **di chuyển vật lý** vào làm thư mục
  con ở gốc repo. Đây là lý do đoạn mở đầu tài liệu và mục 1 được viết lại: ranh giới "tách
  biệt" của `ecap-mobile` luôn nằm ở TẦNG MÃ NGUỒN/BUILD (không import, không chung dependency,
  không chung Docker image) — quyết định ban đầu (06/08/2026) đặt nó cùng cấp vật lý với repo là
  một lựa chọn KHÁC, độc lập với ranh giới đó, và nay đã đổi để đưa vào cùng lịch sử Git của repo
  chính mà không ảnh hưởng gì tới ranh giới mã nguồn/build nói
  trên. `ecap-mobile/.gitignore` (do `flutter create` sinh sẵn) tiếp tục loại trừ đúng
  `build/`/`.dart_tool/`/`.idea/`/... như trước, không cần sửa gì thêm vì Git áp dụng file
  `.gitignore` lồng nhau theo đúng thư mục chứa nó. Xác minh: `git status` sau khi di chuyển +
  trước khi commit xác nhận đúng tập file dự kiến (không có `ClaudeRule.md`, không có artifact
  build của Flutter/Android).
- **2026-08-13 (kết nối bền vững + cờ vị trí chấm công)** — Hai hạng mục riêng, cùng ngày. (1)
  `GatewayConfig.resolveBaseUrl()` (mới) — địa chỉ Gateway đọc từ 1 file JSON công khai lúc khởi
  động app thay vì hardcode, giải quyết dứt điểm việc phải build lại APK mỗi khi tunnel
  Cloudflare đổi URL. (2) Cờ "on-site"/"off-site" (soft flag) cho chấm công — gửi kèm toạ độ GPS
  tuỳ chọn cùng ảnh check-in/out, không chặn cham công nếu thiếu. Chi tiết đầy đủ, gồm hướng dẫn
  thiết lập Gist và lý do thiết kế soft flag, ở mục 13 (mới). Xác minh: `flutter analyze`/
  `flutter test`/`flutter build apk --debug` đều sạch; build+test toàn workspace của nền tảng
  cũng sạch (backend + `apps/web` cùng áp dụng cờ vị trí, xem `Technical_Spec.md` mục cùng ngày).
- **2026-08-20 → 21 (Đa ngôn ngữ Việt/Anh/Nhật ở nền tảng — không đổi CNA)** — Nền tảng triển
  khai rollout đa ngôn ngữ đầy đủ cho `apps/web`, kèm mở rộng CỘNG THÊM 3 trường tùy chọn vào
  body lỗi JSON (`errorCode`/`errorParams`/`details`, xem `Technical_Spec.md` §18). Ghi chú ngắn
  thêm ở mục 3 xác nhận `_toApiException()` không bị ảnh hưởng (4 trường gốc giữ nguyên, field
  mới bị bỏ qua tự nhiên) — đã xác minh bằng cách gọi thật API sai mật khẩu qua Gateway đã
  rebuild. CNA không có nút chọn ngôn ngữ và không nằm trong phạm vi rollout này, tiếp tục 100%
  tiếng Việt như từ đầu.
