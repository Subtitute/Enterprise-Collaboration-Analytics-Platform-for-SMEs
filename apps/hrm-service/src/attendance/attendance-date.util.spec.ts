import { toGmt7DateString } from './attendance-date.util';

describe('toGmt7DateString', () => {
  it('giu nguyen ngay khi gio UTC va GMT+7 cung ngay (buoi sang/chieu UTC)', () => {
    // 04/08/2026 10:00 UTC = 04/08/2026 17:00 GMT+7 - cung 1 ngay.
    expect(toGmt7DateString(new Date('2026-08-04T10:00:00.000Z'))).toBe('2026-08-04');
  });

  it('sang ngay hom sau o GMT+7 khi UTC con o khung 17:00-23:59 (chenh lech 1 ngay)', () => {
    // 04/08/2026 17:30 UTC = 05/08/2026 00:30 GMT+7 - da sang ngay moi theo lich GMT+7.
    expect(toGmt7DateString(new Date('2026-08-04T17:30:00.000Z'))).toBe('2026-08-05');
  });

  it('dung dung ranh gioi nua dem GMT+7 (23:59:59 UTC-1 ngay truoc -> 06:59:59 UTC cung ngay)', () => {
    // 06:59:59 UTC 05/08 = 13:59:59 GMT+7 05/08 - van cung ngay 05/08.
    expect(toGmt7DateString(new Date('2026-08-05T06:59:59.000Z'))).toBe('2026-08-05');
    // 17:00:00 UTC 05/08 = 00:00:00 GMT+7 06/08 - vua sang ngay moi.
    expect(toGmt7DateString(new Date('2026-08-05T17:00:00.000Z'))).toBe('2026-08-06');
  });
});
