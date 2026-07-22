import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // 22/07/2026: bo enableCors() khong tham so - service noi bo, chi Gateway moi ap dung CORS
  // whitelist (xem giai thich day du tai apps/document-service/src/main.ts).

  const config = new DocumentBuilder()
    .setTitle('Analytics Service API')
    .setDescription(
      'Kafka consumer -> fact tables (TimescaleDB) -> REST KPI + WebSocket real-time - Technical_Spec.md muc 3.6',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3005;
  await app.listen(port);
  Logger.log(`Analytics Service dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
