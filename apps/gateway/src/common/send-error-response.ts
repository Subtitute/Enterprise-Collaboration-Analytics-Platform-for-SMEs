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
): void {
  const body: ErrorResponseDto = {
    statusCode,
    error,
    message,
    timestamp: new Date().toISOString(),
    path,
  };
  res.status(statusCode).json(body);
}
