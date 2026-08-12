/// Cau hinh ket noi toi backend ECAP (repo "Enterprise Collaboration and Analytics
/// Platform for SMEs") - ung dung nay la mot repo Flutter HOAN TOAN tach biet, khong
/// dung chung code voi apps/web, chi goi qua REST API cua Gateway giong het web.
///
/// 10/08/2026: chuyen sang dia chi tunnel Cloudflare (xem Doc/ECAP_Mobile.md muc 11) de
/// nguoi dung KHONG can cung Wi-Fi/LAN voi may chay Docker Compose van goi duoc Gateway qua
/// Internet. Day la "quick tunnel" (khong dang ky tai khoan) - URL SE DOI khi tunnel duoc
/// khoi dong lai (khong on dinh vinh vien); LAN cu (vd 'http://192.168.1.40:3000/api/v1')
/// van dung duoc binh thuong cho ai dang cung Wi-Fi, chi can doi lai hang so nay.
class AppConfig {
  AppConfig._();

  static const String gatewayBaseUrl = 'https://repairs-age-wish-evanescence.trycloudflare.com/api/v1';
}
