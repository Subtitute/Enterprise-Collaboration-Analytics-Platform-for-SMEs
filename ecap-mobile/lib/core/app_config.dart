/// Cau hinh ket noi toi backend ECAP (repo "Enterprise Collaboration and Analytics
/// Platform for SMEs") - ung dung nay la mot du an Flutter tach biet o tang ma nguon/build,
/// khong dung chung code voi apps/web, chi goi qua REST API cua Gateway giong het web.
///
/// 13/08/2026 (Doc/ECAP_Mobile.md muc 13): dia chi Gateway KHONG con hardcode truc tiep - APK da
/// cai truoc do doi khi Cloudflare Tunnel khoi dong lai (URL doi) se tu nhan dia chi moi qua
/// [remoteConfigUrl] (xem GatewayConfig.resolveBaseUrl()), khong con phai build lai/cai lai APK
/// moi lan tunnel doi URL.
class AppConfig {
  AppConfig._();

  /// URL toi 1 file JSON cong khai nho dang `{"gatewayBaseUrl": "..."}`, doc luc khoi dong app
  /// de biet dia chi Gateway HIEN TAI - vd 1 GitHub Gist cong khai (sua truc tiep tren
  /// gist.github.com, ke ca tu dien thoai, khong can Git/build lai APK). Huong dan tao va cap
  /// nhat: Doc/ECAP_Mobile.md muc 13.
  ///
  /// Con `null`/rong nghia la CHUA thiet lap - app se luon dung [fallbackGatewayBaseUrl] ben
  /// duoi cho toi khi gia tri nay duoc dien (sua 1 dong roi build lai APK 1 LAN DUY NHAT; sau do
  /// moi lan doi dia chi Gateway chi can sua file JSON, khong build lai nua).
  static const String? remoteConfigUrl = null;

  /// Dung khi [remoteConfigUrl] chua thiet lap, HOAC khi fetch remote that bai VA chua co gia
  /// tri cache tu lan chay truoc (vd cai app lan dau, khong co mang luc do) - gia tri tunnel
  /// Cloudflare tai thoi diem viet code nay (doi khi tunnel khoi dong lai, xem Doc/ECAP_Mobile.md
  /// muc 10).
  static const String fallbackGatewayBaseUrl = 'https://repairs-age-wish-evanescence.trycloudflare.com/api/v1';
}
