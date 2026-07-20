import { TASK_STATUS_TRANSITIONS, TaskStatus } from '@app/common-dto';

/**
 * Kiem tra 1 lan chuyen trang thai Task (Kanban) co hop le hay khong, dua tren
 * TASK_STATUS_TRANSITIONS (packages/common-dto/src/enums/task-status.enum.ts) -
 * Technical_Spec.md muc 3.3, Wireframe.md muc 4.2 (keo-tha giua cac cot Kanban).
 *
 * Ham thuan (pure function) de co the unit test doc lap voi DB/HTTP layer,
 * tuong tu cach IAM tach `parseDurationMs` ra khoi AuthService.
 */
export function isValidTaskStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
