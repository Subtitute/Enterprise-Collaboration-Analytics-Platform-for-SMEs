import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:path_provider/path_provider.dart';

import 'auth_session.dart';
import '../models/user.dart';

/// Loi nghiep vu tra ve tu Gateway - khop dinh dang chuan { statusCode, error, message,
/// timestamp } (Technical_Spec.md muc 7). UI chi can doc [message] (da la tieng Viet).
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

/// Boc Dio + PersistCookieJar (luu ecap_refresh_token httpOnly cookie xuong dia, giup app song
/// lai sau khi tat/mo lai ma khong bat dang nhap lai - dung DUNG co che refresh cookie ma web
/// (apps/web) da dung, KHONG can sua backend rieng cho mobile - xem Doc/ECAP_Mobile.md) +
/// interceptor tu dong gan Authorization header va tu lam moi access token het han (15 phut).
class ApiClient {
  final Dio _dio;
  final AuthSession session;
  Future<bool>? _refreshing;

  ApiClient._(this._dio, this.session);

  /// 13/08/2026: [baseUrl] gio duoc truyen vao TU BEN NGOAI (giai quyet qua
  /// GatewayConfig.resolveBaseUrl() truoc khi goi ham nay), khong con doc hang cung
  /// AppConfig.gatewayBaseUrl - xem gateway_config.dart.
  static Future<ApiClient> create(AuthSession session, {required String baseUrl}) async {
    final dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 10)));

    final appDir = await getApplicationDocumentsDirectory();
    final cookieJar = PersistCookieJar(storage: FileStorage('${appDir.path}/.cookies'));
    dio.interceptors.add(CookieManager(cookieJar));

    final client = ApiClient._(dio, session);

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (session.accessToken != null) {
            options.headers['Authorization'] = 'Bearer ${session.accessToken}';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final isAuthEndpoint = error.requestOptions.path.startsWith('/auth/');
          // 07/08/2026: co "da thu lai" tren chinh RequestOptions - _dio.fetch() ben duoi di lai
          // qua toan bo interceptor chain (goi lai chinh onError nay neu retry cung 401), khong co
          // co nay se lap vo han neu 1 request cu 401 lien tuc (vd token bi thu hoi that su) vi
          // moi lan refresh() lai "thanh cong" (server luon cap token moi hop le) roi retry lai
          // van 401 vi ly do khac token het han.
          final alreadyRetried = error.requestOptions.extra['ecapRetried'] == true;
          if (error.response?.statusCode == 401 && !isAuthEndpoint && !alreadyRetried) {
            final refreshed = await client._tryRefreshOnce();
            if (refreshed) {
              try {
                error.requestOptions.extra['ecapRetried'] = true;
                final retried = await client._dio.fetch(error.requestOptions);
                return handler.resolve(retried);
              } catch (_) {
                // Rot xuong loi goc ben duoi neu retry cung that bai.
              }
            }
          }
          handler.next(error);
        },
      ),
    );

    return client;
  }

  /// Chi cho phep 1 lan goi /auth/refresh dong thoi - nhieu request cung 401 cung luc se dung
  /// chung 1 Future thay vi moi request tu goi refresh rieng (tranh xoay vong token nhieu lan).
  Future<bool> _tryRefreshOnce() {
    return _refreshing ??= _refresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _refresh() async {
    try {
      final response = await _dio.post('/auth/refresh');
      // /auth/refresh tra ve ca "user" moi (khop AuthService.refresh() ben backend), khong chi
      // accessToken - cap nhat luon de ho so/vai tro hien thi khong bi cu neu doi quyen giua luc
      // dung app roi quay lai.
      session.setSession(
        accessToken: response.data['accessToken'] as String,
        user: AppUser.fromJson(response.data['user'] as Map<String, dynamic>),
      );
      return true;
    } on DioException {
      session.clear();
      return false;
    }
  }

  /// Goi luc khoi dong app - co cookie con han thi tu dang nhap lai, khong thi coi nhu chua
  /// dang nhap (KHONG hien loi, day la luong binh thuong cho nguoi dung moi mo app lan dau).
  Future<void> tryAutoLogin() async {
    try {
      final response = await _dio.post('/auth/refresh');
      session.setSession(
        accessToken: response.data['accessToken'] as String,
        user: AppUser.fromJson(response.data['user'] as Map<String, dynamic>),
      );
    } on DioException {
      session.clear();
    }
  }

  Future<void> login(String email, String password) async {
    try {
      final response = await _dio.post('/auth/login', data: {'email': email, 'password': password});
      session.setSession(
        accessToken: response.data['accessToken'] as String,
        user: AppUser.fromJson(response.data['user'] as Map<String, dynamic>),
      );
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } on DioException {
      // Dang xuat cuc bo van tiep tuc du server loi - khong khoa nguoi dung o lai man hinh.
    }
    session.clear();
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await _dio.get(path, queryParameters: query);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// 12/08/2026: mot so danh sach cua Document Service (GET /folders) tra ve MANG THO thay vi
  /// {data, meta} nhu phan con lai cua he thong (xem ghi chu tai FolderItem) - can 1 ham rieng
  /// thay vi ep kieu sai trong get().
  Future<List<dynamic>> getList(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await _dio.get(path, queryParameters: query);
      return response.data as List<dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> data) async {
    try {
      final response = await _dio.post(path, data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? data]) async {
    try {
      final response = await _dio.patch(path, data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// Dung cho check-in/check-out (multipart/form-data, field "photo" - khop
  /// AttendanceController cua apps/hrm-service). [latitude]/[longitude] la TUY CHON (13/08/2026,
  /// Technical_Spec.md muc 17) - chi la tin hieu THEM cho Manager doi chieu, khong bat buoc.
  Future<Map<String, dynamic>> postPhoto(
    String path,
    File photoFile, {
    double? latitude,
    double? longitude,
  }) async {
    try {
      final formData = FormData.fromMap({
        'photo': await MultipartFile.fromFile(photoFile.path, filename: 'checkin.jpg'),
        if (latitude != null) 'latitude': latitude.toString(),
        if (longitude != null) 'longitude': longitude.toString(),
      });
      final response = await _dio.post(path, data: formData);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// 12/08/2026: tai file bat ky len (multipart/form-data, field "file" + field text "folderId"
  /// neu co) - khop POST /files/upload cua FilesController (apps/document-service). Khac
  /// postPhoto() o ten field va cho phep kem field text bo sung.
  Future<Map<String, dynamic>> postFile(
    String path,
    File file, {
    required String fileName,
    Map<String, String>? fields,
  }) async {
    try {
      final formData = FormData.fromMap({
        ...?fields,
        'file': await MultipartFile.fromFile(file.path, filename: fileName),
      });
      final response = await _dio.post(path, data: formData);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// 07/08/2026: sua loi that - AllExceptionsFilter (packages/common-guard) tra ve `message`
  /// dang String cho hau het loi nghiep vu (vd "Email hoac mat khau khong dung") NHUNG dang
  /// mang string rieng cho loi validate DTO (vietnamese-validation.pipe.ts luon tra ve mang,
  /// ke ca chi co 1 loi) - ep cung `as String` truoc day se nem TypeError ngay khi gap loi
  /// validate dau tien (vd nhap ngay nghi phep/ly do trong) thay vi hien thong bao loi.
  ApiException _toApiException(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      final rawMessage = data['message'];
      if (rawMessage is String) {
        return ApiException(rawMessage, statusCode: e.response?.statusCode);
      }
      if (rawMessage is List) {
        return ApiException(rawMessage.join('; '), statusCode: e.response?.statusCode);
      }
    }
    return ApiException('Không kết nối được tới máy chủ, vui lòng thử lại', statusCode: e.response?.statusCode);
  }
}
