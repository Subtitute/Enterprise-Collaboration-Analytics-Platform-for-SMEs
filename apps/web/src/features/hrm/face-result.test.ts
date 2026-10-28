import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { describeFaceResult, toFacePercent } from './face-result';

// 28/10/2026: mock t() tra ve khoa + tham so de kiem tra dung nhanh, khong phu thuoc tep ngon ngu.
const t = ((key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key)) as unknown as TFunction;

describe('toFacePercent', () => {
  it('doi diem cosine sang phan tram, diem am coi la 0', () => {
    expect(toFacePercent(0.624)).toBe(62);
    expect(toFacePercent(-0.2)).toBe(0);
    expect(toFacePercent(1.0000001)).toBe(100);
  });
});

describe('describeFaceResult', () => {
  it('co diem tu server -> bao % va nguong (khop / khong khop)', () => {
    const face = { status: 'scored' as const, threshold: 0.35 };
    expect(describeFaceResult(t, face, true, 0.62)).toBe('hrm:attendancePage.faceResult.matched {"percent":62,"threshold":35}');
    expect(describeFaceResult(t, face, false, 0.2)).toBe('hrm:attendancePage.faceResult.notMatched {"percent":20,"threshold":35}');
  });

  it('khong co diem -> bao ly do', () => {
    expect(describeFaceResult(t, { status: 'notEnrolled' }, null, null)).toBe('hrm:attendancePage.faceResult.notEnrolled');
    expect(describeFaceResult(t, { status: 'noFace' }, null, null)).toBe('hrm:attendancePage.faceResult.noFace');
  });

  it('da co token nhung server khong nhan (het han/sai anh) -> bao dich vu chua doi chieu duoc', () => {
    expect(describeFaceResult(t, { status: 'scored', token: 'x' }, null, null)).toBe('hrm:attendancePage.faceResult.unavailable');
  });
});
