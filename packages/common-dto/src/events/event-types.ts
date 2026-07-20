/**
 * Kafka topic va event type constants dung chung cho toan bo nen tang.
 * Nguon: Technical_Spec.md muc 4.2 (chuan dat ten topic) va muc 3 (event moi service phat ra).
 * Moi thay doi o day anh huong den TAT CA producer/consumer - sua can dong bo ca 6 service.
 */

export const KAFKA_TOPICS = {
  IAM: 'iam.events',
  PROJECT_TASK: 'project-task.events',
  DOCUMENT: 'document.events',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export const EVENT_TYPES = {
  // IAM Service (Technical_Spec.md muc 3.2)
  ORGANIZATION_REGISTERED: 'iam.organization.registered',
  USER_REGISTERED: 'iam.user.registered',
  USER_DEACTIVATED: 'iam.user.deactivated',

  // Project & Task Service (Technical_Spec.md muc 3.3)
  TASK_CREATED: 'task.created',
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  PROJECT_CREATED: 'project.created',
  PROJECT_COMPLETED: 'project.completed',

  // Document Service (Technical_Spec.md muc 3.4)
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_SHARED: 'document.shared',
  DOCUMENT_DELETED: 'document.deleted',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/** Anh xa event type -> topic tuong ung, dung boi OutboxPublisherJob cua tung service. */
export const EVENT_TYPE_TOPIC_MAP: Record<EventType, KafkaTopic> = {
  [EVENT_TYPES.ORGANIZATION_REGISTERED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_REGISTERED]: KAFKA_TOPICS.IAM,
  [EVENT_TYPES.USER_DEACTIVATED]: KAFKA_TOPICS.IAM,

  [EVENT_TYPES.TASK_CREATED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.TASK_STATUS_CHANGED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.TASK_ASSIGNED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.PROJECT_CREATED]: KAFKA_TOPICS.PROJECT_TASK,
  [EVENT_TYPES.PROJECT_COMPLETED]: KAFKA_TOPICS.PROJECT_TASK,

  [EVENT_TYPES.DOCUMENT_UPLOADED]: KAFKA_TOPICS.DOCUMENT,
  [EVENT_TYPES.DOCUMENT_SHARED]: KAFKA_TOPICS.DOCUMENT,
  [EVENT_TYPES.DOCUMENT_DELETED]: KAFKA_TOPICS.DOCUMENT,
};

/** Consumer group id chuan - moi service subscribe dung 1 group rieng de nhan du 3 topic. */
export const KAFKA_CONSUMER_GROUPS = {
  NOTIFICATION_SERVICE: 'notification-service-group',
  ANALYTICS_SERVICE: 'analytics-service-group',
} as const;
