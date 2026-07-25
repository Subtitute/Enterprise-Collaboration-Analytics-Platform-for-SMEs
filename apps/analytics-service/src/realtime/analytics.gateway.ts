import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAccessPayload } from '@app/common-dto';

/**
 * 25/07/2026 (audit - MINOR): doc danh sach origin duoc phep mo WebSocket handshake tu bien moi
 * truong CORS_ORIGIN, cung 1 cach lam voi apps/gateway/src/main.ts:resolveCorsOrigins() - fallback
 * ve cong dev mac dinh cua Vite (apps/web/vite.config.ts) khi bien nay chua duoc thiet lap.
 * Doc truc tiep tu process.env (khong qua ConfigService) vi day la tham so cua decorator
 * @WebSocketGateway, duoc danh gia luc MODULE duoc load - truoc khi Nest dung DI de tao instance
 * ConfigService.
 */
function resolveWebSocketCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * WebSocket Gateway - day cap nhat KPI/hoat dong real-time toi Dashboard
 * (Wireframe.md muc 3 - "Hoat dong gan day (real-time)").
 *
 * KHONG khai bao custom `path`: API Gateway rewrite `/ws/analytics/**` -> `/socket.io/**`
 * truoc khi forward request toi day (dong bo voi Notification Service - cung mau).
 *
 * Ket noi WebSocket KHONG di qua InternalAuthGuard (guard chi ap dung cho HTTP request
 * duoc Gateway forward kem header noi bo x-org-id/x-user-id). Vi vay Gateway nay PHAI tu
 * verify JWT bang JWT_ACCESS_SECRET (Technical_Spec.md muc 6, muc 1 - "GW forward WebSocket
 * handshake toi Notification/Analytics Service").
 *
 * 25/07/2026 (audit - MINOR): thay wildcard `cors.origin: '*'` bang danh sach origin doc tu
 * CORS_ORIGIN (dong bo cach apps/gateway/src/main.ts:resolveCorsOrigins() lam cho chinh HTTP
 * CORS cua API Gateway). Hang phong thu THAT SU van la buoc verify JWT trong handleConnection()
 * ben duoi - '*' truoc day khong phai lo hong bao mat (khong co credentials nhay cam trong
 * handshake WS ngoai token da duoc verify), nhung sieu chat che hon va NHAT QUAN voi chinh sach
 * CORS cua Gateway thi tot hon la wildcard tuy tien.
 */
@WebSocketGateway({ cors: { origin: resolveWebSocketCorsOrigins() } })
export class AnalyticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AnalyticsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Tu choi ket noi (thieu token): ${client.id}`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
      const room = `org:${payload.organizationId}`;
      await client.join(room);
      this.logger.log(`Client ${client.id} da tham gia phong ${room}`);
    } catch {
      this.logger.warn(`Tu choi ket noi (token khong hop le hoac het han): ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client ngat ket noi: ${client.id}`);
  }

  /**
   * Duoc goi boi KafkaConsumerService ngay sau khi ghi thanh cong vao fact table,
   * day su kien tho toi toan bo client dang xem Dashboard cua cung 1 to chuc.
   */
  emitActivity(
    organizationId: string,
    data: { eventId: string; eventType: string; occurredAt: string; actorId: string | null },
  ): void {
    this.server?.to(`org:${organizationId}`).emit('analytics:activity', data);
  }
}
