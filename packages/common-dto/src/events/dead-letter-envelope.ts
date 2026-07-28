// 28/07/2026: schema cho message tren KAFKA_TOPICS.DLQ (nang cap Dead Letter Queue - xem
// Technical_Spec.md muc 14 "Kafka consumer chua co DLQ", nay da co). Cac truong danh dau
// "| null" la vi mot so loi (JSON khong hop le, envelope thieu truong) xay ra TRUOC khi doc
// duoc eventId/eventType/organizationId that su tu message goc - van muon ghi nhan lai (thay vi
// chi log-va-bo-qua nhu truoc) nen chap nhan cac truong nay co the rong.
export type DeadLetterErrorType = 'MALFORMED_JSON' | 'INVALID_ENVELOPE' | 'PERMANENT_DATA_ERROR' | 'RETRY_EXHAUSTED';

export interface DeadLetterEnvelope {
  eventId: string | null;
  eventType: string | null;
  organizationId: string | null;
  /** Ten service da phat hien loi va day message nay vao DLQ (vd 'analytics-service'). */
  sourceService: string;
  /** Topic Kafka GOC chua message loi (vd 'project-task.events'), khac voi KAFKA_TOPICS.DLQ. */
  sourceTopic: string;
  errorType: DeadLetterErrorType;
  errorMessage: string;
  /** So lan da thu xu ly truoc khi bi day vao DLQ (luon la 1 voi MALFORMED_JSON/INVALID_ENVELOPE/PERMANENT_DATA_ERROR - khong co gia tri retry). */
  attempts: number;
  /** JSON.stringify cua message Kafka goc (hoac chuoi tho neu ban than no khong phai JSON hop le). */
  rawPayload: string;
  /** ISO-8601 UTC - thoi diem PHAT HIEN loi (khac voi thoi diem ghi vao DLQ topic/luu Mongo). */
  failedAt: string;
}
