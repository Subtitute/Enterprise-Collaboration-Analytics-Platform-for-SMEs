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
