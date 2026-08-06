import { DealStage } from '@app/common-dto';
import { isValidDealStageTransition } from './deal-stage.util';

/**
 * Unit test cho logic kiem tra chuyen giai doan Deal (Kanban pipeline ban hang) -
 * Technical_Spec.md muc 16. Mirror apps/project-task-service/src/tasks/task-status.util.spec.ts.
 */
describe('isValidDealStageTransition', () => {
  it('cho phep di chuyen tu do giua 4 giai doan dang hoat dong (khac Task - khong tuyen tinh)', () => {
    expect(isValidDealStageTransition(DealStage.NEW, DealStage.NEGOTIATION)).toBe(true);
    expect(isValidDealStageTransition(DealStage.NEGOTIATION, DealStage.NEW)).toBe(true);
    expect(isValidDealStageTransition(DealStage.PROPOSAL, DealStage.CONTACTED)).toBe(true);
  });

  it('cho phep chuyen tu bat ky giai doan dang hoat dong nao sang WON hoac LOST', () => {
    for (const stage of [DealStage.NEW, DealStage.CONTACTED, DealStage.PROPOSAL, DealStage.NEGOTIATION]) {
      expect(isValidDealStageTransition(stage, DealStage.WON)).toBe(true);
      expect(isValidDealStageTransition(stage, DealStage.LOST)).toBe(true);
    }
  });

  it('tu choi moi chuyen tiep tu WON hoac LOST (trang thai cuoi - terminal)', () => {
    for (const to of [DealStage.NEW, DealStage.CONTACTED, DealStage.PROPOSAL, DealStage.NEGOTIATION, DealStage.WON, DealStage.LOST]) {
      expect(isValidDealStageTransition(DealStage.WON, to)).toBe(false);
      expect(isValidDealStageTransition(DealStage.LOST, to)).toBe(false);
    }
  });

  it('tu choi chuyen ve chinh giai doan hien tai (no-op khong hop le)', () => {
    expect(isValidDealStageTransition(DealStage.NEW, DealStage.NEW)).toBe(false);
    expect(isValidDealStageTransition(DealStage.PROPOSAL, DealStage.PROPOSAL)).toBe(false);
  });
});
