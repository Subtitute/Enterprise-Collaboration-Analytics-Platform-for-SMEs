import 'package:flutter/material.dart';

import '../../core/api_client.dart';

/// "Quen mat khau" buoc 2 - dat mat khau moi bang token (AuthController.resetPassword() cua
/// apps/iam-service, bo sung 15/09/2026). Web doc token tu query string cua link trong email
/// (?token=..., xem apps/web/src/features/auth/ResetPasswordPage.tsx); mobile KHONG xu ly duong
/// dan sau/deep link nen nguoi dung phai tu dan token do vao truong ben duoi (huong dan ngay trong
/// man hinh) - khong lam gia them co che deep link chi cho 1 man hinh phu nay.
class ResetPasswordPage extends StatefulWidget {
  final ApiClient apiClient;

  const ResetPasswordPage({super.key, required this.apiClient});

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final _tokenController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _submitting = false;
  bool _succeeded = false;
  String? _errorMessage;

  Future<void> _submit() async {
    final token = _tokenController.text.trim();
    final newPassword = _newPasswordController.text;
    if (token.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng dán mã đặt lại mật khẩu nhận được qua email');
      return;
    }
    // Mirror dung rang buoc ResetPasswordDto.newPassword (@MinLength(8)) cua backend - bao loi
    // ngay tren dien thoai thay vi doi round-trip 400 tu server.
    if (newPassword.length < 8) {
      setState(() => _errorMessage = 'Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    if (newPassword != _confirmPasswordController.text) {
      setState(() => _errorMessage = 'Xác nhận mật khẩu không khớp');
      return;
    }
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      await widget.apiClient.resetPassword(token: token, newPassword: newPassword);
      if (mounted) setState(() => _succeeded = true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _tokenController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đặt lại mật khẩu')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: _succeeded
                  ? [
                      const Icon(Icons.check_circle, size: 48, color: Colors.green),
                      const SizedBox(height: 16),
                      const Text(
                        'Đặt lại mật khẩu thành công. Hãy đăng nhập lại bằng mật khẩu mới.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      FilledButton(
                        onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
                        child: const Text('Về trang đăng nhập'),
                      ),
                    ]
                  : [
                      const Text(
                        'Mở liên kết đặt lại mật khẩu trong email trên điện thoại, sao chép phần mã '
                        'sau "?token=" trong đường dẫn rồi dán vào ô bên dưới.',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        controller: _tokenController,
                        maxLines: 3,
                        decoration:
                            const InputDecoration(labelText: 'Mã đặt lại mật khẩu (token)', border: OutlineInputBorder()),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _newPasswordController,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Mật khẩu mới', border: OutlineInputBorder()),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _confirmPasswordController,
                        obscureText: true,
                        decoration:
                            const InputDecoration(labelText: 'Xác nhận mật khẩu mới', border: OutlineInputBorder()),
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
                            : const Text('Đặt lại mật khẩu'),
                      ),
                    ],
            ),
          ),
        ),
      ),
    );
  }
}
