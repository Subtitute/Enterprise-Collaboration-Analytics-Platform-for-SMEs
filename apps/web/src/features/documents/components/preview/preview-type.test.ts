// 27/10/2026: test phan loai dinh dang xem truoc (them docx/xlsx/pptx, giu nguyen pdf/anh/csv/van ban).
import {
  detectPreviewType,
  isOfficePreview,
  maxPreviewBytes,
  MAX_OFFICE_PREVIEW_SIZE_BYTES,
  MAX_PREVIEW_SIZE_BYTES,
} from './preview-type';

const f = (name: string, mimeType?: string) => ({ name, mimeType });

describe('detectPreviewType', () => {
  it.each([
    [f('a.pdf', 'application/pdf'), 'pdf'],
    [f('scan.PDF'), 'pdf'],
    [f('logo.png', 'image/png'), 'image'],
    [f('photo.jpeg'), 'image'],
    [f('data.csv', 'text/csv'), 'csv'],
    // Windows hay gan mime Excel cho .csv -> van la csv
    [f('export.csv', 'application/vnd.ms-excel'), 'csv'],
    [f('notes.txt', 'text/plain'), 'text'],
    [f('readme', 'text/markdown'), 'text'],
    [f('Báo cáo.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx'],
    [f('upload.bin', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx'],
    [f('report.DOCX', 'application/octet-stream'), 'docx'],
    [f('kpi.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'xlsx'],
    [f('old.xls', 'application/vnd.ms-excel'), 'xlsx'],
    [f('old.xls'), 'xlsx'],
    [f('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'pptx'],
    [f('deck.pptx', 'application/zip'), 'pptx'],
    [f('legacy.doc', 'application/msword'), 'unsupported'],
    [f('legacy.ppt', 'application/vnd.ms-powerpoint'), 'unsupported'],
    [f('archive.zip', 'application/zip'), 'unsupported'],
  ])('%o -> %s', (file, expected) => {
    expect(detectPreviewType(file)).toBe(expected);
  });

  it('returns unsupported for null', () => {
    expect(detectPreviewType(null)).toBe('unsupported');
  });
});

describe('isOfficePreview / maxPreviewBytes', () => {
  it('uses the lower size cap only for Office types', () => {
    expect(isOfficePreview('docx')).toBe(true);
    expect(isOfficePreview('xlsx')).toBe(true);
    expect(isOfficePreview('pptx')).toBe(true);
    expect(isOfficePreview('pdf')).toBe(false);
    expect(maxPreviewBytes('pptx')).toBe(MAX_OFFICE_PREVIEW_SIZE_BYTES);
    expect(maxPreviewBytes('pdf')).toBe(MAX_PREVIEW_SIZE_BYTES);
    expect(MAX_OFFICE_PREVIEW_SIZE_BYTES).toBe(15 * 1024 * 1024);
  });
});
