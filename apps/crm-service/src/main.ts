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
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, exceptionFactory: vietnameseValidationExceptionFactory }),
  );
  // Service noi bo, chi Gateway moi ap dung CORS whitelist (xem apps/document-service/src/main.ts).

  const config = new DocumentBuilder()
    .setTitle('CRM-lite Service API')
    .setDescription('Khach hang, co hoi ban hang (deal pipeline) - Technical_Spec.md muc 16')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3007;
  await app.listen(port);
  Logger.log(`CRM-lite Service dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
