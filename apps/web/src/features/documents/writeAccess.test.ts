// 26/10/2026: an/hien thao tac ghi tai lieu theo CUNG quy tac backend (cay toan cong ty chi Org Admin).
import { describe, it, expect } from 'vitest';
import { canWriteFile, canWriteFolder } from './writeAccess';

describe('canWriteFolder', () => {
  it('Org Admin luon ghi duoc, ke ca thu muc goc va thu muc backend danh dau chi xem', () => {
    expect(canWriteFolder(null, true)).toBe(true);
    expect(canWriteFolder({ canWrite: false }, true)).toBe(true);
  });

  it('nguoi khac: thu muc goc -> khong; theo co canWrite cua backend', () => {
    expect(canWriteFolder(null, false)).toBe(false);
    expect(canWriteFolder({ canWrite: false }, false)).toBe(false);
    expect(canWriteFolder({ canWrite: true }, false)).toBe(true);
  });

  it('chua biet thu muc hoac backend cu khong tra co -> hien (backend van chan)', () => {
    expect(canWriteFolder(undefined, false)).toBe(true);
    expect(canWriteFolder({}, false)).toBe(true);
  });
});

// 26/10/2026: nut ghi tung tep theo quyen cua chinh tep (FileShare EDIT trong cay toan cong ty).
describe('canWriteFile', () => {
  it('uu tien co canWrite cua tep, bo qua quyen thu muc', () => {
    expect(canWriteFile({ canWrite: true }, false)).toBe(true);
    expect(canWriteFile({ canWrite: false }, true)).toBe(false);
  });

  it('backend cu khong tra co hoac chua co tep -> theo quyen thu muc', () => {
    expect(canWriteFile({}, false)).toBe(false);
    expect(canWriteFile(null, true)).toBe(true);
  });
});
