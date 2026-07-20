import { Controller, Get } from '@nestjs/common';

/**
 * Health check rieng cua Gateway - khong proxy, tra ve truc tiep.
 * Duong dan /api/v1/health nam trong PUBLIC_GATEWAY_ROUTES nen middleware xac thuc
 * JWT se bo qua truoc khi request toi duoc day (xem src/proxy/jwt-auth.middleware.ts).
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'gateway', timestamp: new Date().toISOString() };
  }
}
