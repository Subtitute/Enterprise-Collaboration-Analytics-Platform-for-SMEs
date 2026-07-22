// 22/07/2026: file moi - test cho buildContentDisposition, bao gom fix RFC 5987 (Fix 6, code review).
import { buildContentDisposition } from './content-disposition.util';

describe('buildContentDisposition (Content-Disposition header cho URL tai file MinIO)', () => {
  it('tao header dung dinh dang cho ten file ASCII thuan, khong dau', () => {
    const header = buildContentDisposition('attachment', 'report.pdf');
    expect(header).toBe(`attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`);
  });

  it('tach dung 2 hanh dong inline/attachment qua tham so type', () => {
    expect(buildContentDisposition('inline', 'a.pdf').startsWith('inline;')).toBe(true);
    expect(buildContentDisposition('attachment', 'a.pdf').startsWith('attachment;')).toBe(true);
  });

  it('ma hoa dung filename* theo RFC 5987 cho ten file co dau tieng Viet, va thay the o fallback ASCII', () => {
    const header = buildContentDisposition('attachment', 'Báo cáo.pdf');
    expect(header).toContain(`filename="B_o c_o.pdf"`);
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('Báo cáo.pdf')}`);
  });

  it('[Fix 6] ma hoa them 5 ky tu RFC 5987 loai tru ma encodeURIComponent bo sot: ! * \' ( )', () => {
    const header = buildContentDisposition('attachment', `it's (great)!*.pdf`);
    const encodedValue = header.match(/filename\*=UTF-8''(.+)$/)?.[1];
    expect(encodedValue).toBeDefined();
    expect(encodedValue).not.toMatch(/[!*'()]/);
    expect(encodedValue).toContain('%27'); // '
    expect(encodedValue).toContain('%2A'); // *
    expect(encodedValue).toContain('%21'); // !
    expect(encodedValue).toContain('%28'); // (
    expect(encodedValue).toContain('%29'); // )
  });

  it('[Fix 6] fallback ASCII bo ca dau nhay kep LAN dau gach cheo nguoc de khong pha vo cu phap quoted-string', () => {
    const header = buildContentDisposition('attachment', 'weird"name\\.pdf');
    const asciiValue = header.match(/filename="([^"]*)"/)?.[1];
    expect(asciiValue).toBeDefined();
    expect(asciiValue).not.toMatch(/["\\]/);
    expect(asciiValue).toBe('weirdname.pdf');
  });

  it('van thay the ky tu non-ASCII/dieu khien bang "_" o fallback ASCII (hanh vi cu, khong doi)', () => {
    const header = buildContentDisposition('attachment', 'tệp.pdf');
    const asciiValue = header.match(/filename="([^"]*)"/)?.[1];
    expect(asciiValue).not.toMatch(/[^\x20-\x7E]/);
  });

  it('ma hoa an toan ky tu CRLF o ca 2 nhanh (fallback ASCII va filename* RFC 5987) - ngan header injection', () => {
    const header = buildContentDisposition('attachment', 'evil\r\nX-Injected: 1.pdf');
    expect(header).not.toMatch(/\r|\n/);
  });
});
