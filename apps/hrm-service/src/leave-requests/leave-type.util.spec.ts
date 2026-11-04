import { LeaveType } from '@app/common-dto';
import { LeaveTypeBackfillService } from './leave-type-backfill.service';
import { LEGACY_REASON_PATTERNS, inferLeaveTypeFromReason } from './leave-type.util';

/** 04/11/2026: suy loai nghi tu tien to cu va backfill don cu. */
describe('inferLeaveTypeFromReason', () => {
  it.each([
    ['[SICK] Sốt xuất huyết', LeaveType.SICK],
    ['[sick] viết thường', LeaveType.SICK],
    ['  [SICK] có khoảng trắng đầu', LeaveType.SICK],
    ['[Nghỉ ốm] đi viện', LeaveType.SICK],
    ['[Nghỉ ốm có lương] đi viện', LeaveType.SICK],
    ['[Sick leave] flu', LeaveType.SICK],
    ['Sick leave for flu', LeaveType.SICK],
    ['[病気休暇] 風邪', LeaveType.SICK],
    ['病気休暇', LeaveType.SICK],
    ['[UNPAID] Việc riêng', LeaveType.UNPAID],
    ['[Nghỉ việc riêng (Không lương)] về quê', LeaveType.UNPAID],
    ['[Personal leave (Unpaid)] family', LeaveType.UNPAID],
    ['Personal leave', LeaveType.UNPAID],
    ['[私用休暇（無給）] 用事', LeaveType.UNPAID],
  ])('%s -> %s', (reason, expected) => {
    expect(inferLeaveTypeFromReason(reason)).toBe(expected);
  });

  it.each([
    ['[ANNUAL] Du lịch'],
    ['[Nghỉ phép năm] Du lịch'],
    ['Việc gia đình'],
    ['Đưa con đi khám, xin [SICK] sau'],
    ['[ANNUAL] Sick leave cho con'],
    ['Nghỉ ốm không có ngoặc'],
    ['[SICKLY] không phải mã'],
    [''],
  ])('%s -> ANNUAL', (reason) => {
    expect(inferLeaveTypeFromReason(reason)).toBe(LeaveType.ANNUAL);
  });
});

describe('LeaveTypeBackfillService', () => {
  it('moi mau 1 cau UPDATE, chi dong vao don ANNUAL tao truoc moc, khong sua reason', async () => {
    const dataSource = { query: jest.fn().mockResolvedValueOnce([[], 2]).mockResolvedValueOnce([[], 1]) };
    const service = new LeaveTypeBackfillService(dataSource as any);

    await expect(service.backfill()).resolves.toBe(3);

    expect(dataSource.query).toHaveBeenCalledTimes(LEGACY_REASON_PATTERNS.length);
    const [sql, params] = dataSource.query.mock.calls[0];
    expect(sql).toContain('SET leave_type = $1 WHERE leave_type = $2 AND created_at < $3 AND reason ~* $4');
    expect(sql).not.toMatch(/SET[^W]*reason/);
    expect(params[0]).toBe(LeaveType.SICK);
    expect(params[1]).toBe(LeaveType.ANNUAL);
    expect(params[2]).toBe('2026-11-05T00:00:00+07:00');
    expect(dataSource.query.mock.calls[1][1][0]).toBe(LeaveType.UNPAID);
  });

  it('chay lai khong con dong nao -> 0 (idempotent)', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([[], 0]) };
    await expect(new LeaveTypeBackfillService(dataSource as any).backfill()).resolves.toBe(0);
  });

  it('loi SQL khong lam hong buoc khoi dong', async () => {
    const dataSource = { query: jest.fn().mockRejectedValue(new Error('db down')) };
    await expect(new LeaveTypeBackfillService(dataSource as any).onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
