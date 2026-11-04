import { QueryFailedError } from 'typeorm';
import { CalendarEventType, ERROR_CODES } from '@app/common-dto';
import { WorkCalendarService } from './work-calendar.service';

/** 04/11/2026: mock thu cong Repository, mirror leave-policy.service.spec.ts. */
describe('WorkCalendarService', () => {
  const org = 'org-1';
  const stored = () => ({
    id: 's-1',
    organizationId: org,
    workingWeekdays: [1, 2, 3, 4, 5],
    workStart: '08:30',
    workEnd: '17:30',
    lateGraceMinutes: 0,
    earlyLeaveGraceMinutes: 0,
    breakMinutes: 60,
  });

  function setup(events: unknown[] = [], existing: unknown = stored()) {
    const scheduleRepo = {
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    const calendarEventRepo = { find: jest.fn().mockResolvedValue(events) };
    return { service: new WorkCalendarService(scheduleRepo as any, calendarEventRepo as any), scheduleRepo, calendarEventRepo };
  }

  async function errorOf(promise: Promise<unknown>): Promise<Record<string, unknown>> {
    try {
      await promise;
    } catch (err) {
      return (err as { response: Record<string, unknown> }).response;
    }
    throw new Error('Mong doi loi nhung khong co');
  }

  describe('getOrCreateSchedule', () => {
    it('da co thi tra ve, khong tao moi', async () => {
      const { service, scheduleRepo } = setup();
      await service.getOrCreateSchedule(org);
      expect(scheduleRepo.save).not.toHaveBeenCalled();
    });

    it('chua co thi tao theo to chuc', async () => {
      const { service, scheduleRepo } = setup([], null);
      await service.getOrCreateSchedule(org);
      expect(scheduleRepo.create).toHaveBeenCalledWith({ organizationId: org });
      expect(scheduleRepo.save).toHaveBeenCalledTimes(1);
    });

    it('2 request dau tien dong thoi: 23505 thi doc lai dong vua duoc tao', async () => {
      const { service, scheduleRepo } = setup([], null);
      const raced = stored();
      scheduleRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(raced);
      scheduleRepo.save.mockRejectedValueOnce(new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' })));
      await expect(service.getOrCreateSchedule(org)).resolves.toBe(raced);
    });

    it('loi khac 23505 van nem ra', async () => {
      const { service, scheduleRepo } = setup([], null);
      scheduleRepo.save.mockRejectedValueOnce(new Error('db down'));
      await expect(service.getOrCreateSchedule(org)).rejects.toThrow('db down');
    });
  });

  it('getSchedule tra kem hoursPerDay', async () => {
    const { service } = setup();
    await expect(service.getSchedule(org)).resolves.toMatchObject({ workStart: '08:30', hoursPerDay: 8 });
  });

  describe('updateSchedule', () => {
    it('chi doi truong duoc gui, sap xep weekday, tra kem hoursPerDay moi', async () => {
      const { service, scheduleRepo } = setup();
      const result = await service.updateSchedule(org, { workingWeekdays: [6, 1, 3], workEnd: '18:30' });
      expect(result).toMatchObject({ workingWeekdays: [1, 3, 6], workStart: '08:30', workEnd: '18:30', hoursPerDay: 9 });
      expect(scheduleRepo.save).toHaveBeenCalledTimes(1);
    });

    it('kiem tra tren gia tri SAU KHI gop: chi gui workEnd som hon workStart cu van bi chan', async () => {
      const { service, scheduleRepo } = setup();
      const response = await errorOf(service.updateSchedule(org, { workEnd: '08:00' }));
      expect(response.errorCode).toBe(ERROR_CODES.WORK_SCHEDULE_INVALID);
      expect(scheduleRepo.save).not.toHaveBeenCalled();
    });

    it('sai kieu du lieu tu client cung tra WORK_SCHEDULE_INVALID, khong loi 500', async () => {
      const { service } = setup();
      const response = await errorOf(service.updateSchedule(org, { workingWeekdays: 'x', breakMinutes: null } as any));
      expect(response.errorCode).toBe(ERROR_CODES.WORK_SCHEDULE_INVALID);
    });
  });

  describe('loadBook', () => {
    it('chi nap le va lam bu cham vao khoang, ket qua dung thu tu uu tien', async () => {
      const { service, calendarEventRepo } = setup([
        { type: CalendarEventType.HOLIDAY, title: 'Le', startDate: '2025-06-04', endDate: '2025-06-04' },
        { type: CalendarEventType.MAKEUP_WORKDAY, title: 'Bu', startDate: '2025-06-07', endDate: '2025-06-07' },
      ]);
      const book = await service.loadBook(org, '2025-06-01', '2025-06-30');

      const where = calendarEventRepo.find.mock.calls[0][0].where;
      expect(where.organizationId).toBe(org);
      expect(where.type.value).toEqual([CalendarEventType.HOLIDAY, CalendarEventType.MAKEUP_WORKDAY]);
      expect(where.startDate.value).toBe('2025-06-30');
      expect(where.endDate.value).toBe('2025-06-01');
      expect(book.isWorkingDay('2025-06-04')).toBe(false);
      expect(book.isWorkingDay('2025-06-07')).toBe(true);
    });
  });

  describe('summarizeRange', () => {
    it('tra so ngay lam viec va danh sach le trong khoang', async () => {
      const { service } = setup([{ type: CalendarEventType.HOLIDAY, title: 'Le', startDate: '2025-06-04', endDate: '2025-06-04' }]);
      await expect(service.summarizeRange(org, '2025-06-02', '2025-06-06')).resolves.toEqual({
        workingDays: 4,
        holidays: [{ date: '2025-06-04', title: 'Le' }],
      });
    });

    it('nhan ca ngay co phan gio ISO', async () => {
      const { service } = setup();
      await expect(service.summarizeRange(org, '2025-06-02T00:00:00.000Z', '2025-06-02T23:00:00.000Z')).resolves.toMatchObject({ workingDays: 1 });
    });

    it('bat dau sau ket thuc -> LEAVE_DATE_RANGE_INVALID, khong truy van', async () => {
      const { service, calendarEventRepo } = setup();
      const response = await errorOf(service.summarizeRange(org, '2025-06-06', '2025-06-02'));
      expect(response.errorCode).toBe(ERROR_CODES.LEAVE_DATE_RANGE_INVALID);
      expect(calendarEventRepo.find).not.toHaveBeenCalled();
    });

    it('dung 366 ngay duoc, 367 ngay bi chan', async () => {
      const { service, calendarEventRepo } = setup();
      await expect(service.summarizeRange(org, '2028-01-01', '2028-12-31')).resolves.toBeDefined();
      calendarEventRepo.find.mockClear();
      const response = await errorOf(service.summarizeRange(org, '2028-01-01', '2029-01-01'));
      expect(response.errorCode).toBe(ERROR_CODES.VALIDATION_INVALID);
      expect(calendarEventRepo.find).not.toHaveBeenCalled();
    });
  });
});
