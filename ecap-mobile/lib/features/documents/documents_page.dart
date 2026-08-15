import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../models/document_file.dart';
import '../../models/folder_item.dart';
import '../../models/paginated_response.dart';

/// Tai lieu (Doc/ECAP_Mobile.md muc 12) - duyet cay thu muc, xem file NGAY tren dien
/// thoai/trinh duyet (dung HET co che "Xem tep" disposition=inline ma web da co, khong render
/// PDF rieng trong app) va tai file moi len. KHONG tao/xoa/doi ten thu muc, khong quan ly chia
/// se - cac thao tac quan tri tai lieu do van tu nhien hon tren web, giu dung pham vi da chon.
class DocumentsPage extends StatefulWidget {
  final ApiClient apiClient;
  final String? folderId;
  final String title;

  const DocumentsPage({super.key, required this.apiClient, this.folderId, this.title = 'Tài liệu'});

  @override
  State<DocumentsPage> createState() => _DocumentsPageState();
}

class _DocumentsPageState extends State<DocumentsPage> {
  List<FolderItem> _folders = [];
  List<DocumentFile> _files = [];
  bool _loading = true;
  bool _uploading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    try {
      final rawFolders = await widget.apiClient.getList(
        '/folders',
        query: {if (widget.folderId != null) 'parentFolderId': widget.folderId},
      );
      final filesJson = await widget.apiClient.get(
        '/files',
        query: {if (widget.folderId != null) 'folderId': widget.folderId, 'limit': 100},
      );
      final filePage = PaginatedResponse.fromJson(filesJson, DocumentFile.fromJson);
      setState(() {
        _folders = rawFolders.map((f) => FolderItem.fromJson(f as Map<String, dynamic>)).toList();
        _files = filePage.data;
      });
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openFile(DocumentFile file) async {
    try {
      final json = await widget.apiClient.get('/files/${file.id}/download', query: {'disposition': 'inline'});
      final url = json['downloadUrl'] as String;
      final opened = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không mở được file')));
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _uploadFile() async {
    final result = await FilePicker.platform.pickFiles();
    final pickedFiles = result?.files ?? const [];
    // 12/08/2026 (ra soat): truoc day dung `.files.single`, nem StateError chua duoc bat (crash
    // am tham, nut Tai len "khong phan hoi") neu vi ly do nao do platform tra ve rong hoac nhieu
    // hon 1 file du `allowMultiple` mac dinh false - cung dang loi da tung sua o AttendancePage
    // (goi camera nam ngoai try/catch, xem Doc/ECAP_Mobile.md muc 8).
    if (pickedFiles.isEmpty || pickedFiles.first.path == null) return;
    final picked = pickedFiles.first;

    setState(() => _uploading = true);
    try {
      await widget.apiClient.postFile(
        '/files/upload',
        File(picked.path!),
        fileName: picked.name,
        fields: {if (widget.folderId != null) 'folderId': widget.folderId!},
      );
      await _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  IconData _fileIcon(String mimeType) {
    if (mimeType == 'application/pdf') return Icons.picture_as_pdf;
    if (mimeType.startsWith('image/')) return Icons.image;
    return Icons.insert_drive_file;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      floatingActionButton: FloatingActionButton(
        onPressed: _uploading ? null : _uploadFile,
        child: _uploading
            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.upload_file),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_errorMessage != null) Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                  if (_folders.isEmpty && _files.isEmpty) const Text('Thư mục này chưa có nội dung nào'),
                  ..._folders.map(
                    (folder) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.folder, color: Colors.amber),
                        title: Text(folder.name),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => DocumentsPage(
                              apiClient: widget.apiClient,
                              folderId: folder.id,
                              title: folder.name,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  ..._files.map(
                    (file) => Card(
                      child: ListTile(
                        leading: Icon(_fileIcon(file.mimeType)),
                        title: Text(file.fileName),
                        subtitle: Text(formatFileSize(file.sizeBytes)),
                        trailing: const Icon(Icons.open_in_new),
                        onTap: () => _openFile(file),
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
