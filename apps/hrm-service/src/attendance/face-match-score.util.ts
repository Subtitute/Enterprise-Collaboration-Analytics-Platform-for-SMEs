import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { DEV_FALLBACK_INTERNAL_SHARED_SECRET } from '@app/common-dto';

// 24/10/2026 (fix loi thuc te phat hien khi kiem thu song qua Gateway): cosine similarity cua 2
// vector DA L2-normalize ve ly thuyet nam trong [-1, 1], nhung float32 (ArcFace) thuong lech nho ngoai
// khoang nay do sai so lam tron - vd tu so sanh 1 vector voi chinh no cho ra 1.0000001192092896. Gia
// tri lech nho duoc KEP ve dung bien; lech qua epsilon la du lieu vo ly va bi bo qua.
const FLOAT_ROUNDING_EPSILON = 1e-3;

// 28/10/2026: phai khop tung byte voi apps/ml-service/app/face_token.py.
const TOKEN_VERSION = 1;
const KEY_CONTEXT = 'ecap-face-match-score-v1';

export interface FaceMatchTokenContext {
  organizationId: string;
  userId: string;
  /** Noi dung anh cham cong hrm-service vua nhan - phai trung anh ma ml-service da doi chieu. */
  photo: Buffer;
}

export interface FaceMatchTokenResult {
  score?: number;
  /** Ly do bo qua token (de ghi log) - undefined khi khong gui token hoac token hop le. */
  rejected?: string;
}

/**
 * 28/10/2026: diem tuong dong khuon mat CHI duoc nhan qua token do ml-service ky
 * (POST /api/v1/ml/face/verify). Truoc day nhan `faceMatchScore` la so tho tu trinh duyet - nhan vien
 * gui 0.99 la luon hien "Khop khuon mat". Token gan chat to chuc + nguoi dung + diem + SHA-256 cua
 * chinh anh da doi chieu + han dung, ky HMAC-SHA256 bang khoa suy ra tu INTERNAL_SHARED_SECRET.
 *
 * Token sai/het han/khac nguoi/khac anh -> BO QUA diem (khong nem loi): cham cong van thanh cong nhu
 * truong hop chua dang ky khuon mat, giu dung thiet ke "canh bao mem, khong bao gio chan cham cong" -
 * nhung khong ai tu tao duoc ket qua "Khop". Production thieu secret da bi InternalAuthGuard chan tu
 * luc khoi dong, nen fallback dev o day khong bao gio chay o production.
 */
export function verifyFaceMatchToken(
  raw: string | undefined,
  expected: FaceMatchTokenContext,
  secret: string = process.env.INTERNAL_SHARED_SECRET || DEV_FALLBACK_INTERNAL_SHARED_SECRET,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): FaceMatchTokenResult {
  const token = raw?.trim();
  if (!token) return {};
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra !== undefined) return { rejected: 'malformed' };

  const key = createHmac('sha256', secret).update(KEY_CONTEXT).digest();
  const expectedSignature = createHmac('sha256', key).update(body).digest();
  const actualSignature = Buffer.from(signature, 'base64url');
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) {
    return { rejected: 'bad-signature' };
  }

  let payload: { v?: unknown; org?: unknown; sub?: unknown; score?: unknown; ph?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { rejected: 'malformed' };
  }
  if (payload.v !== TOKEN_VERSION) return { rejected: 'version' };
  if (payload.org !== expected.organizationId || payload.sub !== expected.userId) return { rejected: 'other-user' };
  if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) return { rejected: 'expired' };
  if (payload.ph !== createHash('sha256').update(expected.photo).digest('hex')) return { rejected: 'other-photo' };

  const score = payload.score;
  if (typeof score !== 'number' || Number.isNaN(score) || score < -1 - FLOAT_ROUNDING_EPSILON || score > 1 + FLOAT_ROUNDING_EPSILON) {
    return { rejected: 'score-out-of-range' };
  }
  return { score: Math.min(1, Math.max(-1, score)) };
}
