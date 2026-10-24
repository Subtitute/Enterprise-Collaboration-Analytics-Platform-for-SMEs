import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';
import { parseOptionalFaceMatchScore } from './face-match-score.util';

describe('parseOptionalFaceMatchScore', () => {
  it('tra ve undefined khi khong gui gia tri (chua dang ky khuon mat/khong phat hien duoc mat)', () => {
    expect(parseOptionalFaceMatchScore(undefined)).toBeUndefined();
    expect(parseOptionalFaceMatchScore('')).toBeUndefined();
  });

  // 24/10/2026 (fix phat hien qua QA doc lap): Number("   ") = 0 trong JS (khong phai NaN) - neu
  // khong tu trim truoc, chuoi chi co khoang trang se bi hieu nham thanh diem so 0 (ket luan RO
  // RANG "khong khop") thay vi dung nghia "khong co du lieu".
  it('tra ve undefined khi gia tri chi co khoang trang (khong bi hieu nham thanh 0)', () => {
    expect(parseOptionalFaceMatchScore('   ')).toBeUndefined();
  });

  it('tra ve dung so thuc khi gia tri hop le trong khoang [-1, 1]', () => {
    expect(parseOptionalFaceMatchScore('0.9')).toBe(0.9);
    expect(parseOptionalFaceMatchScore('-1')).toBe(-1);
    expect(parseOptionalFaceMatchScore('1')).toBe(1);
    expect(parseOptionalFaceMatchScore('0')).toBe(0);
  });

  it('nem BadRequestException kem errorCode INVALID_FACE_MATCH_SCORE khi gia tri khong phai so', () => {
    expect(() => parseOptionalFaceMatchScore('abc')).toThrow(BadRequestException);
    try {
      parseOptionalFaceMatchScore('abc');
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toMatchObject({ errorCode: ERROR_CODES.INVALID_FACE_MATCH_SCORE });
    }
  });

  it('nem BadRequestException khi gia tri vuot khoang [-1, 1] THAT SU (khong phai sai so lam tron)', () => {
    expect(() => parseOptionalFaceMatchScore('1.5')).toThrow(BadRequestException);
    expect(() => parseOptionalFaceMatchScore('-1.5')).toThrow(BadRequestException);
    expect(() => parseOptionalFaceMatchScore('50')).toThrow(BadRequestException);
  });

  // 24/10/2026: fix loi thuc te phat hien khi kiem thu song - ArcFace (float32) tra ve gia tri
  // nhu 1.0000001192092896 khi tu so sanh 1 vector voi chinh no (truong hop PHO BIEN NHAT trong
  // thuc te), KHONG duoc tu choi vi se vo hieu hoa hoan toan check-in that.
  it('kep (clamp) ve dung bien [-1, 1] khi gia tri lech NHO do sai so lam tron float32, KHONG nem loi', () => {
    expect(parseOptionalFaceMatchScore('1.0000001192092896')).toBe(1);
    expect(parseOptionalFaceMatchScore('-1.0000001192092896')).toBe(-1);
  });
});
