import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ErrorResponseDto } from '@app/common-dto';

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

    if (typeof body === 'string') {
      message = body;
      error = exception!.constructor.name;
    } else if (body && typeof body === 'object') {
      const anyBody = body as Record<string, unknown>;
      message = (anyBody.message as string | string[]) ?? message;
      error = (anyBody.error as string) ?? (isHttpException ? exception!.constructor.name : error);
    }

    if (!isHttpException) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const payload: ErrorResponseDto = {
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request?.url,
    };

    response.status(statusCode).json(payload);
  }
}
