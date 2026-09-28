import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/foundation.dart' show debugPrint;
import 'package:path_provider/path_provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as sio;

import 'auth_session.dart';
import '../models/user.dart';
import '../models/conversation.dart';
import '../models/message.dart';

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
      // 22/08/2026: doi "on DioException" (chi bat loi mang/HTTP) thanh bat MOI loi - phat hien
      // qua rieng ra soat: 1 response HTTP 200 nhung sai hinh dang (vd 1 captive-portal Wi-Fi tra
      // ve trang HTML thay vi JSON that, hoac proxy doanh nghiep chen noi dung khac) khien ep kieu
      // "as String"/"as Map<String,dynamic>" o tren nem TypeError - loai loi nay KHONG PHAI
      // DioException nen truoc day thoat khoi ham nay khong duoc bat, roi loi ra ngoai interceptor
      // onError() ben tren (chinh no cung dang trong 1 try/catch rieng - xem _tryRefreshOnce()) mà
      // khong bi coi la "refresh that bai" mot cach gon gang.
      //
      // 25/08/2026: fix code review Major (phat hien qua dot ra soat toan du an lan 3) - "catch (_)"
      // gop chung 2 loai loi rat khac nhau (refresh token that su het han/khong hop le, VA response
      // 200 nhung sai hinh dang) lam CUNG 1 hanh dong (dang xuat lang le) ma khong de lai dau vet
      // nao de phan biet - neu la truong hop thu 2 (loi phan tich, khong phai loi xac thuc That),
      // nguoi dung se bi dang xuat GIUA phien lam viec ma khong co loi giai thich, va khong co cach
      // nao debug duoc tu xa. Ghi lai debugPrint (chi hien trong chu do debug/profile, khong lam gi
      // trong bo AOT release) TRUOC khi xoa session, van GIU nguyen hanh vi xoa session (khong the
      // phan biet chac chan 2 truong hop tai day, nen van an toan hon la coi nhu da dang nhap).
    } catch (e) {
      debugPrint('ApiClient._refresh() that bai: $e');
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
      // 22/08/2026: phat hien qua rieng ra soat - "on DioException" chi bat loi mang/HTTP, KHONG
      // bat TypeError tu ep kieu sai (vd captive-portal Wi-Fi/proxy tra ve HTTP 200 voi noi dung
      // khong phai JSON hop le nhu mong doi). main.dart goi ham nay trong _bootstrap() KHONG co
      // try/catch nao boc ben ngoai - 1 TypeError thoat ra khoi day se la loi CHUA DUOC BAT, treo
      // man hinh spinner khoi dong VINH VIEN (setState() ben duoi khong bao gio chay), khong the
      // phuc hoi ma khong xoa du lieu app. Bat MOI loi (khong chi DioException) va coi la "chua
      // dang nhap" - dung dung y nghia cua ham nay (chi la thu tu dang nhap lai, that bai thi coi
      // nhu nguoi dung moi, KHONG PHAI loi can hien thi).
      //
      // 25/08/2026: xem giai thich debugPrint tai _refresh() ben tren - cung 1 ly do.
    } catch (e) {
      debugPrint('ApiClient.tryAutoLogin() that bai: $e');
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
      // 25/08/2026: fix code review Major (phat hien qua dot ra soat toan du an lan 3) - ham nay ep
      // kieu response.data giong het _refresh()/tryAutoLogin() (da sua 22/08/2026 de bat ca
      // TypeError) nhung chinh no lai chi bat DioException - 1 response 200 sai hinh dang khi dang
      // nhap (vd captive-portal Wi-Fi) nem TypeError CHUA DUOC BAT, khong phai ApiException nen
      // login_page.dart's "on ApiException catch" khong bat duoc: spinner tat (nho finally) nhung
      // khong co thong bao loi nao hien ra - that bai am tham, kho hieu.
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  /// 28/09/2026: "Quen mat khau" (Technical_Spec.md, bo sung 15/09/2026 - xem
  /// AuthController.forgotPassword() cua apps/iam-service). Backend LUON tra ve { success: true }
  /// du email co ton tai hay khong (chong do email) - man hinh goi ham nay chi can biet request co
  /// toi duoc server hay khong (loi mang/HTTP that su), khong co "khong tim thay email" de phan biet.
  Future<void> forgotPassword(String email) async {
    try {
      await _dio.post('/auth/forgot-password', data: {'email': email});
    } on DioException catch (e) {
      throw _toApiException(e);
    }
    // Khong doc response.data (chi { success: true }, khong dung toi) - khong co buoc ep kieu nao
    // co the nem TypeError, nen khong can "on TypeError" o day (khac cac ham doc response.data ben duoi).
  }

  /// "Quen mat khau" buoc 2 - dat mat khau moi bang token nhan qua email (AuthController.resetPassword()).
  /// Backend tra ve 1 ma loi CHUNG DUY NHAT (token sai/het han/da dung roi deu chung 1 thong bao) -
  /// _toApiException() da tu doc dung [message] tieng Viet do, khong can xu ly rieng o day.
  Future<void> resetPassword({required String token, required String newPassword}) async {
    try {
      await _dio.post('/auth/reset-password', data: {'token': token, 'newPassword': newPassword});
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
      // 25/08/2026: xem giai thich tai login() ben tren - dong bo cach xu ly response sai hinh dang
      // cho tat ca ham goi API con lai cua class nay (get/getList/postJson/patch/postPhoto/postFile).
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
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
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> data) async {
    try {
      final response = await _dio.post(path, data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? data]) async {
    try {
      final response = await _dio.patch(path, data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
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
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
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
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  /// 28/09/2026: danh ba noi bo toi thieu (UserDirectory, xem core/user_directory.dart) - GET
  /// /users mo cho MOI nguoi dung da xac thuc (khong chi Admin, xem chu thich UsersController.findAll()
  /// cua apps/iam-service), dung cung nguong limit: 500 nhu TasksPage._load() dung cho /tasks, /projects
  /// (quy mo SME ~10-200 nhan su, 1 trang la du "toan bo").
  Future<List<AppUser>> getOrgUsers() async {
    try {
      final response = await _dio.get('/users', queryParameters: {'limit': 500});
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      return list.map((e) => AppUser.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw _toApiException(e);
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  /// GET /conversations - danh sach cuoc tro chuyen cua nguoi dung, da sap xep theo hoat dong gan
  /// nhat (ConversationsService.findAllForUser() cua apps/messaging-service).
  Future<List<Conversation>> getConversations() async {
    try {
      final response = await _dio.get('/conversations');
      final list = response.data as List<dynamic>;
      return list.map((e) => Conversation.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw _toApiException(e);
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  /// POST /conversations - [type] la 'DIRECT' hoac 'GROUP' (dung conversationTypeToJson()). DIRECT
  /// server tu dedup (tra ve cuoc tro chuyen co san giua dung 2 nguoi neu da ton tai) - xem
  /// ConversationsService.create().
  Future<Conversation> createConversation({
    required String type,
    required List<String> participantUserIds,
    String? name,
  }) async {
    try {
      final response = await _dio.post(
        '/conversations',
        data: {'type': type, 'participantUserIds': participantUserIds, 'name': ?name},
      );
      return Conversation.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _toApiException(e);
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  /// GET /conversations/:id/messages - phan trang kieu cursor (beforeMessageId, KHONG dung
  /// page/limit) - xem chu thich MessagesService.listMessages(). Tra ve THEO THU TU TANG DAN
  /// (cu -> moi), server da tu dao nguoc truoc khi tra ve.
  Future<List<Message>> getMessages(String conversationId, {int limit = 50, String? beforeMessageId}) async {
    try {
      final response = await _dio.get(
        '/conversations/$conversationId/messages',
        queryParameters: {'limit': limit, 'beforeMessageId': ?beforeMessageId},
      );
      final list = response.data as List<dynamic>;
      return list.map((e) => Message.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw _toApiException(e);
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  /// POST /conversations/:id/messages - gui xong server tu phat lai qua WebSocket ('message:new')
  /// cho MOI thanh vien (bao gom ca nguoi gui) - xem insertMessageSorted() (models/message.dart)
  /// ve cach man hinh chat loai trung giua response nay va su kien WebSocket cho CUNG 1 tin nhan.
  Future<Message> sendConversationMessage(String conversationId, String body) async {
    try {
      final response = await _dio.post('/conversations/$conversationId/messages', data: {'body': body});
      return Message.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _toApiException(e);
    } on TypeError {
      throw ApiException('Phản hồi từ máy chủ không hợp lệ, vui lòng thử lại');
    }
  }

  /// PATCH /conversations/:id/read - khong doc response.data (khong dung toi) nen khong can "on
  /// TypeError" o day, giong logout()/markRead cua NotificationsPage.
  Future<void> markConversationRead(String conversationId) async {
    try {
      await _dio.patch('/conversations/$conversationId/read');
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  /// 28/09/2026: Nhan tin thoi gian thuc - tinh nang DAU TIEN cua app dung WebSocket (moi thu khac
  /// hien dang polling qua REST/RefreshIndicator). Ket noi toi CUNG host Gateway ma [_dio] dang
  /// dung (da duoc GatewayConfig.resolveBaseUrl() giai quyet TRUOC do - xem gateway_config.dart,
  /// KHONG hardcode dia chi rieng o day) - chi bo phan duong dan ('/api/v1') vi Socket.IO tu ghep
  /// [path] ('/ws/messaging', xem Gateway's WS_PROXY_ROUTES) vao GOC host, khong qua tien to REST.
  ///
  /// Dung setAuthFn() (khong phai setAuth() voi 1 Map tinh) - doc [session.accessToken] MOI moi
  /// lan (ket noi that su LAN DAU cung nhu moi lan Socket.IO tu dong reconnect() sau mat mang), nen
  /// van dung token MOI NHAT ke ca sau khi ApiClient tu lam moi token (interceptor 401 o create())
  /// trong luc socket dang ket noi - tranh loi da biet cua cac he thong tuong tu (token tinh chup 1
  /// lan luc tao socket, reconnect sau khi token het han se that bai am tham).
  ///
  /// [autoConnect] tat - ben goi (conversations_page.dart/chat_page.dart) tu gan listener (on(),
  /// onConnect()) TRUOC roi moi goi connect(), tranh lo mat su kien dau tien neu ket noi qua nhanh.
  sio.Socket connectMessagingSocket() {
    final baseUri = Uri.parse(_dio.options.baseUrl);
    final origin = '${baseUri.scheme}://${baseUri.host}:${baseUri.port}';
    return sio.io(
      origin,
      sio.OptionBuilder()
          .setPath('/ws/messaging')
          .setTransports(['websocket', 'polling'])
          .setAuthFn((cb) => cb({'token': session.accessToken}))
          .disableAutoConnect()
          .build(),
    );
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
