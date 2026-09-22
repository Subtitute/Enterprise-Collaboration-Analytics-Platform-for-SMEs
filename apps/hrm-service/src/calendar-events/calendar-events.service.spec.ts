import { ERROR_CODES, EVENT_TYPES, CalendarEventType } from '@app/common-dto';
import { CalendarEventsService } from './calendar-events.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

/**
 * Unit test cho CalendarEventsService (Lich cong ty, HRM-lite mo rong) - mirror pattern cua
 * leave-requests.service.spec.ts (mock thu cong DataSource/Repository/OutboxService, khong boot
 * NestJS module hay DB that).
 */
describe('CalendarEventsService', () => {
  const organizationId = 'org-1';
  const userId = 'admin-1';
  const calendarEventId = 'cal-1';

  function existingEvent(overrides: Record<string, unknown> = {}) {
    return {
      id: calendarEventId,
      organizationId,
      title: 'Tet Nguyen Dan',
      description: null,
      type: CalendarEventType.HOLIDAY,
      startDate: '2026-02-14',
      endDate: '2026-02-20',
      createdByUserId: userId,
      ...overrides,
    };
  }

  function createService(opts: {
    calendarEventRepoMock?: { findOne?: jest.Mock; find?: jest.Mock; save?: jest.Mock };
    managerMock?: { create?: jest.Mock; save?: jest.Mock; delete?: jest.Mock };
  } = {}) {
    const managerMock =
      opts.managerMock ??
      ({
        create: jest.fn((_entityClass: unknown, data: unknown) => data),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        delete: jest.fn().mockResolvedValue(undefined),
      } as { create: jest.Mock; save: jest.Mock; delete: jest.Mock });
    const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    const calendarEventRepoMock = opts.calendarEventRepoMock ?? {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

    const service = new CalendarEventsService(
      dataSourceMock as any,
      calendarEventRepoMock as any,
      outboxServiceMock as any,
    );

    return { service, dataSourceMock, managerMock, calendarEventRepoMock, outboxServiceMock };
  }

  describe('create', () => {
    it('tao muc lich moi thanh cong, ghi outbox event CALENDAR_EVENT_CREATED', async () => {
      const { service, outboxServiceMock } = createService();
      const dto: CreateCalendarEventDto = {
        title: 'Tet Nguyen Dan',
        type: CalendarEventType.HOLIDAY,
        startDate: '2026-02-14',
        endDate: '2026-02-20',
      };

      const result = await service.create(organizationId, userId, dto);

      expect(result.title).toBe('Tet Nguyen Dan');
      expect(result.organizationId).toBe(organizationId);
      expect(result.createdByUserId).toBe(userId);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: EVENT_TYPES.CALENDAR_EVENT_CREATED,
          payload: expect.objectContaining({ title: 'Tet Nguyen Dan', actorId: userId }),
        }),
      );
    });

    it('mac dinh endDate = startDate khi khong truyen endDate (muc lich 1 ngay)', async () => {
      const { service } = createService();
      const dto: CreateCalendarEventDto = {
        title: 'Hop toan cong ty',
        type: CalendarEventType.EVENT,
        startDate: '2026-03-01',
      };

      const result = await service.create(organizationId, userId, dto);

      expect(result.startDate).toBe('2026-03-01');
      expect(result.endDate).toBe('2026-03-01');
    });

    it('tu choi khi ngay bat dau sau ngay ket thuc, khong mo transaction', async () => {
      const { service, dataSourceMock } = createService();
      const dto: CreateCalendarEventDto = {
        title: 'x',
        type: CalendarEventType.EVENT,
        startDate: '2026-03-05',
        endDate: '2026-03-01',
      };

      await expect(service.create(organizationId, userId, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_DATE_RANGE_INVALID }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('tra ve danh sach khong loc khi khong truyen startDate/endDate', async () => {
      const calendarEventRepoMock = { find: jest.fn().mockResolvedValue([existingEvent()]) };
      const { service } = createService({ calendarEventRepoMock });

      const result = await service.findAll(organizationId, {});

      expect(result).toHaveLength(1);
      expect(calendarEventRepoMock.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId } }),
      );
    });

    it('loc theo khoang thoi gian dang xem (chong lan, khong chi bat dau trong khoang)', async () => {
      const calendarEventRepoMock = { find: jest.fn().mockResolvedValue([]) };
      const { service } = createService({ calendarEventRepoMock });

      await service.findAll(organizationId, { startDate: '2026-02-01', endDate: '2026-02-28' });

      const callArg = calendarEventRepoMock.find.mock.calls[0][0];
      expect(callArg.where.organizationId).toBe(organizationId);
      expect(callArg.where.endDate).toBeDefined();
      expect(callArg.where.startDate).toBeDefined();
    });
  });

  describe('findHolidayForDate (bo sung 17/09/2026 - chan cham cong vao ngay nghi le)', () => {
    it('tra ve muc lich HOLIDAY khop khoang ngay, loc dung type/organizationId', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(existingEvent()) };
      const { service } = createService({ calendarEventRepoMock });

      const result = await service.findHolidayForDate(organizationId, '2026-02-16');

      expect(result).toEqual(existingEvent());
      const callArg = calendarEventRepoMock.findOne.mock.calls[0][0];
      expect(callArg.where.organizationId).toBe(organizationId);
      expect(callArg.where.type).toBe(CalendarEventType.HOLIDAY);
    });

    it('tra ve null khi khong co ngay nghi le nao khop', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ calendarEventRepoMock });

      const result = await service.findHolidayForDate(organizationId, '2026-05-01');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('cap nhat thanh cong cac field duoc truyen, giu nguyen field khong truyen', async () => {
      const existing = existingEvent();
      const calendarEventRepoMock = {
        findOne: jest.fn().mockResolvedValue({ ...existing }),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      };
      const { service } = createService({ calendarEventRepoMock });
      const dto: UpdateCalendarEventDto = { title: 'Tet Am Lich' };

      const result = await service.update(organizationId, calendarEventId, dto);

      expect(result.title).toBe('Tet Am Lich');
      expect(result.startDate).toBe(existing.startDate);
      expect(result.endDate).toBe(existing.endDate);
    });

    it('bao NotFoundException khi khong tim thay muc lich', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ calendarEventRepoMock });

      await expect(service.update(organizationId, calendarEventId, { title: 'x' })).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_NOT_FOUND }),
      });
    });

    it('tu choi khi cap nhat khien ngay bat dau sau ngay ket thuc', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(existingEvent()) };
      const { service } = createService({ calendarEventRepoMock });

      await expect(
        service.update(organizationId, calendarEventId, { startDate: '2026-03-01' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_DATE_RANGE_INVALID }),
      });
    });
  });

  describe('delete', () => {
    it('xoa thanh cong, ghi outbox event CALENDAR_EVENT_DELETED', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(existingEvent()) };
      const { service, managerMock, outboxServiceMock } = createService({ calendarEventRepoMock });

      await service.delete(organizationId, calendarEventId, userId);

      expect(managerMock.delete).toHaveBeenCalledWith(expect.anything(), { id: calendarEventId, organizationId });
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: EVENT_TYPES.CALENDAR_EVENT_DELETED }),
      );
    });

    it('bao NotFoundException khi khong tim thay muc lich, khong mo transaction', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service, dataSourceMock } = createService({ calendarEventRepoMock });

      await expect(service.delete(organizationId, calendarEventId, userId)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_NOT_FOUND }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });
  });
});
