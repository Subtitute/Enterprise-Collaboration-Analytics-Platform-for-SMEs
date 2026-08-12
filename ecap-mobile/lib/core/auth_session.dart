import 'package:flutter/foundation.dart';
import '../models/user.dart';

/// Trang thai dang nhap trong bo nho (KHONG ghi dia) - access token song ngan (15 phut,
/// giong quy uoc cua toan he thong) nen khong can luu ben; refresh token (httpOnly cookie,
/// do PersistCookieJar trong ApiClient tu quan ly) moi la thu can ben qua lan mo app.
class AuthSession extends ChangeNotifier {
  String? _accessToken;
  AppUser? _user;

  String? get accessToken => _accessToken;
  AppUser? get user => _user;
  bool get isLoggedIn => _accessToken != null && _user != null;

  void setSession({required String accessToken, required AppUser user}) {
    _accessToken = accessToken;
    _user = user;
    notifyListeners();
  }

  void clear() {
    _accessToken = null;
    _user = null;
    notifyListeners();
  }
}
