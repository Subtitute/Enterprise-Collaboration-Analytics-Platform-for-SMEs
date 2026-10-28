import * as XLSX from 'xlsx';
import { assertSafeOfficeZip, isZipData, OfficeZipError } from './office-zip';

// 27/10/2026: xem truoc .xlsx/.xls bang SheetJS (da co san trong dependencies, chunk vendor-xlsx).
// Chi doc GIA TRI (ket qua cong thuc da luu trong tep, cellFormula: false -> khong bao gio hien
// cong thuc), khong doc style/HTML/VBA; gioi han so dong ngay luc phan tich (sheetRows) va so cot
// luc dung bang de tep lon khong lam treo tab. Bang duoc dung bang phan tu React tu
// sheet_to_json(header: 1) - KHONG dung sheet_to_html/dangerouslySetInnerHTML.
export const SHEET_LIMITS = { rows: 500, cols: 50 };

export interface SheetView {
  name: string;
  /** Nhan cot kieu Excel (A, B, ...). */
  columns: string[];
  /** So dong Excel (1-based) cua tung dong hien thi. */
  rowNumbers: number[];
  rows: string[][];
  /** Kich thuoc that cua trang tinh (truoc khi cat). */
  totalRows: number;
  totalCols: number;
}

/** 28/10/2026: chu ky OLE/CFB (D0 CF 11 E0 A1 B1 1A E1) cua .xls nhi phan cu. */
function isCfbData(data: Uint8Array): boolean {
  const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return data.length >= sig.length && sig.every((byte, i) => data[i] === byte);
}

export function readWorkbook(data: Uint8Array, limits = SHEET_LIMITS): XLSX.WorkBook {
  // .xlsx la ZIP -> qua chot chan zip bomb truoc; .xls nhi phan cu (CFB) chi chiu gioi han dung luong tep.
  // 28/10/2026: tep rong/doi duoi (HTML, van ban...) truoc day SheetJS van "doc" duoc thanh 1 bang Sheet1
  // trong hoac bang tu HTML, khac han .docx/.pptx cung loi (bao loi). Gio chi nhan ZIP co xl/workbook.xml
  // hoac CFB, con lai bao loi -> cung giao dien loi kem nut tai xuong.
  if (isZipData(data)) assertSafeOfficeZip(data, 'xl/workbook.xml');
  else if (!isCfbData(data)) throw new OfficeZipError('invalidZip');
  return XLSX.read(data, {
    type: 'array',
    sheetRows: limits.rows,
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
  });
}

/** Trang tinh hien thi (bo trang tinh an); neu tat ca deu an thi tra ve toan bo. */
export function visibleSheetNames(wb: XLSX.WorkBook): string[] {
  const visible = wb.SheetNames.filter((_, i) => !wb.Workbook?.Sheets?.[i]?.Hidden);
  return visible.length > 0 ? visible : wb.SheetNames;
}

export function buildSheetView(wb: XLSX.WorkBook, name: string, limits = SHEET_LIMITS): SheetView {
  const ws = wb.Sheets[name];
  const empty: SheetView = { name, columns: [], rowNumbers: [], rows: [], totalRows: 0, totalCols: 0 };
  if (!ws || !ws['!ref']) return empty;
  const full = XLSX.utils.decode_range(ws['!fullref'] ?? ws['!ref']);
  const ref = XLSX.utils.decode_range(ws['!ref']);
  const range = {
    s: ref.s,
    e: { r: Math.min(ref.e.r, ref.s.r + limits.rows - 1), c: Math.min(ref.e.c, ref.s.c + limits.cols - 1) },
  };
  const rows = XLSX.utils
    .sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '', blankrows: true, range })
    .map((row) => row.map((cell) => String(cell ?? '')));
  const columns: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) columns.push(XLSX.utils.encode_col(c));
  return {
    name,
    columns,
    rowNumbers: rows.map((_, i) => range.s.r + i + 1),
    rows,
    totalRows: full.e.r - full.s.r + 1,
    totalCols: full.e.c - full.s.c + 1,
  };
}
