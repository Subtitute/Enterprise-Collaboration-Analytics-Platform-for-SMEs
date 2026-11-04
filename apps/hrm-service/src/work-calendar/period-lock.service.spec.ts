import { ConflictException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';
import { TimesheetPeriod } from '../entities/timesheet-period.entity';
import { PeriodLockService, periodLockKey } from './period-lock.service';

/** 04/11/2026: xem period-lock.service.ts. Chua co dong ky cong nghia la thang dang mo. */
describe('PeriodLockService.assertOpen', () => {
  const org = 'org-1';

  function setup(rows: unknown[] = []) {
    const periodRepo = { find: jest.fn().mockResolvedValue(rows) };
    const manager = { find: jest.fn().mockResolvedValue(rows), query: jest.fn().mockResolvedValue([]) };
    return { service: new PeriodLockService(periodRepo as any), periodRepo, manager };
  }

  it('khong co ngay nao -> khong truy van', async () => {
    const { service, periodRepo } = setup();
    await service.assertOpen(org, []);
    expect(periodRepo.find).not.toHaveBeenCalled();
  });

  it('chua co dong ky cong hoac ky dang OPEN -> cho qua (ky da mo khoa lai)', async () => {
    await expect(setup().service.assertOpen(org, ['2026-10-05'])).resolves.toBeUndefined();
    await expect(setup([{ year: 2026, month: 10, status: 'OPEN' }]).service.assertOpen(org, ['2026-10-05'])).resolves.toBeUndefined();
  });

  it('thang da khoa -> 409 TIMESHEET_PERIOD_LOCKED kem thang', async () => {
    const { service } = setup([{ year: 2026, month: 9, status: 'LOCKED' }]);
    const error = await service.assertOpen(org, ['2026-09-30']).catch((err) => err);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ errorCode: ERROR_CODES.TIMESHEET_PERIOD_LOCKED, errorParams: { month: '2026-09' } });
  });

  it('nhieu ngay cung thang chi hoi 1 lan moi thang, dung to chuc', async () => {
    const { service, periodRepo } = setup();
    await service.assertOpen(org, ['2026-12-30', '2026-12-31', '2027-01-01']);
    expect(periodRepo.find.mock.calls[0][0].where).toEqual([
      { organizationId: org, year: 2026, month: 12 },
      { organizationId: org, year: 2027, month: 1 },
    ]);
  });

  it('don vat qua thang: chi 1 thang bi khoa van bi chan', async () => {
    const { service } = setup([
      { year: 2026, month: 12, status: 'OPEN' },
      { year: 2027, month: 1, status: 'LOCKED' },
    ]);
    await expect(service.assertOpen(org, ['2026-12-30', '2027-01-01'])).rejects.toBeInstanceOf(ConflictException);
  });

  it('co manager: giu khoa tu van chia se truoc khi doc, doc trong giao dich, khong nap snapshot', async () => {
    const { service, manager, periodRepo } = setup();
    await service.assertOpen(org, ['2026-10-05'], manager as any);
    expect(periodRepo.find).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [periodLockKey(org, '2026-10')]);
    expect(manager.query.mock.invocationCallOrder[0]).toBeLessThan(manager.find.mock.invocationCallOrder[0]);
    const [entity, options] = manager.find.mock.calls[0];
    expect(entity).toBe(TimesheetPeriod);
    expect(options.select).not.toHaveProperty('snapshot');
  });

  it('don vat qua thang: lay khoa theo thu tu thang tang dan de khong deadlock', async () => {
    const { service, manager } = setup();
    await service.assertOpen(org, ['2027-01-01', '2026-12-30'], manager as any);
    expect(manager.query.mock.calls.map((call) => call[1][0])).toEqual([periodLockKey(org, '2026-12'), periodLockKey(org, '2027-01')]);
  });

  it('khong co manager: khong lay khoa tu van', async () => {
    const { service, manager } = setup();
    await service.assertOpen(org, ['2026-10-05']);
    expect(manager.query).not.toHaveBeenCalled();
  });
});
