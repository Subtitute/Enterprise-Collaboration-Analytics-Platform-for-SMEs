import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { vietnameseValidationExceptionFactory } from '@app/common-guard';
import { AppModule } from './app.module';

/**
 * Danh sach origin duoc phep goi IAM Service truc tiep (Technical_Spec.md muc 9) - phan tach
 * boi dau phay qua bien moi truong CORS_ORIGIN. Thong thuong client chi goi qua API Gateway
 * (khong expose port ra host - Technical_Spec.md muc 8), nhung IAM gio da set httpOnly cookie
 * (refresh token - muc 6) nen van can whitelist + credentials nhat quan phong khi frontend goi
 * thang toi day luc dev.
 */
function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet SOM NHAT trong pipeline (Technical_Spec.md muc 9).
  app.use(helmet());
  // cookie-parser de doc refresh token tu httpOnly cookie (req.cookies) trong AuthController -
  // Technical_Spec.md muc 6 (bo sung 21/07/2026).
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');
  // 25/07/2026: bo sung exceptionFactory - fix audit "ValidationPipe tra loi 400 bang tieng Anh"
  // (vd "email must be an email"), xem packages/common-guard/src/pipes/vietnamese-validation.pipe.ts.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: vietnameseValidationExceptionFactory }),
  );
  app.enableCors({ origin: resolveCorsOrigins(), credentials: true });

  const config = new DocumentBuilder()
    .setTitle('IAM Service API')
    .setDescription(
      'Dang ky to chuc, dang nhap, quan ly user/department/role - Technical_Spec.md muc 3.2',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`IAM Service dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
