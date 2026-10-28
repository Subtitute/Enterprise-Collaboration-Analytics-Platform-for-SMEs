import type { FileItem } from '@/types';

// 27/10/2026: tach phan loai dinh dang xem truoc ra khoi FilePreviewModal (truoc day nam trong
// useMemo cua modal) de test duoc va de them 3 loai Office (docx/xlsx/pptx) xem ngay trong trinh
// duyet - khong co dich vu chuyen doi phia server, khong them container moi.
export type PreviewType = 'pdf' | 'image' | 'text' | 'csv' | 'docx' | 'xlsx' | 'pptx' | 'unsupported';
export type OfficePreviewType = Extract<PreviewType, 'docx' | 'xlsx' | 'pptx'>;

// Nguong dung luong toi da ho tro xem truc tiep (20MB) - giu nguyen gia tri cu cho pdf/anh/van ban.
export const MAX_PREVIEW_SIZE_BYTES = 20 * 1024 * 1024;
// 27/10/2026: Office phai tai ca tep ve bo nho trinh duyet roi giai nen/phan tich tren luong chinh
// -> dat nguong thap hon (15MB) de khong treo tab tren may cau hinh yeu.
export const MAX_OFFICE_PREVIEW_SIZE_BYTES = 15 * 1024 * 1024;

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** Props chung cua 3 trinh xem Office (nap lazy tu FilePreviewModal). */
export interface OfficePreviewProps {
  /** Noi dung tep da tai ve (ArrayBuffer cua URL presigned inline). */
  data: Uint8Array;
  /** Bao loi phan tich/hien thi -> modal chuyen sang giao dien loi san co. */
  onError: () => void;
  onDownload: () => void;
}

/**
 * Phan loai dinh dang dua tren mime_type thuc te hoac fallback extension. Kiem tra duoi .csv TRUOC
 * mime Office vi Windows hay gan "application/vnd.ms-excel" cho tep .csv (CSV van di nhanh csv cu).
 * .doc/.ppt (nhi phan cu) khong ho tro -> 'unsupported'; .xls van doc duoc bang SheetJS.
 */
export function detectPreviewType(file: Pick<FileItem, 'name' | 'mimeType'> | null): PreviewType {
  if (!file) return 'unsupported';
  const mime = (file.mimeType || '').toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (mime === 'text/csv' || ext === 'csv') return 'csv';
  if (ext === 'docx' || mime === DOCX_MIME) return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || mime === XLSX_MIME || mime === XLS_MIME) return 'xlsx';
  if (ext === 'pptx' || mime === PPTX_MIME) return 'pptx';
  if (mime.startsWith('text/') || ext === 'txt') return 'text';

  return 'unsupported';
}

export function isOfficePreview(type: PreviewType): type is OfficePreviewType {
  return type === 'docx' || type === 'xlsx' || type === 'pptx';
}

export function maxPreviewBytes(type: PreviewType): number {
  return isOfficePreview(type) ? MAX_OFFICE_PREVIEW_SIZE_BYTES : MAX_PREVIEW_SIZE_BYTES;
}
