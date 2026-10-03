import { ERROR_CODES, EVENT_TYPES, CalendarEventType, PERMISSIONS } from '@app/common-dto';
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

  // 03/10/2026: 3 bo permission tieu bieu cho 3 cap tham quyen (xem calendar-event-rank.util.ts) -
  // dung CHINH PERMISSION (khong phai ten vai tro) de dieu khien test, dung tinh than "gate theo
  // quyen, khong gate theo ten vai tro" cua ca tinh nang nay.
  const employeePermissions: string[] = [];
  const managerPermissions: string[] = [PERMISSIONS.CALENDAR_MANAGE];
  const orgAdminPermissions: string[] = [PERMISSIONS.CALENDAR_MANAGE, PERMISSIONS.ORG_MANAGE];

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
      createdByRank: 3,
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
    it('tao muc lich moi thanh cong (Org Admin tao HOLIDAY), ghi outbox event CALENDAR_EVENT_CREATED, createdByRank = 3', async () => {
      const { service, outboxServiceMock } = createService();
      const dto: CreateCalendarEventDto = {
        title: 'Tet Nguyen Dan',
        type: CalendarEventType.HOLIDAY,
        startDate: '2026-02-14',
        endDate: '2026-02-20',
      };

      const result = await service.create(organizationId, userId, orgAdminPermissions, dto);

      expect(result.title).toBe('Tet Nguyen Dan');
      expect(result.organizationId).toBe(organizationId);
      expect(result.createdByUserId).toBe(userId);
      expect(result.createdByRank).toBe(3);
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

      const result = await service.create(organizationId, userId, orgAdminPermissions, dto);

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

      await expect(service.create(organizationId, userId, orgAdminPermissions, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_DATE_RANGE_INVALID }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    // 03/10/2026: phan quyen tao moi - EVENT mo cho moi thanh vien, HOLIDAY doi hoi CALENDAR_MANAGE.
    it('Employee tao EVENT -> ok, createdByRank = 1', async () => {
      const { service } = createService();
      const dto: CreateCalendarEventDto = { title: 'Lien hoan phong ban', type: CalendarEventType.EVENT, startDate: '2026-03-01' };

      const result = await service.create(organizationId, 'employee-1', employeePermissions, dto);

      expect(result.createdByRank).toBe(1);
      expect(result.type).toBe(CalendarEventType.EVENT);
    });

    it('Employee tao HOLIDAY -> 403 (khong giu CALENDAR_MANAGE), khong mo transaction', async () => {
      const { service, dataSourceMock } = createService();
      const dto: CreateCalendarEventDto = { title: 'Tet', type: CalendarEventType.HOLIDAY, startDate: '2026-02-14' };

      await expect(service.create(organizationId, 'employee-1', employeePermissions, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_HOLIDAY }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('Manager tao HOLIDAY -> ok (giu CALENDAR_MANAGE), createdByRank = 2', async () => {
      const { service } = createService();
      const dto: CreateCalendarEventDto = { title: 'Tet', type: CalendarEventType.HOLIDAY, startDate: '2026-02-14' };

      const result = await service.create(organizationId, 'manager-1', managerPermissions, dto);

      expect(result.createdByRank).toBe(2);
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
    it('cap nhat thanh cong cac field duoc truyen, giu nguyen field khong truyen (Org Admin, chinh chu)', async () => {
      const existing = existingEvent();
      const calendarEventRepoMock = {
        findOne: jest.fn().mockResolvedValue({ ...existing }),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      };
      const { service } = createService({ calendarEventRepoMock });
      const dto: UpdateCalendarEventDto = { title: 'Tet Am Lich' };

      const result = await service.update(organizationId, userId, orgAdminPermissions, calendarEventId, dto);

      expect(result.title).toBe('Tet Am Lich');
      expect(result.startDate).toBe(existing.startDate);
      expect(result.endDate).toBe(existing.endDate);
    });

    it('bao NotFoundException khi khong tim thay muc lich', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service } = createService({ calendarEventRepoMock });

      await expect(
        service.update(organizationId, userId, orgAdminPermissions, calendarEventId, { title: 'x' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_NOT_FOUND }),
      });
    });

    it('tu choi khi cap nhat khien ngay bat dau sau ngay ket thuc', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(existingEvent()) };
      const { service } = createService({ calendarEventRepoMock });

      await expect(
        service.update(organizationId, userId, orgAdminPermissions, calendarEventId, { startDate: '2026-03-01' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_DATE_RANGE_INVALID }),
      });
    });
  });

  /**
   * 03/10/2026: ma tran phan quyen sua/xoa (Employee/Manager/Org Admin x EVENT/HOLIDAY x
   * chu/khong chu) - xem CalendarEventsService.assertCanModify(). Chi test qua update(); delete()
   * dung CHUNG 1 ham assertCanModify() nen khong lap lai toan bo ma tran, chi test rieng 1 ca o
   * describe('delete') ben duoi de xac nhan no CO duoc goi.
   */
  describe('phan quyen sua (assertCanModify, qua update())', () => {
    function mockRepoFor(existing: Record<string, unknown>) {
      return {
        findOne: jest.fn().mockResolvedValue(existing),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      };
    }

    it('Employee sua chinh EVENT cua minh -> ok', async () => {
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'employee-1', createdByRank: 1 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      const result = await service.update(organizationId, 'employee-1', employeePermissions, calendarEventId, { title: 'x' });

      expect(result.title).toBe('x');
    });

    it('Employee sua EVENT do Manager tao -> 403 (khong phai chu, khong giu CALENDAR_MANAGE)', async () => {
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'manager-1', createdByRank: 2 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      await expect(
        service.update(organizationId, 'employee-1', employeePermissions, calendarEventId, { title: 'x' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_NOT_OWNER }),
      });
    });

    it('Manager sua EVENT do Employee tao -> ok (tham quyen cao hon)', async () => {
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'employee-1', createdByRank: 1 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      const result = await service.update(organizationId, 'manager-1', managerPermissions, calendarEventId, { title: 'x' });

      expect(result.title).toBe('x');
    });

    it('Manager sua EVENT do Org Admin tao -> 403 (tham quyen khong cao hon)', async () => {
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'admin-1', createdByRank: 3 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      await expect(
        service.update(organizationId, 'manager-1', managerPermissions, calendarEventId, { title: 'x' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_LOWER_RANK }),
      });
    });

    it('Manager (tham quyen BANG NHAU) sua EVENT do Manager khac tao -> 403 (phai CAO HON, khong chi ">=")', async () => {
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'manager-2', createdByRank: 2 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      await expect(
        service.update(organizationId, 'manager-1', managerPermissions, calendarEventId, { title: 'x' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_LOWER_RANK }),
      });
    });

    it('Manager KHONG the "lach" kiem tra tham quyen bang cach doi EVENT cua Org Admin thanh HOLIDAY qua PATCH -> van 403 (hoi quy phat hien 03/10/2026)', async () => {
      // Truoc ban sua: `involvesHoliday` tinh theo CA existing LAN nextType, nen gui kem
      // `type: HOLIDAY` trong PATCH khien nhanh "backstop HOLIDAY" kich hoat nham va return ngay
      // (bo qua hoan toan so sanh tham quyen) - 1 Manager co the ghi de MOI field (ke ca title) cua
      // 1 EVENT do Org Admin tao chi bang cach "mao" doi type sang HOLIDAY.
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'admin-1', createdByRank: 3 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      await expect(
        service.update(organizationId, 'manager-1', managerPermissions, calendarEventId, {
          type: CalendarEventType.HOLIDAY,
          title: 'hijacked',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_LOWER_RANK }),
      });
    });

    it('Manager sua BAT KY HOLIDAY nao -> ok (giu CALENDAR_MANAGE, khong so sanh tham quyen voi HOLIDAY)', async () => {
      // HOLIDAY do Org Admin (rank 3) tao - cao hon Manager (rank 2), nhung HOLIDAY la "san choi
      // rieng" cua CALENDAR_MANAGE nen khong ap dung so sanh tham quyen nhu EVENT.
      const existing = existingEvent({ type: CalendarEventType.HOLIDAY, createdByUserId: 'admin-1', createdByRank: 3 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      const result = await service.update(organizationId, 'manager-1', managerPermissions, calendarEventId, { title: 'x' });

      expect(result.title).toBe('x');
    });

    it('Manager ha cap 1 HOLIDAY do Org Admin tao ve EVENT -> ok (van la thao tac tren HOLIDAY hien co)', async () => {
      const existing = existingEvent({ type: CalendarEventType.HOLIDAY, createdByUserId: 'admin-1', createdByRank: 3 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      const result = await service.update(organizationId, 'manager-1', managerPermissions, calendarEventId, {
        type: CalendarEventType.EVENT,
      });

      expect(result.type).toBe(CalendarEventType.EVENT);
    });

    it('Org Admin sua bat ky muc lich nao -> ok', async () => {
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'manager-1', createdByRank: 2 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      const result = await service.update(organizationId, 'admin-1', orgAdminPermissions, calendarEventId, { title: 'x' });

      expect(result.title).toBe('x');
    });

    it('Employee khong the doi EVENT cua CHINH MINH thanh HOLIDAY (backstop, bat ke la chu)', async () => {
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'employee-1', createdByRank: 1 });
      const { service } = createService({ calendarEventRepoMock: mockRepoFor(existing) });

      await expect(
        service.update(organizationId, 'employee-1', employeePermissions, calendarEventId, { type: CalendarEventType.HOLIDAY }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_HOLIDAY }),
      });
    });
  });

  describe('delete', () => {
    it('xoa thanh cong, ghi outbox event CALENDAR_EVENT_DELETED', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(existingEvent()) };
      const { service, managerMock, outboxServiceMock } = createService({ calendarEventRepoMock });

      await service.delete(organizationId, userId, orgAdminPermissions, calendarEventId);

      expect(managerMock.delete).toHaveBeenCalledWith(expect.anything(), { id: calendarEventId, organizationId });
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: EVENT_TYPES.CALENDAR_EVENT_DELETED }),
      );
    });

    it('Employee xoa EVENT do Manager tao -> 403 (khong mo transaction - mirror quy tac sua)', async () => {
      const existing = existingEvent({ type: CalendarEventType.EVENT, createdByUserId: 'manager-1', createdByRank: 2 });
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(existing) };
      const { service, dataSourceMock } = createService({ calendarEventRepoMock });

      await expect(
        service.delete(organizationId, 'employee-1', employeePermissions, calendarEventId),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_FORBIDDEN_NOT_OWNER }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('bao NotFoundException khi khong tim thay muc lich, khong mo transaction', async () => {
      const calendarEventRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const { service, dataSourceMock } = createService({ calendarEventRepoMock });

      await expect(
        service.delete(organizationId, userId, orgAdminPermissions, calendarEventId),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.CALENDAR_EVENT_NOT_FOUND }),
      });
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });
  });
});
