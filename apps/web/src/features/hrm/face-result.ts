import type { TFunction } from 'i18next';

/**
 * 28/10/2026: nguong khop chi de HIEN THI khi server khong gui kem (bang lich su cham cong) - mirror
 * MATCH_THRESHOLD (apps/ml-service/app/face.py) va FACE_MATCH_THRESHOLD (hrm-service). Viec quyet dinh
 * "khop/khong khop" van do hrm-service lam.
 */
export const DEFAULT_FACE_MATCH_THRESHOLD = 0.35;

/** Ket qua doi chieu truoc khi cham cong - de bao ngay ly do khi khong co diem. */
export type FaceCheckStatus = 'scored' | 'notEnrolled' | 'noFace' | 'unavailable';

export interface FaceCheck {
  status: FaceCheckStatus;
  /** Token ml-service ky cho dung anh nay - hrm-service chi tin diem qua token. */
  token?: string;
  threshold?: number;
}

/** Diem cosine [-1, 1] -> phan tram 0-100 (diem am coi la 0%). */
export function toFacePercent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

/**
 * Mo ta 1 dong cho toast sau khi cham cong / thu nhan dien. `matched`/`score` lay tu ket qua SERVER
 * (ban ghi cham cong hoac /ml/face/verify), `face` cho biet vi sao khong co diem.
 */
export function describeFaceResult(
  t: TFunction,
  face: FaceCheck,
  matched: boolean | null | undefined,
  score: number | null | undefined,
): string {
  const threshold = toFacePercent(face.threshold ?? DEFAULT_FACE_MATCH_THRESHOLD);
  if (matched != null && score != null) {
    const key = matched ? 'hrm:attendancePage.faceResult.matched' : 'hrm:attendancePage.faceResult.notMatched';
    return t(key, { percent: toFacePercent(score), threshold });
  }
  const reason: FaceCheckStatus = face.status === 'scored' ? 'unavailable' : face.status;
  return t(`hrm:attendancePage.faceResult.${reason}`);
}
