import { unzipSync } from 'fflate';
import { MAX_OFFICE_PREVIEW_SIZE_BYTES } from './preview-type';

// 27/10/2026: chot chan zip bomb cho xem truoc Office trong trinh duyet. docx/xlsx/pptx deu la ZIP;
// truoc khi giao du lieu cho docx-preview/SheetJS (hoac tu giai nen pptx) phai doc muc luc ZIP va
// kiem tra so tep + tong kich thuoc KHAI BAO (originalSize) trong bo loc cua fflate - bo loc chay
// TRUOC khi giai nen tung tep nen tep doc hai bi chan som (cung cach lam voi ZIP anh nhan dien o
// import-employees.utils.ts). Voi phan tu giai nen (pptx), fflate cap bo dem dung bang originalSize
// nen tep khai bao gia kich thuoc cung khong bung vuot gioi han.
export interface OfficeZipLimits {
  fileBytes: number;
  entries: number;
  totalUncompressed: number;
  /** 28/10/2026: tran KHAI BAO cua word/document.xml (khong dat = khong gioi han rieng). */
  documentPart?: number;
  /** 28/10/2026: tran KHAI BAO cua tung trang tinh xl/worksheets/*.xml va xl/sharedStrings.xml. */
  sheetPart?: number;
}

// 28/10/2026: them tran cho phan noi dung chinh - chi tran tong 100MB thi 1 .docx ~270KB chua 100 000
// doan van (word/document.xml ~6,9MB khi giai nen) van lot qua va lam dung luong chinh 4-5 giay khi
// docx-preview dung DOM (gan 1 phut voi tep chen sat 100MB). 5MB ~ 70 trang Word dinh dang day du nhu
// bo tai lieu demo (165-265KB cho 1-4 trang); trang tinh 20MB (SheetJS chi doc 500 dong dau, tep 9MB
// mat ~2 giay). Vuot tran -> giao dien loi san co kem nut tai xuong.
export const OFFICE_ZIP_LIMITS: OfficeZipLimits = {
  fileBytes: MAX_OFFICE_PREVIEW_SIZE_BYTES,
  entries: 3000,
  totalUncompressed: 100 * 1024 * 1024,
  documentPart: 5 * 1024 * 1024,
  sheetPart: 20 * 1024 * 1024,
};

const SHEET_PART = /^xl\/(worksheets\/[^/]+|sharedStrings)\.xml$/;

function partLimit(name: string, limits: OfficeZipLimits): number {
  if (name === 'word/document.xml') return limits.documentPart ?? Infinity;
  if (SHEET_PART.test(name)) return limits.sheetPart ?? Infinity;
  return Infinity;
}

export type OfficeZipErrorCode = 'tooLarge' | 'tooManyEntries' | 'uncompressedTooLarge' | 'partTooLarge' | 'missingPart' | 'invalidZip';

export class OfficeZipError extends Error {
  constructor(public readonly code: OfficeZipErrorCode) {
    super(code);
    this.name = 'OfficeZipError';
  }
}

/** Chu ky "PK\x03\x04" o dau tep -> la ZIP (OOXML). .xls nhi phan cu (CFB) khong phai ZIP. */
export function isZipData(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
}

/**
 * Giai nen CHI cac tep `keep` chon, sau khi kiem tra gioi han tren toan bo muc luc. `requiredPart`
 * (vd 'word/document.xml') phai co mat - tep doi duoi/hong bao loi som thay vi de thu vien nem loi
 * kho hieu. Moi loi -> OfficeZipError (modal hien giao dien loi san co).
 */
export function unzipOfficeEntries(
  data: Uint8Array,
  keep: (name: string) => boolean,
  requiredPart?: string,
  limits: OfficeZipLimits = OFFICE_ZIP_LIMITS,
): Record<string, Uint8Array> {
  if (data.byteLength > limits.fileBytes) throw new OfficeZipError('tooLarge');
  let count = 0;
  let total = 0;
  let hasRequired = !requiredPart;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter: (entry) => {
        count += 1;
        total += entry.originalSize;
        if (count > limits.entries) throw new OfficeZipError('tooManyEntries');
        if (total > limits.totalUncompressed) throw new OfficeZipError('uncompressedTooLarge');
        if (entry.originalSize > partLimit(entry.name, limits)) throw new OfficeZipError('partTooLarge');
        if (entry.name === requiredPart) hasRequired = true;
        return keep(entry.name);
      },
    });
  } catch (err) {
    if (err instanceof OfficeZipError) throw err;
    throw new OfficeZipError('invalidZip');
  }
  if (!hasRequired) throw new OfficeZipError('missingPart');
  return files;
}

/** Chi kiem tra (khong giai nen tep nao) - dung truoc khi giao du lieu cho docx-preview/SheetJS. */
export function assertSafeOfficeZip(data: Uint8Array, requiredPart?: string, limits: OfficeZipLimits = OFFICE_ZIP_LIMITS): void {
  unzipOfficeEntries(data, () => false, requiredPart, limits);
}
