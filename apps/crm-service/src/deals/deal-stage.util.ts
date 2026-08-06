import { DEAL_STAGE_TRANSITIONS, DealStage } from '@app/common-dto';

/**
 * Kiem tra 1 lan chuyen giai doan Deal (Kanban pipeline ban hang) co hop le hay khong, dua tren
 * DEAL_STAGE_TRANSITIONS (packages/common-dto/src/enums/deal-stage.enum.ts) - Technical_Spec.md
 * muc 16, Wireframe.md muc 12 (keo-tha giua cac cot Kanban).
 *
 * Ham thuan (pure function) de co the unit test doc lap voi DB/HTTP layer, mirror
 * apps/project-task-service/src/tasks/task-status.util.ts.
 */
export function isValidDealStageTransition(from: DealStage, to: DealStage): boolean {
  return DEAL_STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}
