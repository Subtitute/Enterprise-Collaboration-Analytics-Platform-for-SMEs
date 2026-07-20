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
 */
@WebSocketGateway({ cors: { origin: '*' } })
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
