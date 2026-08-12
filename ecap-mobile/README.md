# CollabNAnalytic (CNA)

Ứng dụng đồng hành trên Android cho `Enterprise Collaboration and Analytics Platform for
SMEs` (đồ án tốt nghiệp, Khoa Công nghệ Thông tin). Đây là **repo Flutter/Dart hoàn toàn tách
biệt** — không dùng chung mã nguồn, không dùng chung build pipeline với repo chính, chỉ gọi
REST API có sẵn của Gateway. Đặc tả kỹ thuật đầy đủ (kiến trúc, lý do tách repo, cơ chế xác
thực, danh sách endpoint, giới hạn đã biết): [`Doc/ECAP_Mobile.md`](../Doc/ECAP_Mobile.md).

## Phạm vi

Ứng dụng đồng hành tập trung, không phải bản sao toàn bộ nền tảng: đăng nhập, **Chấm công**
(check-in/out kèm ảnh chụp bằng camera thật của điện thoại - photo-proof, không nhận diện
khuôn mặt), **Nghỉ phép** (tạo yêu cầu + xem trạng thái), **Công việc** (xem công việc được giao
cho mình + đổi trạng thái, không Kanban), **Tài liệu** (duyệt thư mục, xem file trực tiếp, tải
lên), **Thông báo** (xem + đánh dấu đã đọc), Hồ sơ cá nhân/đăng xuất. Không có ngân sách cho iOS
nên chỉ nhắm tới Android. Chi tiết đầy đủ + lý do loại CRM khỏi phạm vi: `Doc/ECAP_Mobile.md`
mục 2, 12.

## Yêu cầu

- Flutter SDK (kênh stable) - `flutter doctor` phải pass mục "Android toolchain" (Android SDK +
  JDK; JDK đi kèm Android Studio là đủ, không cần cài JDK riêng).
- Backend của repo chính (`Enterprise Collaboration and Analytics Platform for SMEs`) đang
  chạy qua Docker Compose - xem README ở đó.
- Điện thoại Android (thật hoặc máy ảo) và máy chạy Docker Compose ở **cùng mạng Wi-Fi/LAN**
  (mặc định), HOẶC dùng Cloudflare Tunnel để kết nối qua Internet - xem mục 10 của
  `Doc/ECAP_Mobile.md`.

## Cấu hình kết nối tới backend

Sửa hằng số `gatewayBaseUrl` tại [`lib/core/app_config.dart`](lib/core/app_config.dart):

```dart
// Wi-Fi/LAN (mac dinh khi khong dung tunnel):
static const String gatewayBaseUrl = 'http://<IP-LAN-cua-may>:3000/api/v1';
// Hoac qua Cloudflare Tunnel (khong can cung mang, URL doi moi lan tunnel khoi dong lai):
static const String gatewayBaseUrl = 'https://<ten-ngau-nhien>.trycloudflare.com/api/v1';
```

Lấy IP LAN trên Windows bằng `ipconfig` (mục "Wireless LAN adapter Wi-Fi" → IPv4 Address). Địa
chỉ này có thể đổi mỗi lần kết nối lại Wi-Fi. Sau khi đổi giá trị này, phải build lại APK
(`flutter build apk --debug`) rồi cài lại - URL cũ không tự cập nhật trên máy đã cài trước đó.

## Chạy thử / Build APK

```powershell
flutter pub get
flutter run                 # chạy trực tiếp trên thiết bị/máy ảo đã kết nối (adb devices)
flutter build apk --debug   # build file APK - cai qua "adb install build/app/outputs/flutter-apk/app-debug.apk"
```

Bản `--release` (đã tối ưu/minify, kích thước nhỏ hơn nhiều so với `--debug`) cần thiết lập
signing key riêng trước khi build - xem [tài liệu Flutter](https://docs.flutter.dev/deployment/android)
nếu cần phân phối thật thay vì chỉ demo/cài thử.

## Cấu trúc thư mục

```
lib/
  main.dart                            # Diem vao - dieu huong Login/Home dua tren trang thai dang nhap
  core/
    app_config.dart                    # Dia chi Gateway (sua khi doi mang)
    api_client.dart                    # Dio + cookie jar (mo phong refresh token httpOnly cookie cua web)
    auth_session.dart                  # Trang thai dang nhap trong bo nho
    date_format.dart                   # Quy doi hien thi gio ve GMT+7
  models/                              # Cac model khop voi response cua backend
  features/
    auth/login_page.dart
    attendance/attendance_page.dart    # Cham cong - camera that qua image_picker
    leave_requests/leave_requests_page.dart
    tasks/tasks_page.dart              # Cong viec cua toi - xem + doi trang thai (khong Kanban)
    documents/documents_page.dart      # Tai lieu - duyet thu muc, xem inline, tai len
    notifications/notifications_page.dart
    home_shell.dart                    # Bottom navigation (6 tab)
android/                               # Du an Android (flutter create --platforms=android)
test/                                  # Test don vi cho ham thuan tuy
```

## Ghi chú

- Không sửa bất kỳ dòng nào ở repo chính - toàn bộ tính năng ở đây gọi API REST đã tồn tại sẵn
  và đã được xác minh sống (xem `Technical_Spec.md` mục 16, 17 ở repo chính).
- Chưa khởi tạo Git repository cho thư mục này (máy phát triển ban đầu chưa cài Git).
- Giới hạn đã biết và hướng mở rộng: xem mục 13 của `Doc/ECAP_Mobile.md`.
- Tài khoản demo (Org Admin + Employee) để đăng nhập thử: xem mục 11 của `Doc/ECAP_Mobile.md`.
