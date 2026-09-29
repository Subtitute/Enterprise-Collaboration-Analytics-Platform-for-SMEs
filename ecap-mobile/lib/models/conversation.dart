/// Khop voi ConversationType (apps/messaging-service/src/entities/conversation-type.enum.ts).
enum ConversationType { direct, group }

ConversationType conversationTypeFromJson(String raw) {
  return raw == 'GROUP' ? ConversationType.group : ConversationType.direct;
}

String conversationTypeToJson(ConversationType type) {
  return type == ConversationType.group ? 'GROUP' : 'DIRECT';
}

/// Xem truoc tin nhan gan nhat cua 1 cuoc tro chuyen - khop `lastMessage` cua ConversationListItem
/// (apps/messaging-service/src/conversations/conversations.service.ts). Null neu chua co tin nhan nao.
class LastMessagePreview {
  final String body;
  final String senderId;
  final DateTime createdAt;

  LastMessagePreview({required this.body, required this.senderId, required this.createdAt});

  factory LastMessagePreview.fromJson(Map<String, dynamic> json) {
    return LastMessagePreview(
      body: json['body'] as String,
      senderId: json['senderId'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Khop voi ConversationListItem (GET /conversations) VA ConversationWithParticipants (POST
/// /conversations) - 2 hinh dang nay khac nhau (ConversationWithParticipants KHONG co
/// lastMessage/unreadCount), nen 2 field do luon doc "an toan" (mac dinh null/0) thay vi ep kieu
/// bat buoc - xem ghi chu tai fromJson().
class Conversation {
  final String id;
  final ConversationType type;
  final String? name;
  final List<String> participantUserIds;
  final LastMessagePreview? lastMessage;
  final int unreadCount;

  Conversation({
    required this.id,
    required this.type,
    required this.name,
    required this.participantUserIds,
    required this.lastMessage,
    required this.unreadCount,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    final rawLastMessage = json['lastMessage'];
    return Conversation(
      id: json['id'] as String,
      type: conversationTypeFromJson(json['type'] as String),
      name: json['name'] as String?,
      participantUserIds:
          (json['participantUserIds'] as List<dynamic>? ?? []).map((e) => e as String).toList(),
      lastMessage: rawLastMessage is Map<String, dynamic> ? LastMessagePreview.fromJson(rawLastMessage) : null,
      // 28/09/2026: response cua POST /conversations (tao/dedup 1 cuoc tro chuyen moi) la
      // ConversationWithParticipants, KHONG co field nay - mac dinh 0 thay vi ep kieu `as int` (se
      // nem TypeError ngay sau khi tao xong 1 cuoc tro chuyen moi tinh, truoc khi GET /conversations
      // lan dau tra ve).
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }
}

/// Tieu de hien thi tren danh sach/thanh AppBar: GROUP dung ten nhom that; DIRECT khong luu ten
/// rieng (chi 2 nguoi) nen suy ra tu ten NGUOI CON LAI (participantUserIds tru chinh minh) qua
/// [nameFor] (thuong la UserDirectory.nameFor - xem core/user_directory.dart). Nhan [nameFor] dang
/// callback (khong phai truyen thang UserDirectory) de ham nay thuan tuy, de viet test don vi.
String conversationDisplayTitle(
  Conversation conversation, {
  required String? selfUserId,
  required String Function(String userId) nameFor,
}) {
  if (conversation.type == ConversationType.group) {
    return conversation.name ?? 'Nhóm chưa đặt tên';
  }
  final otherId = conversation.participantUserIds.firstWhere((id) => id != selfUserId, orElse: () => '');
  return otherId.isEmpty ? 'Cuộc trò chuyện' : nameFor(otherId);
}

/// Nhan tren badge so tin chua doc - '' (an badge) neu da doc het, '99+' neu qua nhieu thay vi 1
/// con so dai lam vo bo cuc danh sach.
String unreadBadgeLabel(int unreadCount) {
  if (unreadCount <= 0) return '';
  if (unreadCount > 99) return '99+';
  return unreadCount.toString();
}
