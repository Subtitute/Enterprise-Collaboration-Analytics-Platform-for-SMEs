import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  // Socket.IO server tren duong dan mac dinh (/socket.io) - KHONG doi `path`, vi
  // API Gateway rewrite `/ws/notifications/**` -> `/socket.io/**` truoc khi proxy toi day
  // (xem doc/spec giao cho service nay: pathRewrite '^/ws/notifications' -> '/socket.io').
  app.useWebSocketAdapter(new IoAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('Notification Service API')
    .setDescription(
      'Tieu thu su kien Kafka (IAM/Project-Task/Document), sinh notification, luu MongoDB, ' +
        'day real-time qua WebSocket - Technical_Spec.md muc 3.5',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3004;
  await app.listen(port);
  Logger.log(`Notification Service dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
