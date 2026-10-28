// 27/10/2026: test doc trang tinh cho xem truoc .xlsx/.xls (fixture tao trong bo nho bang SheetJS).
import * as XLSX from 'xlsx';
import { strToU8, zipSync } from 'fflate';
import { OfficeZipError } from './office-zip';
import { buildSheetView, readWorkbook, visibleSheetNames } from './xlsx-view';

function toBytes(wb: XLSX.WorkBook, bookType: XLSX.BookType = 'xlsx'): Uint8Array {
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType }) as ArrayBuffer);
}

describe('xlsx preview view', () => {
  it('shows cached formula results, never the formula text', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Phòng ban', 'Q1', 'Q2', 'Tổng'],
      ['Kinh doanh', 10, 20],
    ]);
    ws.D2 = { t: 'n', v: 30, f: 'B2+C2' };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'KPI');

    const view = buildSheetView(readWorkbook(toBytes(wb)), 'KPI');
    expect(view.columns).toEqual(['A', 'B', 'C', 'D']);
    expect(view.rowNumbers).toEqual([1, 2]);
    expect(view.rows).toEqual([
      ['Phòng ban', 'Q1', 'Q2', 'Tổng'],
      ['Kinh doanh', '10', '20', '30'],
    ]);
    expect(view.rows.flat().some((cell) => cell.includes('B2+C2'))).toBe(false);
  });

  it('caps rows and columns but reports the real sheet size', () => {
    const aoa = Array.from({ length: 30 }, (_, r) => Array.from({ length: 12 }, (_, c) => `${r}:${c}`));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Lớn');
    const limits = { rows: 10, cols: 5 };

    const view = buildSheetView(readWorkbook(toBytes(wb), limits), 'Lớn', limits);
    expect(view.rows).toHaveLength(10);
    expect(view.rows[0]).toHaveLength(5);
    expect(view.columns).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(view.totalRows).toBe(30);
    expect(view.totalCols).toBe(12);
    expect(view.rows[9][4]).toBe('9:4');
  });

  it('hides hidden sheets from the tabs and handles empty sheets', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['a']]), 'Hiện');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['b']]), 'Ẩn');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Trống');
    wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }, { Hidden: 0 }] };

    const parsed = readWorkbook(toBytes(wb));
    expect(visibleSheetNames(parsed)).toEqual(['Hiện', 'Trống']);
    expect(buildSheetView(parsed, 'Trống').rows).toEqual([]);
    expect(buildSheetView(parsed, 'Không có').rows).toEqual([]);
  });

  it('reads legacy .xls (not a ZIP) as well', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Mã', 'Tên'], [1, 'Máy chủ']]), 'Sheet1');
    const view = buildSheetView(readWorkbook(toBytes(wb, 'biff8')), 'Sheet1');
    expect(view.rows[1]).toEqual(['1', 'Máy chủ']);
  });

  // 28/10/2026: .xlsx rong/doi duoi bao loi giong .docx/.pptx thay vi hien 1 bang trong/bang tu HTML.
  it('rejects empty, renamed non-workbook and non-Excel ZIP files', () => {
    const codeOf = (data: Uint8Array) => {
      try {
        readWorkbook(data);
      } catch (err) {
        return err instanceof OfficeZipError ? err.code : 'other';
      }
      return undefined;
    };
    expect(codeOf(new Uint8Array(0))).toBe('invalidZip');
    expect(codeOf(strToU8('<html><body><table><tr><td>a</td></tr></table></body></html>'))).toBe('invalidZip');
    expect(codeOf(strToU8('a,b\n1,2'))).toBe('invalidZip');
    const docxRenamed = zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8('<w:document/>') });
    expect(codeOf(docxRenamed)).toBe('missingPart');
  });
});
