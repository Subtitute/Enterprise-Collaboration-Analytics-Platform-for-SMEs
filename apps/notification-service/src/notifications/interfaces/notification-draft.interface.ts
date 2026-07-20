/**
 * Ket qua thuan (pure) cua ham anh xa event -> notification (xem
 * kafka/event-notification-builder.ts). Dat trong module `notifications` de tranh phu thuoc
 * nguoc: KafkaModule phu thuoc NotificationsModule (khong phai chieu nguoc lai).
 */
export interface NotificationDraft {
  userId: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
}
