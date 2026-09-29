import 'api_client.dart';
import '../models/user.dart';

/// 28/09/2026: man hinh Nhan tin can hien TEN dong nghiep tu senderId/participantUserIds (chi la
/// UUID tho - xem chu thich Task.assigneeUserIds trong models/task.dart, cung han che "User o DB
/// rieng cua IAM Service"), nhung ca app truoc gio CHUA co cach nao tra UUID -> ten (TasksPage chi
/// hien ten Du an, khong hien ten nguoi phu trach). Bo sung 1 lop tra cuu TOI THIEU: goi GET /users
/// 1 LAN, cache trong bo nho CHO SUOT 1 PHIEN dang nhap (khong ghi dia, khong tu lam moi) - du cho
/// quy mo SME (~10-200 nhan su, xem TasksPage._load() dung cung nguong limit: 500).
///
/// Instance duoc tao MOI trong _HomeShellState.initState() (xem home_shell.dart) - nghia la cache
/// tu dong "sach" moi lan dang nhap lai (khong con so voi nguoi/to chuc CU sau khi dang xuat).
class UserDirectory {
  final ApiClient apiClient;

  UserDirectory(this.apiClient);

  List<AppUser> _users = [];
  Map<String, String> _namesById = {};
  Future<void>? _loading;

  List<AppUser> get users => _users;

  /// Goi 1 LAN duy nhat (cac lan goi sau, ke ca dang cho lan dau xong, deu dung chung 1 Future) -
  /// tranh nhieu man hinh (danh sach hoi thoai + man hinh chat) cung goi GET /users trung lap.
  Future<void> ensureLoaded() {
    if (_users.isNotEmpty) return Future.value();
    return _loading ??= _load().whenComplete(() => _loading = null);
  }

  Future<void> _load() async {
    try {
      final loaded = await apiClient.getOrgUsers();
      _users = loaded;
      _namesById = {for (final u in loaded) u.id: u.fullName};
      // 28/09/2026: KHONG bat TypeError o day - getOrgUsers() (api_client.dart) da tu boc ca
      // DioException lan TypeError thanh ApiException roi (dung mau da thiet lap cua class do).
    } on ApiException {
      // Danh ba chi la du lieu HO TRO hien thi ten - that bai o day KHONG duoc chan man hinh nhan
      // tin (nguoi dung van xem/gui tin nhan binh thuong), chi khien nameFor() roi ve nhan chung
      // (xem duoi) thay vi ten that. RefreshIndicator cua man hinh danh sach se goi lai ensureLoaded()
      // moi lan keo-de-lam-moi vi _users van rong sau 1 lan that bai.
    }
  }

  /// Khong bao gio tra ve UUID tho (bai hoc tu tinh nang Phat hien bat thuong, xem
  /// Doc/RevisionHistory.md) - roi ve nhan chung "Thành viên" neu chua tai xong/khong tim thay.
  String nameFor(String userId) => _namesById[userId] ?? 'Thành viên';
}
