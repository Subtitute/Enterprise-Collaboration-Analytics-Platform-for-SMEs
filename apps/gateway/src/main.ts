import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { setupGateway } from './proxy/setup-gateway';

/**
 * Danh sach origin duoc phep goi Gateway (Technical_Spec.md muc 9) - phan tach boi dau phay
 * qua bien moi truong CORS_ORIGIN, fallback ve cong dev mac dinh cua Vite (apps/web/vite.config.ts)
 * khi bien nay chua duoc thiet lap.
 */
function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  // bodyParser: false - Gateway la reverse proxy thuan, KHONG duoc doc/parse body
  // (JSON hay multipart file upload) vi se tieu thu/lam hong stream truoc khi
  // http-proxy-middleware doc lai de forward nguyen ven toi downstream service.
  // Gateway chi can header (Authorization) de xac thuc, khong can body da parse.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Helmet SOM NHAT trong pipeline (Technical_Spec.md muc 9) - gan cac security header chuan
  // (X-Content-Type-Options, X-Frame-Options, ...) cho moi response Gateway tra ve.
  app.use(helmet());

  app.setGlobalPrefix('api/v1');

  // CORS whitelist + credentials: true (Technical_Spec.md muc 6, muc 9) - can thiet de trinh
  // duyet gui/nhan httpOnly cookie refresh token; KHONG the dung wildcard '*' cung voi
  // credentials: true (vi pham Fetch/CORS spec). Gateway la origin duy nhat trinh duyet
  // giao tiep truc tiep, Set-Cookie tu IAM se proxy nguyen ven qua day (xem proxy/rest-proxy.factory.ts).
  app.enableCors({ origin: resolveCorsOrigins(), credentials: true });

  const attachWebSocketUpgrade = setupGateway(app);

  const port = process.env.PORT ?? 3000;
  const server = await app.listen(port);
  attachWebSocketUpgrade(server);

  Logger.log(`API Gateway dang chay tai cong ${port}`, 'Bootstrap');
}

bootstrap();
