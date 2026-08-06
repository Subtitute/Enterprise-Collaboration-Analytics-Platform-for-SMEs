import { Controller, Get } from '@nestjs/common';
import { Public } from '@app/common-guard';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'hrm-service', timestamp: new Date().toISOString() };
  }
}
