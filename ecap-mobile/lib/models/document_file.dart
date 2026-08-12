/// Khop toi thieu voi entity FileMeta (apps/document-service/src/entities/file-meta.entity.ts).
/// GET /files tra ve dang {data, meta} nhu moi danh sach phan trang khac (khac GET /folders).
class DocumentFile {
  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String? folderId;

  DocumentFile({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    required this.folderId,
  });

  factory DocumentFile.fromJson(Map<String, dynamic> json) {
    return DocumentFile(
      id: json['id'] as String,
      fileName: json['fileName'] as String,
      mimeType: json['mimeType'] as String,
      sizeBytes: (json['sizeBytes'] as num).toInt(),
      folderId: json['folderId'] as String?,
    );
  }
}

/// Doi bytes sang dang hien thi ngan gon (KB/MB) - dung cho danh sach file.
String formatFileSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
