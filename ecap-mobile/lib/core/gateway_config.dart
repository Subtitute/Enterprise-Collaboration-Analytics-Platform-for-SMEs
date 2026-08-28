import 'dart:io';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import 'app_config.dart';

/// 13/08/2026 (Doc/ECAP_Mobile.md muc 13): giai quyet dia chi Gateway HIEN TAI luc khoi dong app,
/// thay vi hang cung 1 URL trong APK da cai - khi Cloudflare Tunnel khoi dong lai (URL doi), chi
/// can sua 1 file JSON cong khai nho (xem AppConfig.remoteConfigUrl) la MOI ban APK da cai truoc
/// do tu nhan dia chi moi o lan mo tiep theo, khong can build lai/cai lai APK.
///
/// Thu tu uu tien: (1) fetch [AppConfig.remoteConfigUrl] that (co timeout ngan, khong chan khoi
/// dong app qua lau neu mang cham/khong co mang) -> (2) gia tri da cache tu lan fetch thanh cong
/// gan nhat (doc dia phuong, dung khi khong co mang luc mo app) -> (3)
/// [AppConfig.fallbackGatewayBaseUrl] (chi dung khi ca 2 buoc tren deu khong co gia tri - vd cai
/// app lan dau, chua tung fetch thanh cong lan nao, VA khong co mang ngay luc do).
class GatewayConfig {
  GatewayConfig._();

  static const _cacheFileName = '.gateway_base_url';

  static Future<String> resolveBaseUrl() async {
    final cacheFile = await _cacheFile();
    final cached = await _readCache(cacheFile);

    final remoteUrl = AppConfig.remoteConfigUrl;
    if (remoteUrl == null || remoteUrl.isEmpty) {
      return cached ?? AppConfig.fallbackGatewayBaseUrl;
    }

    final fetched = await _fetchRemote(remoteUrl);
    if (fetched != null) {
      // 25/08/2026: fix code review Major (phat hien qua dot ra soat toan du an lan 3) - ghi cache
      // truoc day KHONG boc try/catch, trong khi ca _fetchRemote()/_readCache() ben duoi deu co.
      // Neu writeAsString that bai (het dung luong, quyen ghi bi thu hoi giua chung...), loi thoat
      // ra khoi resolveBaseUrl() ma main.dart's _bootstrap() (goi ham nay) KHONG co try/catch nao
      // boc ngoai - setState() gan _apiClient khong bao gio chay, man hinh spinner khoi dong TREO
      // VINH VIEN, dung 1 lop loi voi TypeError da sua o api_client.dart nhung tai vi tri khac. Ghi
      // cache la buoc "best-effort tang toc lan mo sau", that bai KHONG duoc chan viec tra ve dia
      // chi vua fetch thanh cong cua LAN NAY.
      try {
        await cacheFile.writeAsString(fetched);
      } catch (_) {
        // Bo qua - van tra ve `fetched` binh thuong, chi la lan mo app sau se khong co cache moi.
      }
      return fetched;
    }
    return cached ?? AppConfig.fallbackGatewayBaseUrl;
  }

  static Future<String?> _fetchRemote(String remoteUrl) async {
    try {
      final response = await Dio().get<Map<String, dynamic>>(
        remoteUrl,
        options: Options(
          responseType: ResponseType.json,
          sendTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );
      final gatewayBaseUrl = response.data?['gatewayBaseUrl'];
      if (gatewayBaseUrl is String && gatewayBaseUrl.isNotEmpty) {
        return gatewayBaseUrl;
      }
      return null;
    } catch (_) {
      // Khong co mang / file JSON tam thoi khong doc duoc luc khoi dong app - roi xuong
      // cache/fallback, KHONG chan man hinh dang nhap chi vi buoc nay that bai.
      return null;
    }
  }

  static Future<File> _cacheFile() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/$_cacheFileName');
  }

  static Future<String?> _readCache(File file) async {
    try {
      if (await file.exists()) {
        final content = (await file.readAsString()).trim();
        return content.isEmpty ? null : content;
      }
    } catch (_) {}
    return null;
  }
}
