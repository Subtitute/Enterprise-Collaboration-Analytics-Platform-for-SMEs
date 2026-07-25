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
  // 22/07/2026: bo enableCors() khong tham so - service noi bo, chi Gateway moi ap dung CORS
  // whitelist (xem giai thich day du tai apps/document-service/src/main.ts).

  const config = new DocumentBuilder()
    .setTitle('Project & Task Service API')
    .setDescription(
      'Quan ly du an, cong viec (Kanban), giao viec, binh luan - Technical_Spec.md muc 3.3',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  Logger.log(`Project & Task Service dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
