import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';

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
export type CoordinateField = 'latitude' | 'longitude';

// 20/08/2026: rollout i18n - `field` truoc day la CHUOI HIEN THI tieng Viet ('Vĩ độ'/'Kinh độ')
// truyen thang tu attendance.controller.ts vao message loi, khong the dung lam errorParams.field
// (can 1 key on dinh, khong phai van ban tieng Viet). Doi thanh key on dinh, dich nguoc lai ve
// tieng Viet CHI o day (giu message hien tai KHONG doi mot chu nao) de vua giu duoc hanh vi cu,
// vua co field on dinh cho web dich sang Anh/Nhat qua errorCode/errorParams.
const FIELD_LABEL_VI: Record<CoordinateField, string> = {
  latitude: 'Vĩ độ',
  longitude: 'Kinh độ',
};

export function parseOptionalCoordinate(raw: string | undefined, field: CoordinateField, min: number, max: number): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  if (Number.isNaN(value) || value < min || value > max) {
    throw new BadRequestException({
      message: `${FIELD_LABEL_VI[field]} không hợp lệ`,
      errorCode: ERROR_CODES.INVALID_COORDINATE,
      errorParams: { field },
    });
  }
  return value;
}
