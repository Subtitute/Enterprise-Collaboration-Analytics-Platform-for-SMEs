import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
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

  // Socket.IO server tren duong dan mac dinh (/socket.io) - KHONG doi `path`, API Gateway rewrite
  // `/ws/messaging/**` -> `/socket.io/**` truoc khi proxy toi day (xem proxy-routes.config.ts).
  app.useWebSocketAdapter(new IoAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('Messaging Service API')
    .setDescription('Nhan tin noi bo 1:1 va nhom/kenh giua cac thanh vien cung to chuc')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3009;
  await app.listen(port);
  Logger.log(`Messaging Service dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
