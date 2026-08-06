import { BadRequestException } from '@nestjs/common';

/**
 * Allowlist MIME type cho anh cham cong (chup tu camera trinh duyet) - sao chep-va-thu-gon tu
 * apps/document-service/src/files/allowed-mime-types.ts (file mau tham chieu), chi giu 2 dinh
 * dang anh ma trinh duyet xuat ra tu <canvas>.toBlob() (Technical_Spec.md muc 17).
 */
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

export function isAllowedPhotoMimeType(mimeType: string): boolean {
  return (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** `fileFilter` cho `FileInterceptor` (multer) - tu choi file ngay tai tang multer. */
export function photoMimeTypeFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!isAllowedPhotoMimeType(file.mimetype)) {
    callback(
      new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: `Loai anh khong duoc ho tro: ${file.mimetype}`,
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

const MAGIC_BYTE_CHECKS: Record<AllowedPhotoMimeType, (buffer: Buffer) => boolean> = {
  'image/png': (buffer) => startsWithBytes(buffer, PNG_SIGNATURE),
  'image/jpeg': (buffer) => startsWithBytes(buffer, JPEG_SIGNATURE),
};

/** Doi chieu vai byte dau cua NOI DUNG THAT SU voi mimeType duoc khai bao - tranh gia mao Content-Type. */
export function isBufferContentConsistentWithMimeType(buffer: Buffer, mimeType: string): boolean {
  const check = MAGIC_BYTE_CHECKS[mimeType as AllowedPhotoMimeType];
  if (!check) return false;
  return check(buffer);
}

export function verifyPhotoContentMatchesMimeType(file: Express.Multer.File): void {
  if (!isBufferContentConsistentWithMimeType(file.buffer, file.mimetype)) {
    throw new BadRequestException({
      error: 'VALIDATION_ERROR',
      message: `Noi dung anh khong khop voi loai duoc khai bao (${file.mimetype})`,
    });
  }
}
