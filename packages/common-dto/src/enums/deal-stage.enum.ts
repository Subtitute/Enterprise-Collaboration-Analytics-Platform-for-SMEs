/** Giai doan pipeline ban hang (CRM-lite) - Technical_Spec.md muc 16, Wireframe.md muc 12. */
export enum DealStage {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
}

/**
 * 4 giai doan dang hoat dong (NEW/CONTACTED/PROPOSAL/NEGOTIATION) di chuyen tu do qua lai lan nhau
 * (khac voi TASK_STATUS_TRANSITIONS - pipeline ban hang khong tuyen tinh, deal co the quay lai giai
 * doan truoc khi khach hang doi y). WON/LOST la trang thai CUOI (terminal) - khong con chuyen tiep
 * duoc nua, dung 1 endpoint rieng danh dau thay vi cho phep PATCH stage tuy y (xem deals.controller.ts).
 */
const ACTIVE_STAGES = [DealStage.NEW, DealStage.CONTACTED, DealStage.PROPOSAL, DealStage.NEGOTIATION];

export const DEAL_STAGE_TRANSITIONS: Record<DealStage, DealStage[]> = {
  [DealStage.NEW]: ACTIVE_STAGES.filter((s) => s !== DealStage.NEW).concat(DealStage.WON, DealStage.LOST),
  [DealStage.CONTACTED]: ACTIVE_STAGES.filter((s) => s !== DealStage.CONTACTED).concat(DealStage.WON, DealStage.LOST),
  [DealStage.PROPOSAL]: ACTIVE_STAGES.filter((s) => s !== DealStage.PROPOSAL).concat(DealStage.WON, DealStage.LOST),
  [DealStage.NEGOTIATION]: ACTIVE_STAGES.filter((s) => s !== DealStage.NEGOTIATION).concat(DealStage.WON, DealStage.LOST),
  [DealStage.WON]: [],
  [DealStage.LOST]: [],
};
