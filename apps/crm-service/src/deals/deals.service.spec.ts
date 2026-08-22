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

    it('tao deal thanh cong khi customerId thuoc dung to chuc: gan stage NEW mac dinh + ownerUserId = actorId, ghi outbox DEAL_CREATED cung transaction', async () => {
      const customer = { id: 'cust-1', organizationId };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(customer),
        create: jest.fn().mockImplementation((_entity: unknown, data: unknown) => data),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve({ id: 'deal-new', ...entity })),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new DealsService(dataSourceMock as any, {} as any, {} as any, outboxServiceMock as any);

      const result = await service.create(organizationId, actorId, { customerId: 'cust-1', title: 'Deal moi' });

      expect(result).toMatchObject({ id: 'deal-new', stage: DealStage.NEW, ownerUserId: actorId, value: 0 });
      expect(managerMock.findOne).toHaveBeenCalledWith(expect.anything(), {
        where: { id: 'cust-1', organizationId },
      });
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.DEAL_CREATED,
          organizationId,
          payload: expect.objectContaining({ dealId: 'deal-new', customerId: 'cust-1', title: 'Deal moi', actorId }),
        }),
      );
    });
  });

  describe('findAll - tenant scoping + loc tuy chon theo customerId/stage', () => {
    it('luon gioi han theo organizationId, ap dung filter customerId/stage khi duoc cung cap, tinh dung skip/take theo trang', async () => {
      const dealRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const service = new DealsService({} as any, dealRepoMock as any, {} as any, {} as any);

      await service.findAll(organizationId, {
        page: 2,
        limit: 10,
        customerId: 'cust-1',
        stage: DealStage.NEW,
      } as any);

      expect(dealRepoMock.findAndCount).toHaveBeenCalledWith({
        where: { organizationId, customerId: 'cust-1', stage: DealStage.NEW },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });

    it('khong ap dung filter customerId/stage khi query khong cung cap', async () => {
      const dealRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const service = new DealsService({} as any, dealRepoMock as any, {} as any, {} as any);

      await service.findAll(organizationId, { page: 1, limit: 20 } as any);

      expect(dealRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId } }),
      );
    });
  });

  describe('findById - tenant scoping qua findDealOrFail', () => {
    it('nem NotFoundException (DEAL_NOT_FOUND) neu deal khong ton tai hoac thuoc to chuc khac', async () => {
      const dealRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new DealsService({} as any, dealRepoMock as any, {} as any, {} as any);

      await expect(service.findById(organizationId, dealId)).rejects.toThrow(NotFoundException);
      expect(dealRepoMock.findOne).toHaveBeenCalledWith({ where: { id: dealId, organizationId } });
    });

    it('tra ve deal khi tim thay dung trong to chuc goi', async () => {
      const deal = { id: dealId, organizationId, stage: DealStage.NEW };
      const dealRepoMock = { findOne: jest.fn().mockResolvedValue(deal) };
      const service = new DealsService({} as any, dealRepoMock as any, {} as any, {} as any);

      await expect(service.findById(organizationId, dealId)).resolves.toBe(deal);
    });
  });

  describe('update - tenant scoping + cap nhat tung phan', () => {
    it('nem NotFoundException neu deal khong ton tai/thuoc to chuc khac', async () => {
      const dealRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new DealsService({} as any, dealRepoMock as any, {} as any, {} as any);

      await expect(service.update(organizationId, dealId, { title: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('chi cap nhat cac truong duoc cung cap, giu nguyen cac truong con lai, chuyen expectedCloseDate (string ISO) sang Date', async () => {
      const existing = { id: dealId, organizationId, title: 'Cu', value: 100, expectedCloseDate: null };
      const dealRepoMock = {
        findOne: jest.fn().mockResolvedValue(existing),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      };
      const service = new DealsService({} as any, dealRepoMock as any, {} as any, {} as any);

      const result = await service.update(organizationId, dealId, {
        title: 'Moi',
        expectedCloseDate: '2026-09-01',
      });

      expect(result.title).toBe('Moi');
      expect(result.value).toBe(100);
      expect(result.expectedCloseDate).toBeInstanceOf(Date);
    });
  });

  describe('remove - pessimistic write lock + xoa idempotent (mirror TasksService.remove())', () => {
    it('nem NotFoundException neu deal khong ton tai/thuoc to chuc khac, KHONG mo transaction (tenant scoping)', async () => {
      const dealRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const dataSourceMock = { transaction: jest.fn() };
      const service = new DealsService(dataSourceMock as any, dealRepoMock as any, {} as any, {} as any);

      await expect(service.remove(organizationId, actorId, dealId)).rejects.toThrow(NotFoundException);
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('xoa thanh cong: khoa row bang pessimistic_write, remove() + ghi dung 1 event DEAL_DELETED trong cung transaction', async () => {
      const deal = { id: dealId, organizationId, customerId: 'cust-1' };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(deal),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const dealRepoMock = { findOne: jest.fn().mockResolvedValue(deal) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new DealsService(dataSourceMock as any, dealRepoMock as any, {} as any, outboxServiceMock as any);

      await expect(service.remove(organizationId, actorId, dealId)).resolves.toBeUndefined();

      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(managerMock.remove).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.DEAL_DELETED,
          payload: expect.objectContaining({ dealId, customerId: 'cust-1', actorId }),
        }),
      );
    });

    it('goi remove() tren deal da bi xoa truoc do khong nem loi (idempotent) - khong remove() lai, khong ghi outbox lai', async () => {
      const deal = { id: dealId, organizationId, customerId: 'cust-1' };
      const managerMock = {
        // Row da bi 1 request dong thoi khac xoa mat giua luc pre-check va luc khoa.
        findOne: jest.fn().mockResolvedValue(null),
        remove: jest.fn(),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      // Pre-check (khong khoa, dau ham) van thay deal ton tai tai thoi diem do.
      const dealRepoMock = { findOne: jest.fn().mockResolvedValue(deal) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new DealsService(dataSourceMock as any, dealRepoMock as any, {} as any, outboxServiceMock as any);

      await expect(service.remove(organizationId, actorId, dealId)).resolves.toBeUndefined();

      expect(managerMock.remove).not.toHaveBeenCalled();
      expect(outboxServiceMock.record).not.toHaveBeenCalled();
    });
  });
});
