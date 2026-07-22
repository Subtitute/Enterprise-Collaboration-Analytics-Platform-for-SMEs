// 22/07/2026: file moi - test cho sanitizeFileName (Fix 1, code review).
import { FALLBACK_FILE_NAME, MAX_FILE_NAME_LENGTH, sanitizeFileName } from './sanitize-filename.util';

describe('sanitizeFileName (lam sach ten file upload - Fix 1, code review 22/07/2026)', () => {
  it('giu nguyen ten file hop le, khong co gi can lam sach', () => {
    expect(sanitizeFileName('bao-cao-quy-2.pdf')).toBe('bao-cao-quy-2.pdf');
  });

  it('giu nguyen ten file co dau tieng Viet (khong phai ky tu can loai bo)', () => {
    expect(sanitizeFileName('Báo cáo tháng 7.docx')).toBe('Báo cáo tháng 7.docx');
  });

  it('thay `/` va `\\` bang `_` - ngan object key MinIO bi "thoat" khoi thu muc du dinh', () => {
    expect(sanitizeFileName('../../../etc/passwd')).not.toContain('/');
    expect(sanitizeFileName('..\\..\\config.ini')).not.toContain('\\');
  });

  it('vo hieu hoa hoan toan chuoi path traversal dien hinh (khong con "/" hay ".." trong ket qua)', () => {
    const result = sanitizeFileName('../../../../etc/passwd');
    expect(result).not.toMatch(/\.\./);
    expect(result).not.toContain('/');
  });

  it('ten file chi gom ".." van cho ra ket qua an toan, khong con chuoi ".." nao', () => {
    expect(sanitizeFileName('..')).not.toMatch(/\.\./);
  });

  it('bo ky tu dieu khien dung de chen header (vd CR/LF)', () => {
    const result = sanitizeFileName('bao-cao\r\nSet-Cookie: hacked=1.pdf');
    expect(result).not.toMatch(/[\r\n]/);
  });

  it('bo toan bo ky tu dieu khien ASCII (ma < 0x20 va 0x7F)', () => {
    const withControlChars = 'a\x00b\x01c\x1fd\x7f.txt';
    const result = sanitizeFileName(withControlChars);
    // eslint-disable-next-line no-control-regex
    expect(result).not.toMatch(/[\x00-\x1F\x7F]/);
    expect(result).toBe('abcd.txt');
  });

  it('cat ten file qua dai ve toi da MAX_FILE_NAME_LENGTH ky tu, giu nguyen duoi mo rong', () => {
    const longName = 'a'.repeat(300) + '.pdf';
    const result = sanitizeFileName(longName);
    expect(result.length).toBe(MAX_FILE_NAME_LENGTH);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('cat ten file qua dai kem duoi mo rong dai bat thuong (van khong vuot gioi han)', () => {
    const longName = 'b'.repeat(250) + '.jpeg';
    const result = sanitizeFileName(longName);
    expect(result.length).toBeLessThanOrEqual(MAX_FILE_NAME_LENGTH);
  });

  it('tra ve ten fallback khi ket qua lam sach rong hoan toan (chi gom ky tu dieu khien, khong co duoi)', () => {
    expect(sanitizeFileName('\x00\x01\x02')).toBe(FALLBACK_FILE_NAME);
  });

  it('tra ve ten fallback nhung GIU LAI duoi mo rong khi "phan ten" rong nhung duoi mo rong con nguyen', () => {
    expect(sanitizeFileName('\x00\x01.pdf')).toBe(`${FALLBACK_FILE_NAME}.pdf`);
  });

  it('tra ve ten fallback khi ten file rong hoac chi gom khoang trang', () => {
    expect(sanitizeFileName('')).toBe(FALLBACK_FILE_NAME);
    expect(sanitizeFileName('   ')).toBe(FALLBACK_FILE_NAME);
  });

  it('khong lam thay doi ten file goc truyen vao (khong co side-effect)', () => {
    const original = '../secret.pdf';
    sanitizeFileName(original);
    expect(original).toBe('../secret.pdf');
  });
});
