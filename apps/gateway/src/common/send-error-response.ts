import type { Request, Response } from 'express';
import { CORRELATION_ID_HEADER, ErrorResponseDto } from '@app/common-dto';

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
  // 22/08/2026: tham so CONG THEM (xem constants/correlation-id.constant.ts) - truyen req.headers
  // truc tiep (thay vi doc san 1 string) de goi noi don gian hon: sendErrorResponse(..., req).
  requestForCorrelation?: Pick<Request, 'headers'>,
): void {
  const correlationIdHeader = requestForCorrelation?.headers?.[CORRELATION_ID_HEADER];
  const correlationId = Array.isArray(correlationIdHeader) ? correlationIdHeader[0] : correlationIdHeader;
  const body: ErrorResponseDto = {
    statusCode,
    error,
    message,
    timestamp: new Date().toISOString(),
    path,
    ...(errorCode !== undefined && { errorCode }),
    ...(correlationId !== undefined && { correlationId }),
  };
  res.status(statusCode).json(body);
}
