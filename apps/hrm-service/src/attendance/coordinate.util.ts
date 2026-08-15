import { BadRequestException } from '@nestjs/common';

/**
 * `latitude`/`longitude` cua check-in/out den kem `@Body('...')` doc THO tu multipart/form-data
 * (mot truong text ben canh file anh), KHONG phai qua 1 DTO dang class - ValidationPipe toan cuc
 * chi validate `@Body()` khi tham so nhan DTO class, nen gia tri nay khong di qua buoc validate
 * nao ca (giai thich day du, cung tinh huong voi `folderId` cua POST /files/upload, xem
 * apps/document-service/src/files/files.controller.ts). Tu validate tuong minh o day.
 *
 * Rong/undefined = khong gui toa do (thieu quyen vi tri/nguoi dung tu choi) - HOP LE, tra ve
 * undefined, KHONG nem loi (cham cong van tiep tuc binh thuong, xem attendance.service.ts).
 * Chi nem loi khi CO gia tri nhung khong phai so hop le trong khoang toa do GPS thuc.
 */
export function parseOptionalCoordinate(raw: string | undefined, label: string, min: number, max: number): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException(`${label} không hợp lệ`);
  }
  return value;
}
