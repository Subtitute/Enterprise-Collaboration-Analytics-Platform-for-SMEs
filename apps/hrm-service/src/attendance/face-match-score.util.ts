import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '@app/common-dto';

// 24/10/2026 (fix loi thuc te phat hien khi kiem thu song qua Gateway): cosine similarity cua 2
// vector DA L2-normalize ve ly thuyet nam trong [-1, 1], nhung php32 (ArcFace tra ve float32,
// xem app/face.py ben ml-service) THUONG cho ra gia tri lech nho ngoai khoang nay do sai so
// lam tron - vd tu so sanh 1 vector voi chinh no cho ra 1.0000001192092896, KHONG PHAI 1.0 chinh
// xac. Truoc fix nay, kiem tra `value > 1` tu choi NGAY ca truong hop tu-khop-hoan-hao (truong hop
// PHO BIEN NHAT trong thuc te - cung khuon mat, cung anh sang) bang loi 400, VO HIEU HOA hoan toan
// check-in that - di NGUOC LAI chinh thiet ke "canh bao mem, khong bao gio chan cham cong" cua ca
// tinh nang nay. Dung epsilon dong deu voi sai so float32 thuc te (~1e-6), LON HON han muc sai so
// co the xay ra (an toan) nhung van du nho de bat duoc du lieu THAT SU vo ly (vd gui nham 50).
const FLOAT_ROUNDING_EPSILON = 1e-3;

/**
 * `faceMatchScore` cua check-in/out den kem `@Body('faceMatchScore')` doc THO tu
 * multipart/form-data (mirror CHINH XAC `coordinate.util.ts` - cung tinh huong "khong di qua
 * ValidationPipe vi tham so khong phai DTO class", xem giai thich day du o do).
 *
 * Gia tri la cosine similarity ([-1, 1]) do `ml-service` tra ve (POST /api/v1/ml/face/verify) -
 * frontend chi RO-LAI nguyen ven, KHONG tu tinh toan lai. Rong/undefined = chua dang ky khuon
 * mat hoac khong phat hien duoc mat trong anh (hop le, tra ve undefined, KHONG nem loi - cham
 * cong van tiep tuc binh thuong, xem attendance.service.ts). Gia tri lech nho ngoai [-1, 1] do
 * sai so lam tron duoc KEP (clamp) lai ve dung bien, khong bi tu choi - xem FLOAT_ROUNDING_EPSILON.
 */
export function parseOptionalFaceMatchScore(raw: string | undefined): number | undefined {
  // 24/10/2026 (fix phat hien qua QA doc lap): `.trim()` TRUOC khi kiem tra rong - JS coi chuoi
  // chi co khoang trang (vd "   ") la "" khi trim, nhung `Number("   ")` tra ve 0 (KHONG PHAI
  // NaN, 1 quy uoc gay nham lan cua JS), khien gia tri nay lot qua kiem tra va bi hieu nham thanh
  // "diem tuong dong = 0" (tuc "KHONG khop", mot KET LUAN RO RANG) thay vi dung nghia la "khong
  // co du lieu" (undefined) - sai lech ngu nghia du khong anh huong hanh vi chan/khong chan.
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') return undefined;
  const value = Number(trimmed);
  if (Number.isNaN(value) || value < -1 - FLOAT_ROUNDING_EPSILON || value > 1 + FLOAT_ROUNDING_EPSILON) {
    throw new BadRequestException({
      message: 'Điểm tương đồng khuôn mặt không hợp lệ',
      errorCode: ERROR_CODES.INVALID_FACE_MATCH_SCORE,
    });
  }
  return Math.min(1, Math.max(-1, value));
}
