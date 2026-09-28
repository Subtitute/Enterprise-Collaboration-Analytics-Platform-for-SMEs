import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import 'reset_password_page.dart';

/// "Quen mat khau" buoc 1 - chi nhap email, goi POST /auth/forgot-password (AuthController cua
/// apps/iam-service, bo sung 15/09/2026). Backend LUON tra ve thanh cong chung chung du email co
/// ton tai hay khong (chong do email - xem AuthService.forgotPassword()), nen sau khi gui thanh
/// cong man hinh LUON chuyen sang trang thai "da gui", khong bao gio bao "khong tim thay email" -
/// mirror dung hanh vi cua apps/web/src/features/auth/ForgotPasswordPage.tsx.
class ForgotPasswordPage extends StatefulWidget {
  final ApiClient apiClient;

  const ForgotPasswordPage({super.key, required this.apiClient});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _emailController = TextEditingController();
  bool _submitting = false;
  bool _submitted = false;
  String? _errorMessage;

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập email');
      return;
    }
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      await widget.apiClient.forgotPassword(email);
      if (mounted) setState(() => _submitted = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Quên mật khẩu')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: _submitted
                  ? [
                      const Icon(Icons.mark_email_read, size: 48, color: Colors.green),
                      const SizedBox(height: 16),
                      Text(
                        'Nếu email "${_emailController.text.trim()}" tồn tại trong hệ thống, '
                        'một liên kết đặt lại mật khẩu đã được gửi tới hộp thư của bạn.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (context) => ResetPasswordPage(apiClient: widget.apiClient)),
                        ),
                        child: const Text('Tôi đã có mã, đặt lại mật khẩu'),
                      ),
                    ]
                  : [
                      const Text(
                        'Nhập email đăng nhập của bạn, chúng tôi sẽ gửi liên kết đặt lại mật khẩu qua email.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                        onSubmitted: (_) => _submit(),
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: 12),
                        Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                      ],
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: _submitting ? null : _submit,
                        child: _submitting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Gửi liên kết'),
                      ),
                      const SizedBox(height: 16),
                      TextButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (context) => ResetPasswordPage(apiClient: widget.apiClient)),
                        ),
                        child: const Text('Đã có mã đặt lại mật khẩu? Nhập tại đây'),
                      ),
                    ],
            ),
          ),
        ),
      ),
    );
  }
}
