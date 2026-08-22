import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { CORRELATION_ID_HEADER, ErrorResponseDto } from '@app/common-dto';

/** Chuan hoa moi loi tra ve theo dinh dang Technical_Spec.md muc 7. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<any>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Da xay ra loi khong xac dinh, vui long thu lai sau';
    let error = 'INTERNAL_SERVER_ERROR';
    // 20/08/2026: 3 field CONG THEM cho rollout i18n (xem
    // packages/common-dto/src/constants/error-codes.constant.ts) - chi duoc dien khi than
    // exception la 1 object co cac field nay (vd `new NotFoundException({message, errorCode})`),
    // undefined nghia la diem throw do chua duoc gan ma, response giu nguyen hanh vi cu 100%.
    let errorCode: string | undefined;
    let errorParams: Record<string, string | number> | undefined;
    let details: ErrorResponseDto['details'];

    if (typeof body === 'string') {
      message = body;
      error = exception!.constructor.name;
    } else if (body && typeof body === 'object') {
      const anyBody = body as Record<string, unknown>;
      message = (anyBody.message as string | string[]) ?? message;
      // 20/08/2026: neu than exception la object nhung KHONG tu khai bao `error` (vd cac diem
      // throw nghiep vu moi gan ma qua {message, errorCode}), roi ve ten class exception thuc su
      // (vd 'NotFoundException') thay vi cum tieng Anh NestJS tu dien truoc day (vd 'Not Found') -
      // vo tinh thong nhat quy uoc voi cac ma Gateway dang dung san (sendErrorResponse.ts:
      // 'UnauthorizedException', 'BadGatewayException'...), khong service nao doc field nay de
      // hien thi (chi message/errorCode moi duoc dung de hien thi) nen an toan.
      error = (anyBody.error as string) ?? (isHttpException ? exception!.constructor.name : error);
      errorCode = anyBody.errorCode as string | undefined;
      errorParams = anyBody.errorParams as Record<string, string | number> | undefined;
      details = anyBody.details as ErrorResponseDto['details'];
    }

    // 22/08/2026: doc correlation ID Gateway da gan cho request nay (xem
    // apps/gateway/src/proxy/correlation-id.middleware.ts) - chi doc lai tu header, KHONG can
    // middleware rieng o tung service. Ghi kem vao log loi 500 (nhanh duy nhat filter nay tu log)
    // de tra cuu 1 request bi loi xuyen qua nhieu service KHONG con phai doi chieu timestamp.
    const correlationHeader = request?.headers?.[CORRELATION_ID_HEADER];
    const correlationId = Array.isArray(correlationHeader) ? correlationHeader[0] : correlationHeader;

    if (!isHttpException) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(correlationId ? `[${correlationId}] ${stack}` : stack);
    }

    const payload: ErrorResponseDto = {
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request?.url,
      ...(errorCode !== undefined && { errorCode }),
      ...(errorParams !== undefined && { errorParams }),
      ...(details !== undefined && { details }),
      ...(correlationId !== undefined && { correlationId }),
    };

    response.status(statusCode).json(payload);
  }
}
