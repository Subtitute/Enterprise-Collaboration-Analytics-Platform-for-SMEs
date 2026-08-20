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
  ///
  /// 17/08/2026: da thiet lap that. QUAN TRONG - day la dang URL "raw" KHONG kem hash commit
  /// (`.../raw/<filename>`, khac voi dang `.../raw/<hash>/<filename>` GitHub hien mac dinh khi
  /// bam "Raw" - dang co hash bi GHIM vao 1 revision cu the, sua Gist sau do se KHONG duoc phan
  /// anh o day) - dang khong hash nay luon tra ve noi dung MOI NHAT cua Gist.
  static const String? remoteConfigUrl =
      'https://gist.githubusercontent.com/Subtitute/05841268fddf5eb53eb66a9d969bb395/raw/gateway-config.json';

  /// Dung khi [remoteConfigUrl] chua thiet lap, HOAC khi fetch remote that bai VA chua co gia
  /// tri cache tu lan chay truoc (vd cai app lan dau, khong co mang luc do).
  ///
  /// 15/08/2026: doi tam ve dia chi LAN cua may chay Docker Compose (URL Cloudflare Tunnel cu da
  /// chet vi khong con tien trinh cloudflared nao dang chay) - CHI ket noi duoc khi dien thoai o
  /// CUNG mang Wi-Fi voi may nay. IP nay do DHCP cap, co the doi neu router khoi dong lai - kiem
  /// tra lai bang `ipconfig` (muc "Wireless LAN adapter Wi-Fi") neu mat ket noi. Xem
  /// Doc/ECAP_Mobile.md muc 10 cho phuong an Cloudflare Tunnel khi can ket noi qua Internet
  /// (ngoai mang LAN nay).
  static const String fallbackGatewayBaseUrl = 'http://192.168.1.20:3000/api/v1';
}
