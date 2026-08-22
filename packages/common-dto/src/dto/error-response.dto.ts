/** Dinh dang loi chuan cho toan bo API - Technical_Spec.md muc 7. */
export interface ErrorResponseDto {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path?: string;
  // 20/08/2026: bo sung CONG THEM (additive, optional) cho rollout i18n - xem
  // constants/error-codes.constant.ts. `errorCode`/`errorParams` ung voi `message: string` (loi
  // nghiep vu don), `details` ung voi `message: string[]` (loi validate DTO, luon la mang dung
  // 1:1 vi tri voi message). Khong co field nao thi giu nguyen hanh vi cu 100% - mobile
  // (ecap-mobile) khong doc cac field nay, khong bi anh huong.
  errorCode?: string;
  errorParams?: Record<string, string | number>;
  details?: ErrorDetail[];
  // 22/08/2026: bo sung CONG THEM (additive, optional) - xem constants/correlation-id.constant.ts.
  // Cho phep nguoi dung/ho tro ky thuat tra cuu dung request bi loi trong log server ma khong can
  // doi chieu timestamp thu cong. Khong co field nay thi giu nguyen hanh vi cu 100%.
  correlationId?: string;
}

/** 1 loi cu the trong `ErrorResponseDto.details` (dung khi `message` la mang). */
export interface ErrorDetail {
  code: string;
  params?: Record<string, string | number>;
}
