import { toJoinedAt } from './joined-at.util';

/** 04/11/2026: xem joined-at.util.ts. */
describe('toJoinedAt', () => {
  it('quy ve ngay theo lich GMT+7: 17:00 UTC da sang ngay hom sau', () => {
    expect(toJoinedAt(new Date('2024-03-14T16:59:59Z'))).toBe('2024-03-14');
    expect(toJoinedAt(new Date('2024-03-14T17:00:00Z'))).toBe('2024-03-15');
  });

  it('nhan ca chuoi ISO', () => {
    expect(toJoinedAt('2024-12-31T18:00:00.000Z')).toBe('2025-01-01');
  });

  it('khong co gia tri hoac sai dinh dang -> undefined', () => {
    expect(toJoinedAt(undefined)).toBeUndefined();
    expect(toJoinedAt(null)).toBeUndefined();
    expect(toJoinedAt('khong-phai-ngay')).toBeUndefined();
  });
});
