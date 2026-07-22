import { BadRequestException } from '@nestjs/common';

/**
 * Allowlist MIME type duoc phep upload - Technical_Spec.md muc 9 ("File upload gioi han
 * kich thuoc va loai MIME hop le o Document Service").
 *
 * QUAN TRONG: mang nay PHAI khop byte-for-byte voi allowlist tuong ung o Frontend
 * (apps/web) - ca hai duoc dong bo thu cong theo dung danh sach da thong nhat trong
 * dot code review 21/07/2026. Sua o day thi phai sua ca ben Frontend.
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/gif',
  'text/csv',
  'text/plain',
  'application/zip',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Ham thuan (pure) - khong phu thuoc MinIO/DB, de unit test rieng. */
export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * `fileFilter` cho `FileInterceptor` (multer) - tu choi file ngay tai tang multer, TRUOC KHI
 * buffer noi dung vao memory hay goi MinioService.putObject (Technical_Spec.md muc 9 yeu cau
 * ca kich thuoc LAN loai MIME deu phai duoc kiem tra server-side, khong chi FE).
 *
 * Nem BadRequestException voi body dung dinh dang loi chuan cua he thong (Technical_Spec.md
 * muc 7: `{statusCode, error: 'VALIDATION_ERROR', message, timestamp}`) - vi day da la mot
 * HttpException, @nestjs/platform-express se khong boc lai (xem multer.utils.ts#transformException),
 * AllExceptionsFilter se doc truc tiep truong `error`/`message` tu body nay.
 */
export function mimeTypeFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!isAllowedMimeType(file.mimetype)) {
    callback(
      new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: `Loai file khong duoc ho tro: ${file.mimetype}`,
      }),
      false,
    );
    return;
  }
  callback(null, true);
}

// 22/07/2026: Fix 4 (code review) - kiem tra magic-byte (doi chieu NOI DUNG THAT SU cua file voi
// mimetype duoc client khai bao). Bo sung vi `mimeTypeFileFilter` o tren CHI kiem tra
// `file.mimetype` - mot truong client TU KHAI BAO trong request, HOAN TOAN co the gia mao (vd
// doi ten + khai bao Content-Type gia cho 1 file .html/.exe de vuot allowlist). Rui ro nay tang
// them tu khi co duong tai "Xem" (`?disposition=inline` - xem content-disposition.util.ts) phuc
// vu noi dung THANG trong trinh duyet bang chinh Content-Type gia mao do.
//
// Da can nhac dung goi npm `file-type` (theo dung de xuat cua bien ban review) truoc khi tu viet
// tay - KHONG dung, vi ca 2 lua chon deu co van de ro rang (da kiem chung truc tiep bang
// `npm install`/`npm audit` trong repo nay, khong chi suy doan):
//   - Cac phien ban `file-type` con tuong thich CommonJS (<= 16.5.4 - tu 17.0.0 tro di goi nay
//     chuyen han sang ESM-only, `"type": "module"`) deu dinh lo hong da duoc cong bo
//     GHSA-5v7r-6r5c-r473 (vong lap VO HAN khi parser ASF gap input hong, co sub-header kich
//     thuoc bang 0) - `npm audit` xac nhan lo hong nay khi thu cai `file-type@16.5.4` vao service
//     nay. Day la 1 lo hong DoS ngay trong duong xu ly noi dung KHONG DANG TIN (file nguoi dung
//     tai len) - khong the chap nhan cho chinh 1 ban SUA LOI BAO MAT.
//   - Phien ban da vi da (17+, khong con lo hong tren) chi con ton tai dang ESM thuan. Du an nay
//     bien dich CommonJS (`tsconfig.json`: `"module": "commonjs"`, chay qua ts-jest luc test va
//     Nest CLI/ts-loader luc build) - `import()` dong trong ngu canh nay bi TypeScript ha cap
//     thanh `require()`, se nem `ERR_REQUIRE_ESM` khi chay thuc te - khong the goi truc tiep goi
//     ESM-only nhu vay ma khong tai cau truc ca build pipeline (vuot qua muc can thiet cho 1 ban
//     sua loi cuc bo, pham vi task nay CHI gioi han trong apps/document-service/src).
// => Tu viet tay ham kiem tra magic-byte cho DUNG cac dinh dang nhi phan CO CHU KY DAC TRUNG DANG
// TIN CAY trong allowlist hien tai (khong can ho tro hang tram dinh dang nhu `file-type` - service
// nay chi co 13 loai MIME co dinh). Ngan hon, khong mang theo lo hong DoS noi tren, va de unit test
// doc lap (khong phu thuoc goi ngoai).
function startsWithBytes(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]; // \x89PNG
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38]; // "GIF8"

