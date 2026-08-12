/// Khop toi thieu voi entity Folder (apps/document-service/src/entities/folder.entity.ts).
/// GET /folders tra ve MANG THO (khong boc {data, meta} nhu cac danh sach khac trong nen tang).
class FolderItem {
  final String id;
  final String name;
  final String? parentFolderId;

  FolderItem({required this.id, required this.name, required this.parentFolderId});

  factory FolderItem.fromJson(Map<String, dynamic> json) {
    return FolderItem(
      id: json['id'] as String,
      name: json['name'] as String,
      parentFolderId: json['parentFolderId'] as String?,
    );
  }
}
