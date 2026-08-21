import type { Response } from 'express';
import { ErrorResponseDto } from '@app/common-dto';

/**
 * Ghi loi theo dinh dang chuan ErrorResponseDto (Technical_Spec.md muc 7) tu middleware
 * Express thuan (chay TRUOC pipeline cua Nest, nen khong di qua duoc AllExceptionsFilter).
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: string,
  message: string,
  path?: string,
  // 20/08/2026: tham so CONG THEM cho rollout i18n (xem
  // packages/common-dto/src/constants/error-codes.constant.ts) - de trong van dung, chi giup web
  // dich duoc thong bao nay qua i18next thay vi luon hien tieng Viet.
  errorCode?: string,
): void {
  const body: ErrorResponseDto = {
    statusCode,
    error,
    message,
    timestamp: new Date().toISOString(),
    path,
    ...(errorCode !== undefined && { errorCode }),
  };
  res.status(statusCode).json(body);
}
