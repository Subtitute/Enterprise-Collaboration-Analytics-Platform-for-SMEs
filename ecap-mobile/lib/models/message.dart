/// Khop voi Message entity (apps/messaging-service/src/entities/message.entity.ts) - response cua
/// GET/POST /conversations/:id/messages VA payload `message` trong su kien WebSocket 'message:new'.
class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String body;
  final DateTime createdAt;

  Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.body,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      senderId: json['senderId'] as String,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Chen 1 tin nhan (tu WebSocket 'message:new' hoac tu chinh minh vua gui thanh cong qua REST) vao
/// danh sach da co, GIU THU TU TANG DAN theo createdAt va loai trung theo id - can loai trung vi
/// tin nhan CUA CHINH NGUOI GUI se den qua CA HAI duong: response cua POST .../messages (goi
/// sendConversationMessage()) VA su kien 'message:new' (server phat toi room cua MOI thanh vien,
/// bao gom ca nguoi gui - xem MessagingGateway.emitNewMessage()).
List<Message> insertMessageSorted(List<Message> existing, Message incoming) {
  if (existing.any((m) => m.id == incoming.id)) return existing;
  final result = List<Message>.from(existing);
  var insertAt = result.length;
  for (var i = 0; i < result.length; i++) {
    if (result[i].createdAt.isAfter(incoming.createdAt)) {
      insertAt = i;
      break;
    }
  }
  result.insert(insertAt, incoming);
  return result;
}
