import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DealStage, EVENT_TYPES } from '@app/common-dto';
import { DealsService } from './deals.service';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';

/**
 * Unit test cho DealsService, tap trung vao race-condition cua updateStage() (keo-tha Kanban
 * pipeline ban hang) - mirror apps/project-task-service/src/tasks/tasks.service.spec.ts
 * (TasksService.updateStatus()), cung 1 pattern pessimistic-write-lock + re-check.
 */
describe('DealsService', () => {
  const organizationId = 'org-1';
  const dealId = 'deal-1';
  const actorId = 'actor-1';

  describe('updateStage - fix race condition keo-tha dong thoi (mirror TasksService.updateStatus)', () => {
    function createService(preCheckStage: DealStage, lockedStage: DealStage) {
      const lockedDeal = { id: dealId, organizationId, stage: lockedStage, customerId: 'cust-1' };

      const managerMock = {
        findOneOrFail: jest.fn().mockResolvedValue(lockedDeal),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const dealRepoMock = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: dealId, organizationId, stage: preCheckStage, customerId: 'cust-1' }),
      };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new DealsService(
        dataSourceMock as any,
        dealRepoMock as any,
        {} as any,
        outboxServiceMock as any,
      );

      return { service, managerMock, outboxServiceMock };
    }

    it('tu choi neu row vua duoc khoa BEN TRONG transaction da doi giai doan (stale pre-check khong con dung)', async () => {
      // Pre-check: snapshot cu la NEW -> WON hop le. Nhung giua luc pre-check va luc lock, 1 request
      // khac da doi row that su thanh LOST -> chuyen tiep tu LOST la KHONG hop le (terminal).
      const { service, managerMock } = createService(DealStage.NEW, DealStage.LOST);
      const dto: UpdateDealStageDto = { stage: DealStage.WON };

      await expect(service.updateStage(organizationId, dealId, actorId, dto)).rejects.toThrow(
        BadRequestException,
      );

      expect(managerMock.findOneOrFail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(managerMock.save).not.toHaveBeenCalled();
    });

    it('cho phep khi row vua khoa van con hop le - cap nhat Deal + ghi Outbox cung transaction, gan closedAt khi chuyen sang WON', async () => {
      const { service, managerMock, outboxServiceMock } = createService(DealStage.NEGOTIATION, DealStage.NEGOTIATION);
      const dto: UpdateDealStageDto = { stage: DealStage.WON };

      const updated = await service.updateStage(organizationId, dealId, actorId, dto);

      expect(updated.stage).toBe(DealStage.WON);
      expect((updated as any).closedAt).toBeInstanceOf(Date);
      expect(managerMock.save).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.DEAL_STAGE_CHANGED,
          payload: expect.objectContaining({ dealId, fromStage: DealStage.NEGOTIATION, toStage: DealStage.WON }),
        }),
      );
    });

    it('tu choi chuyen tiep tu WON (trang thai cuoi) ngay o pre-check, khong mo transaction', async () => {
      const { service, managerMock } = createService(DealStage.WON, DealStage.WON);
      const dto: UpdateDealStageDto = { stage: DealStage.NEGOTIATION };

      await expect(service.updateStage(organizationId, dealId, actorId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(managerMock.findOneOrFail).not.toHaveBeenCalled();
    });
  });

  describe('create - xac minh customerId thuoc dung organizationId truoc khi tao Deal', () => {
    it('tu choi voi NotFoundException neu khong tim thay khach hang trong to chuc goi', async () => {
      const managerMock = { findOne: jest.fn().mockResolvedValue(null) };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };

      const service = new DealsService(dataSourceMock as any, {} as any, {} as any, {} as any);

      await expect(
        service.create(organizationId, actorId, { customerId: 'cust-other-org', title: 'Deal moi' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
