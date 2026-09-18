// 25/07/2026: test moi cho formatDate/formatDateTime - phu 1 ban sua loi truoc do (22/07/2026,
// xem cn/utils.ts) buoc phai truyen timeZone: 'Asia/Ho_Chi_Minh' cho Intl.DateTimeFormat, vi truoc
// do ham dung timezone MAC DINH cua may/trinh duyet nguoi xem, gay lech ngay/gio o cac moc gan
// nua dem khi nguoi xem o mui gio khac GMT+7. Ep process.env.TZ ve mot mui gio KHONG PHAI Viet Nam
// (America/Los_Angeles) truoc khi chay - de bai test nay THAT SU that bai neu ai do lam mat tham
// so timeZone trong tuong lai, thay vi "vo tinh" pass chi vi may chay test tinh co dat gio VN.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { formatDate, formatDateTime, canAccessAdminArea } from './utils';

// 17/09/2026: test moi cho canAccessAdminArea() - thay the hasAdminRole(roles) (so khop TEN vai
// tro) bang kiem tra QUYEN that su (xem chu thich chi tiet tai utils.ts). Quan trong nhat can xac
// minh: fail CLOSED khi khong/chua co permissions (mang rong/undefined) - day la tinh an toan cot
// loi ke thua tu ham cu, sai o day se mo lai lo hong "roles rong = coi nhu la admin" da tung co.
describe('canAccessAdminArea', () => {
  it('fail CLOSED (tra ve false) khi permissions rong hoac undefined', () => {
    expect(canAccessAdminArea(undefined)).toBe(false);
    expect(canAccessAdminArea([])).toBe(false);
  });

  it('tra ve false khi permissions khong chua quyen quan tri nao', () => {
    expect(canAccessAdminArea(['task:view', 'document:upload'])).toBe(false);
  });

  it('tra ve true khi co it nhat 1 quyen quan tri (vd Manager chi co USER_INVITE)', () => {
    expect(canAccessAdminArea(['task:view', 'user:invite'])).toBe(true);
  });

  it('tra ve true voi Org Admin (co day du cac quyen quan tri)', () => {
    expect(canAccessAdminArea(['user:manage', 'department:manage', 'role:manage', 'calendar:manage', 'system:manage'])).toBe(true);
  });
});

describe('formatDate / formatDateTime (Asia/Ho_Chi_Minh)', () => {
  let originalTZ: string | undefined;

  beforeAll(() => {
    originalTZ = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
  });

  afterAll(() => {
    process.env.TZ = originalTZ;
  });

  it('chuyen dung sang ngay VN khi UTC va VN khac ngay lich (qua nua dem)', () => {
    // 2026-07-24T18:30:00Z = 2026-07-25 01:30 gio Viet Nam (UTC+7) -> khac NGAY voi UTC.
    expect(formatDate('2026-07-24T18:30:00.000Z')).toBe('25/07/2026');
  });

  it('formatDateTime hien dung gio VN (UTC+7) kem ngay da chuyen doi', () => {
    expect(formatDateTime('2026-07-24T18:30:00.000Z')).toBe('01:30 25/07/2026');
  });

  it('formatDateTime cong dung 7 tieng cho mot moc gio khac (khong qua nua dem)', () => {
    // 2026-03-15T09:05:00Z + 7h = 16:05 cung ngay 15/03/2026.
    expect(formatDateTime('2026-03-15T09:05:00.000Z')).toBe('16:05 15/03/2026');
  });

  it('formatDate tra ve "—" khi khong co gia tri hoac gia tri khong hop le', () => {
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('khong-phai-ngay-hop-le')).toBe('—');
  });

  it('formatDateTime tra ve "—" khi khong co gia tri hoac gia tri khong hop le', () => {
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('khong-phai-ngay-hop-le')).toBe('—');
  });
});
