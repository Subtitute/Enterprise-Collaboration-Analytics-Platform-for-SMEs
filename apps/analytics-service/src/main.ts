import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

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
