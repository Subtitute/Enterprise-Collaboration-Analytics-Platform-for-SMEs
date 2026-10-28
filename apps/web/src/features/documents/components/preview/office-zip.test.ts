// 27/10/2026: test chot chan zip bomb cho xem truoc Office (fixture ZIP tao trong bo nho bang fflate).
import { strToU8, zipSync } from 'fflate';
import { assertSafeOfficeZip, isZipData, OFFICE_ZIP_LIMITS, OfficeZipError, unzipOfficeEntries } from './office-zip';

const LIMITS = { fileBytes: 1024 * 1024, entries: 5, totalUncompressed: 64 * 1024 };

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof OfficeZipError ? err.code : `other:${String(err)}`;
  }
  return undefined;
}

describe('office zip guard', () => {
  const small = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8('<w:document/>') });

  it('detects the ZIP signature', () => {
    expect(isZipData(small)).toBe(true);
    expect(isZipData(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toBe(false);
    expect(isZipData(new Uint8Array([0x50]))).toBe(false);
  });

  it('accepts a normal archive and only extracts the entries it keeps', () => {
    expect(() => assertSafeOfficeZip(small, '[Content_Types].xml', LIMITS)).not.toThrow();
    const files = unzipOfficeEntries(small, (name) => name === 'word/document.xml', undefined, LIMITS);
    expect(Object.keys(files)).toEqual(['word/document.xml']);
  });

  it('rejects files above the byte cap before reading them', () => {
    expect(codeOf(() => assertSafeOfficeZip(small, undefined, { ...LIMITS, fileBytes: 10 }))).toBe('tooLarge');
  });

  it('rejects archives with too many entries', () => {
    const entries: Record<string, Uint8Array> = {};
    for (let i = 0; i < 6; i += 1) entries[`f${i}.xml`] = strToU8('<x/>');
    expect(codeOf(() => assertSafeOfficeZip(zipSync(entries), undefined, LIMITS))).toBe('tooManyEntries');
  });

  it('rejects a zip bomb by its declared uncompressed size without extracting it', () => {
    // 1 MB so 0 nen con vai tram byte -> vuot tong giai nen 64 KB
    const bomb = zipSync({ 'xl/worksheets/sheet1.xml': new Uint8Array(1024 * 1024) }, { level: 9 });
    expect(bomb.byteLength).toBeLessThan(10 * 1024);
    expect(codeOf(() => assertSafeOfficeZip(bomb, undefined, LIMITS))).toBe('uncompressedTooLarge');
    // ...va cung bi chan khi phan giai nen chon dung tep do
    expect(codeOf(() => unzipOfficeEntries(bomb, () => true, undefined, LIMITS))).toBe('uncompressedTooLarge');
  });

  it('reports corrupt data and missing required parts', () => {
    expect(codeOf(() => assertSafeOfficeZip(strToU8('not a zip at all'), undefined, LIMITS))).toBe('invalidZip');
    expect(codeOf(() => assertSafeOfficeZip(small, 'ppt/presentation.xml', LIMITS))).toBe('missingPart');
  });

  it('keeps sane defaults (15 MB file, 100 MB uncompressed)', () => {
    expect(OFFICE_ZIP_LIMITS.fileBytes).toBe(15 * 1024 * 1024);
    expect(OFFICE_ZIP_LIMITS.totalUncompressed).toBe(100 * 1024 * 1024);
  });

  // 28/10/2026: tran rieng cho word/document.xml va trang tinh - 1 .docx nho voi 100 000 doan van (~6,9 MB
  // giai nen, duoi tran tong 100 MB) khong con duoc giao cho docx-preview.
  it('rejects an oversized main document part or sheet part by its declared size', () => {
    const parts = { ...LIMITS, totalUncompressed: 10 * 1024 * 1024, documentPart: 64 * 1024, sheetPart: 128 * 1024 };
    const paragraphs = '<w:p><w:r><w:t>Doan van</w:t></w:r></w:p>'.repeat(5000);
    const manyParagraphs = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(`<w:document><w:body>${paragraphs}</w:body></w:document>`) }, { level: 9 });
    expect(manyParagraphs.byteLength).toBeLessThan(16 * 1024);
    expect(codeOf(() => assertSafeOfficeZip(manyParagraphs, '[Content_Types].xml', parts))).toBe('partTooLarge');

    const bigSheet = zipSync({ 'xl/workbook.xml': strToU8('<workbook/>'), 'xl/worksheets/sheet1.xml': new Uint8Array(200 * 1024) }, { level: 9 });
    expect(codeOf(() => assertSafeOfficeZip(bigSheet, 'xl/workbook.xml', parts))).toBe('partTooLarge');
    const bigStrings = zipSync({ 'xl/workbook.xml': strToU8('<workbook/>'), 'xl/sharedStrings.xml': new Uint8Array(200 * 1024) }, { level: 9 });
    expect(codeOf(() => assertSafeOfficeZip(bigStrings, 'xl/workbook.xml', parts))).toBe('partTooLarge');
    // phan khac (vd anh trong word/media) chi chiu tran tong
    const bigMedia = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/media/image1.png': new Uint8Array(200 * 1024) }, { level: 9 });
    expect(codeOf(() => assertSafeOfficeZip(bigMedia, '[Content_Types].xml', parts))).toBeUndefined();
  });

  it('default part caps: 5 MB document.xml, 20 MB per sheet part', () => {
    expect(OFFICE_ZIP_LIMITS.documentPart).toBe(5 * 1024 * 1024);
    expect(OFFICE_ZIP_LIMITS.sheetPart).toBe(20 * 1024 * 1024);
  });
});