// Dinh dang ZIP - dung chung cho .zip THUAN va cac dinh dang OOXML .docx/.xlsx/.pptx (ca 3 thuc
// chat la 1 goi ZIP chua XML ben trong) - co the bat dau bang 1 trong 3 chu ky sau tuy tinh trang
// goi: PK\x03\x04 (thong thuong, co it nhat 1 entry), PK\x05\x06 (goi ZIP RONG), PK\x07\x08 (goi
// ZIP da phan doan/spanned - hiem gap qua upload web nhung van la ZIP hop le). LUU Y GIOI HAN:
// chu ky nay CHI xac nhan "day la 1 goi ZIP hop le", KHONG the phan biet .docx/.xlsx/.pptx/.zip
// VOI NHAU (ca 4 loai deu bat dau giong het nhau) - viec do doi hoi doc sau vao cau truc XML ben
// trong goi ZIP (vuot qua muc "magic-byte don gian" cua ban sua nay).
const ZIP_SIGNATURES: number[][] = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
];

// Dinh dang OLE Compound File Binary - chu ky chung cua CA BA dinh dang Office nhi phan cu
// (.doc/.xls/.ppt, truoc chuan OOXML). LUU Y GIOI HAN: chu ky nay CHI xac nhan "day la 1 goi OLE
// CFB hop le" (loai duoc truong hop gia mao thanh HTML/script/executable...), KHONG the phan
// biet .doc/.xls/.ppt VOI NHAU chi tu 8 byte dau - viec do doi hoi doc sau vao cay thu muc noi bo
// cua OLE CFB (cung vuot qua muc "magic-byte don gian" cua ban sua nay, giong truong hop ZIP o tren).
const OLE_CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

type MagicByteCheck = (buffer: Buffer) => boolean;

const zipCheck: MagicByteCheck = (buffer) => ZIP_SIGNATURES.some((sig) => startsWithBytes(buffer, sig));
const oleCfbCheck: MagicByteCheck = (buffer) => startsWithBytes(buffer, OLE_CFB_SIGNATURE);

/**
 * Map mimetype -> ham kiem tra chu ky nhi phan tuong ung. Loai KHONG co mat trong map nay
 * (`text/csv`, `text/plain`) nghia la KHONG co magic-byte dang tin cay de kiem - xem ghi chu o
 * `isBufferContentConsistentWithMimeType`.
 */
const MAGIC_BYTE_CHECKS: Partial<Record<AllowedMimeType, MagicByteCheck>> = {
  'application/pdf': (buffer) => startsWithBytes(buffer, PDF_SIGNATURE),
  'image/png': (buffer) => startsWithBytes(buffer, PNG_SIGNATURE),
  'image/jpeg': (buffer) => startsWithBytes(buffer, JPEG_SIGNATURE),
  'image/gif': (buffer) => startsWithBytes(buffer, GIF_SIGNATURE),
  'application/zip': zipCheck,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': zipCheck,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': zipCheck,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': zipCheck,
  'application/msword': oleCfbCheck,
  'application/vnd.ms-excel': oleCfbCheck,
  'application/vnd.ms-powerpoint': oleCfbCheck,
  // 'text/csv' va 'text/plain': CO Y khong khai bao check o day - van ban thuan co the bat dau
  // bang BAT KY chuoi byte nao nen khong ton tai "chu ky" dac trung dang tin cay. Day la GIOI HAN
  // DA BIET va CHAP NHAN DUOC (ghi lai ro rang thay vi am tham bo qua) - 2 loai nay tiep tuc CHI
  // duoc bao ve boi `mimeTypeFileFilter` (kiem tra Content-Type client khai bao) nhu truoc ban
  // sua nay.
};

/**
 * Doi chieu vai byte dau cua NOI DUNG THAT SU (`buffer`) voi `mimeType` duoc khai bao. Tra ve
 * `true` khi khop, HOAC khi `mimeType` khong co magic-byte dang tin cay de kiem (xem
 * `MAGIC_BYTE_CHECKS` o tren).
 */
export function isBufferContentConsistentWithMimeType(buffer: Buffer, mimeType: string): boolean {
  const check = MAGIC_BYTE_CHECKS[mimeType as AllowedMimeType];
  if (!check) return true;
  return check(buffer);
}

/**
 * Wrapper nem `BadRequestException` (cung dinh dang loi chuan `VALIDATION_ERROR` nhu
 * `mimeTypeFileFilter`) - goi tu `FilesService.upload()`/`uploadNewVersion()` SAU KHI buffer file
 * da san sang (`file.buffer`), TRUOC khi goi `MinioService.putObject`.
 */
export function verifyFileContentMatchesMimeType(file: Express.Multer.File): void {
  if (!isBufferContentConsistentWithMimeType(file.buffer, file.mimetype)) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: `Noi dung file khong khop voi loai duoc khai bao (${file.mimetype})`,
    });
  }
}
