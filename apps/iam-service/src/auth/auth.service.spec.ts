import { parseDurationMs } from './auth.service';

describe('parseDurationMs', () => {
  it('quy doi "15m" thanh 15 phut (ms)', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60_000);
  });

  it('quy doi "7d" thanh 7 ngay (ms)', () => {
    expect(parseDurationMs('7d')).toBe(7 * 86_400_000);
  });

  it('quy doi "30s" thanh 30 giay (ms)', () => {
    expect(parseDurationMs('30s')).toBe(30_000);
  });

  it('tra ve mac dinh 7 ngay khi chuoi khong hop le', () => {
    expect(parseDurationMs('invalid')).toBe(7 * 86_400_000);
  });
});
