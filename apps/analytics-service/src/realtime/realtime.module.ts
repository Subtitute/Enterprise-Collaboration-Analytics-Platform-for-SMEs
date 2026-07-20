import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AnalyticsGateway } from './analytics.gateway';

@Module({
  // register({}) rong: secret duoc truyen tuong minh o tung lan sign/verify (xem analytics.gateway.ts),
  // giong het mau AuthModule cua IAM Service.
  imports: [JwtModule.register({})],
  providers: [AnalyticsGateway],
  exports: [AnalyticsGateway],
})
export class RealtimeModule {}
