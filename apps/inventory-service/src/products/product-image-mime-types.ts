import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';

/**
 * Allowlist MIME type cho anh san pham - THU GON chi con 3 dinh dang anh (khac allowlist 13 loai
 * cua Document Service, vi day CHI la anh san pham) - sao chep-va-thu-gon tu
 * apps/document-service/src/files/allowed-mime-types.ts (file mau tham chieu), mirror cach
 * apps/hrm-service da lam cho anh cham cong (photo-proof).
 */
export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedProductImageMimeType = (typeof ALLOWED_PRODUCT_IMAGE_MIME_TYPES)[number];

export function isAllowedProductImageMimeType(mimeType: string): boolean {
  return (ALLOWED_PRODUCT_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function productImageMimeTypeFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!isAllowedProductImageMimeType(file.mimetype)) {
    callback(
      new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: `Loai anh khong duoc ho tro: ${file.mimetype} (chi chap nhan JPEG/PNG/WebP)`,
        errorCode: ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        errorParams: { mimeType: file.mimetype },
      }),
      false,
    );
    return;
  }
  callback(null, true);
}

function startsWithBytes(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]; // \x89PNG
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
// WebP = container RIFF ("RIFF" tai byte 0-3) voi FourCC "WEBP" tai byte 8-11 - kiem tra ca 2 vi
// RIFF rieng le khong du dac trung (la dinh dang container dung chung, vd .wav/.avi cung bat dau
// bang RIFF).
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_FOURCC = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

function isWebpSignature(buffer: Buffer): boolean {
  return startsWithBytes(buffer, RIFF_SIGNATURE) && buffer.length >= 12 && startsWithBytes(buffer.subarray(8, 12), WEBP_FOURCC);
}

const MAGIC_BYTE_CHECKS: Record<AllowedProductImageMimeType, (buffer: Buffer) => boolean> = {
  'image/png': (buffer) => startsWithBytes(buffer, PNG_SIGNATURE),
  'image/jpeg': (buffer) => startsWithBytes(buffer, JPEG_SIGNATURE),
  'image/webp': isWebpSignature,
};

export function isBufferContentConsistentWithMimeType(buffer: Buffer, mimeType: string): boolean {
  const check = MAGIC_BYTE_CHECKS[mimeType as AllowedProductImageMimeType];
  if (!check) return true;
  return check(buffer);
}

/** Goi tu ProductsService.setImage() SAU KHI buffer file da san sang, TRUOC khi goi MinioService.putObject. */
export function verifyProductImageContentMatchesMimeType(file: Express.Multer.File): void {
  if (!isBufferContentConsistentWithMimeType(file.buffer, file.mimetype)) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: `Noi dung anh khong khop voi loai duoc khai bao (${file.mimetype})`,
    });
  }
}
