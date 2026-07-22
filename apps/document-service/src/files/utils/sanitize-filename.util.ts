// 22/07/2026: file moi - Fix 1 (code review). `file.originalname` tu request multipart la du
// lieu HOAN TOAN do client tu khai bao/kiem soat, va truoc ban sua nay no duoc noi TRUC TIEP vao
// object key MinIO qua `buildObjectKey` (quy uoc `${organizationId}/${fileId}/v${versionNumber}/
// ${originalFileName}` - xem object-key.util.ts) va vao header `Content-Disposition` qua
// `buildContentDisposition` (content-disposition.util.ts) luc tai file ve sau nay, ma KHONG qua
// buoc lam sach nao. Rui ro cu the:
//   - Ten file chua `/` hoac `\` (vd "../../../etc/passwd") co the lam object key MinIO bi
//     "thoat" khoi tien to `${organizationId}/${fileId}/v${versionNumber}/` du dinh - MinIO coi
//     `/` la ky tu phan cach cap "thu muc" ao trong object key.
//   - Ky tu dieu khien (vd CR/LF, ma < 0x20) co the bi loi dung de chen header gia vao response
//     tai `Content-Disposition` (header/response splitting) o cac tang proxy khong chuan hoa.
//   - Ten file dai bat thuong co the vuot gioi han thuc te cua object key MinIO/cot DB.
//
// Ham `sanitizeFileName` lam sach ten file TRUOC KHI no di vao ca 2 duong tren - ket qua sach
// duoc dung CA cho object key LAN luu vao `FileMeta.fileName`/`FileVersion.` (khong chi lam sach
// rieng cho object key roi van luu ten goc vao DB - `buildContentDisposition` doc truc tiep tu
// `FileMeta.fileName` luc tai file ve, khong phai tu object key, nen phai sach ca 2 duong).
//
// Ham thuan (pure function), khong phu thuoc DB/MinIO - de unit test doc lap (cung quy uoc voi
// version-retention.util.ts).

/** Ten mac dinh dung khi ten file sau khi lam sach khong con "phan ten" nao (rong hoan toan). */
export const FALLBACK_FILE_NAME = 'tep-khong-ten';

/**
 * Do dai toi da (so ky tu) cua ten file SAU KHI lam sach. Cung duoc FilesService dung de tu choi
 * SOM (truoc khi goi MinioService.putObject) ten file goc qua dai, thay vi de that bai phat sinh
 * sau khi da buffer/tai xong toan bo noi dung nhi phan len MinIO.
 */
export const MAX_FILE_NAME_LENGTH = 200;

/** Regex nhan dien phan duoi mo rong ".xxx" (1-20 ky tu, khong phai dau `.`/`/`/`\`) o cuoi ten file. */
const EXTENSION_PATTERN = /(\.[^./\\]{1,20})$/;

function splitExtension(fileName: string): { base: string; ext: string } {
  const match = fileName.match(EXTENSION_PATTERN);
  if (!match) return { base: fileName, ext: '' };
  const ext = match[1];
  return { base: fileName.slice(0, fileName.length - ext.length), ext };
}

/**
 * Lam sach 1 ten file do client cung cap (xem ly do o dau file). Cac buoc, theo thu tu:
 *   1. Thay `/` va `\` (phan cach duong dan) bang `_`.
 *   2. Gom cac chuoi ".." con lai (sau buoc 1) thanh `_` - phong ten file kieu "..".
 *   3. Bo ky tu dieu khien (ma < 0x20 va 0x7F) - ngan chen CRLF/header vao response.
 *   4. Neu "phan ten" (khong tinh duoi mo rong) rong sau cac buoc tren, thay bang
 *      `FALLBACK_FILE_NAME`, VAN GIU duoi mo rong neu co (vd ".pdf" -> "tep-khong-ten.pdf").
 *   5. Cat bot cho vua `MAX_FILE_NAME_LENGTH` ky tu, co gang giu nguyen duoi mo rong.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = (name ?? '')
    .replace(/[/\\]+/g, '_')
    .replace(/\.\.+/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  const { base, ext } = splitExtension(cleaned);
  const sanitized = (base.length > 0 ? base : FALLBACK_FILE_NAME) + ext;

  if (sanitized.length <= MAX_FILE_NAME_LENGTH) return sanitized;

  const truncated = splitExtension(sanitized);
  const maxBaseLength = Math.max(0, MAX_FILE_NAME_LENGTH - truncated.ext.length);
  return truncated.base.slice(0, maxBaseLength) + truncated.ext;
}
