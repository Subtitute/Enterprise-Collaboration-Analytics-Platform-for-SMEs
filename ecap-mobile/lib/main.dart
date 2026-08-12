import 'package:flutter/material.dart';

import 'core/api_client.dart';
import 'core/auth_session.dart';
import 'features/auth/login_page.dart';
import 'features/home_shell.dart';

void main() {
  runApp(const EcapMobileApp());
}

class EcapMobileApp extends StatefulWidget {
  const EcapMobileApp({super.key});

  @override
  State<EcapMobileApp> createState() => _EcapMobileAppState();
}

class _EcapMobileAppState extends State<EcapMobileApp> {
  final AuthSession _session = AuthSession();
  ApiClient? _apiClient;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final client = await ApiClient.create(_session);
    // Neu con cookie ecap_refresh_token con han (vd mo lai app sau khi tat) thi tu dang nhap
    // lai - khong bat nguoi dung go lai mat khau moi lan mo app, giong hanh vi web da co.
    await client.tryAutoLogin();
    setState(() => _apiClient = client);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CollabNAnalytic',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: AnimatedBuilder(
        animation: _session,
        builder: (context, _) {
          if (_apiClient == null) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          if (!_session.isLoggedIn) {
            return LoginPage(apiClient: _apiClient!, onLoggedIn: () => setState(() {}));
          }
          return HomeShell(
            apiClient: _apiClient!,
            session: _session,
            onLoggedOut: () => setState(() {}),
          );
        },
      ),
    );
  }
}
