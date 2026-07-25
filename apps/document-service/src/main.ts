import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { vietnameseValidationExceptionFactory } from '@app/common-guard';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  // 25/07/2026: bo sung exceptionFactory - fix audit "ValidationPipe tra loi 400 bang tieng Anh"
  // (vd "email must be an email"), xem packages/common-guard/src/pipes/vietnamese-validation.pipe.ts.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: vietnameseValidationExceptionFactory }),
  );
  // 22/07/2026: bo enableCors() khong tham so (mac dinh Access-Control-Allow-Origin: '*') -
  // service nay la NOI BO, chi duoc goi qua Gateway (xem apps/gateway/src/proxy va
  // nginx.conf cua web), KHONG bao gio nhan request truc tiep tu trinh duyet. Gateway la
  // noi DUY NHAT ap dung CORS whitelist + credentials: true (apps/gateway/src/main.ts).
  // Truoc ban sua nay, wildcard '*' bi http-proxy-middleware chuyen tiep nguyen ven qua
  // Gateway, ket hop voi Access-Control-Allow-Credentials: true cua Gateway thanh 1 to hop
  // VI PHAM Fetch/CORS spec (khong duoc dung '*' cung credentials: true) - vo hai voi trien
  // khai hien tai (trinh duyet goi qua nginx cung-origin nen khong ap dung kiem tra CORS),
  // nhung se lam hong CORS thuc su khi FE chay o che do dev (Vite, khac origin that).

  const config = new DocumentBuilder()
    .setTitle('Document Service API')
    .setDescription(
      'Quan ly Folder/File (metadata PostgreSQL + noi dung nhi phan MinIO), chia se, versioning don gian - Technical_Spec.md muc 3.4',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  Logger.log(`Document Service dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
