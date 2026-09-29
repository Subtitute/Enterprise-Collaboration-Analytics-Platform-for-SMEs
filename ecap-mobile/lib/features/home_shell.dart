import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../core/auth_session.dart';
import '../core/user_directory.dart';
import 'attendance/attendance_page.dart';
import 'documents/documents_page.dart';
import 'leave_requests/leave_requests_page.dart';
import 'messaging/conversations_page.dart';
import 'notifications/notifications_page.dart';
import 'tasks/tasks_page.dart';

/// Khung dieu huong chinh - 7 tab: cham cong, nghi phep, cong viec, tai lieu, thong bao, nhan tin,
/// ho so.
/// 12/08/2026 (Doc/ECAP_Mobile.md muc 12): them Cong viec/Tai lieu sau khi ra soat lai pham vi -
/// Employee von da co quyen xem/cap nhat task va xem/tai tai lieu tren web
/// (packages/common-dto/src/enums/permission.enum.ts), pham vi "focused companion app" ban dau
/// bo sot 2 tinh nang nay du khong lien quan admin/bieu do. CRM (Deal) CO Y bi loai khoi app -
/// quan ly pipeline ban hang khong phai thao tac tu nhien tren dien thoai, xem tranh luan trong
/// lich su hoi thoai; Du an/Kanban keo-tha va quan tri thu muc (tao/xoa/chia se) van o web.
/// 28/09/2026: them tab Nhan tin (nhan tin noi bo 1:1/nhom, apps/messaging-service) - moi thanh
/// vien deu co MESSAGE_VIEW/MESSAGE_SEND mac dinh (xem packages/common-dto), khong can gate rieng.
class HomeShell extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession session;
  final VoidCallback onLoggedOut;

  const HomeShell({super.key, required this.apiClient, required this.session, required this.onLoggedOut});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tabIndex = 0;
  // 28/09/2026: tao 1 LAN duy nhat cho ca phien dang nhap (khong phai field cua widget - HomeShell
  // chi ton tai TRONG LUC dang dang nhap, xem main.dart) - danh ba tu "sach" moi lan dang nhap lai,
  // khong con so voi nguoi/to chuc CU sau khi dang xuat (xem chu thich UserDirectory).
  late final UserDirectory _userDirectory;

  @override
  void initState() {
    super.initState();
    _userDirectory = UserDirectory(widget.apiClient);
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      AttendancePage(apiClient: widget.apiClient),
      LeaveRequestsPage(apiClient: widget.apiClient),
      TasksPage(apiClient: widget.apiClient, session: widget.session),
      DocumentsPage(apiClient: widget.apiClient),
      NotificationsPage(apiClient: widget.apiClient),
      ConversationsPage(apiClient: widget.apiClient, session: widget.session, userDirectory: _userDirectory),
      _ProfileTab(session: widget.session, apiClient: widget.apiClient, onLoggedOut: widget.onLoggedOut),
    ];

    return Scaffold(
      body: IndexedStack(index: _tabIndex, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (index) => setState(() => _tabIndex = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.camera_alt), label: 'Chấm công'),
          NavigationDestination(icon: Icon(Icons.event_note), label: 'Nghỉ phép'),
          NavigationDestination(icon: Icon(Icons.task_alt), label: 'Công việc'),
          NavigationDestination(icon: Icon(Icons.folder), label: 'Tài liệu'),
          NavigationDestination(icon: Icon(Icons.notifications), label: 'Thông báo'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'Nhắn tin'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Hồ sơ'),
        ],
      ),
    );
  }
}

/// 28/09/2026: ra soat "sua ho so ca nhan" (Doc/ECAP_Mobile.md ra soat pham vi) - da doc truc tiep
/// UsersController/UsersService (apps/iam-service): PATCH /users/:id CHI nhan quyen user:manage
/// (Org Admin), KHONG co dieu kien OR "id === chinh minh" nhu GET /users/:id da co (xem
/// UsersController.findOne()) - nghia la KHONG co endpoint tu-cap-nhat-ho-so-cua-chinh-minh nao ca
/// (khac gia dinh ban dau). Vi vay man hinh nay CO CHU DICH van chi-xem (khong them form sua) -
/// day la 1 khoang trong xac nhan cua backend, khong phai bo sot cua mobile, ngoai pham vi sua o
/// day (them 1 endpoint /users/me moi thuoc apps/iam-service, khong duoc dung toi trong task nay).
class _ProfileTab extends StatelessWidget {
  final AuthSession session;
  final ApiClient apiClient;
  final VoidCallback onLoggedOut;

  const _ProfileTab({required this.session, required this.apiClient, required this.onLoggedOut});

  @override
  Widget build(BuildContext context) {
    final user = session.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(user?.fullName ?? '', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(user?.email ?? '', style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 4),
            Text(user?.roleNames.join(', ') ?? ''),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: () async {
                await apiClient.logout();
                onLoggedOut();
              },
              icon: const Icon(Icons.logout),
              label: const Text('Đăng xuất'),
            ),
          ],
        ),
      ),
    );
  }
}
