import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupGateway } from './proxy/setup-gateway';

async function bootstrap() {
  // bodyParser: false - Gateway la reverse proxy thuan, KHONG duoc doc/parse body
  // (JSON hay multipart file upload) vi se tieu thu/lam hong stream truoc khi
  // http-proxy-middleware doc lai de forward nguyen ven toi downstream service.
  // Gateway chi can header (Authorization) de xac thuc, khong can body da parse.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api/v1');
  app.enableCors();

  const attachWebSocketUpgrade = setupGateway(app);

  const port = process.env.PORT ?? 3000;
  const server = await app.listen(port);
  attachWebSocketUpgrade(server);

  Logger.log(`API Gateway dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
