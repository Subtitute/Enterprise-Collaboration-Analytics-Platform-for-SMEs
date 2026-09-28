import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtAccessPayload } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';
import { ParticipantsService } from '../participants/participants.service';

// Mirror apps/notification-service/src/realtime/notifications.gateway.ts:resolveWebSocketCorsOrigins().
function resolveWebSocketCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * WebSocket Gateway cho Messaging Service - day tin nhan/cuoc tro chuyen moi theo thoi gian thuc.
 * Mirror CHINH XAC apps/notification-service/src/realtime/notifications.gateway.ts: chay tren
 * duong dan Socket.IO mac dinh (API Gateway rewrite `/ws/messaging/**` -> `/socket.io/**` truoc khi
 * proxy toi day), tu verify JWT truc tiep (WS khong di qua InternalAuthGuard nhu REST).
 *
 * 28/09/2026: KHONG co Redis Socket.IO adapter trong repo nay - gia dinh 1 instance duy nhat (cung
 * gioi han da biet voi notifications.gateway.ts va analytics.gateway.ts). Neu chay nhieu instance
 * (scale ngang) sau nay, broadcast qua io.to(room) se KHONG toi duoc socket dang ket noi o instance
 * khac - can bo sung @socket.io/redis-adapter luc do.
 */
@WebSocketGateway({ cors: { origin: resolveWebSocketCorsOrigins() } })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly participantsService: ParticipantsService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.debug(`Socket ${socket.id} khong co token, ngat ket noi`);
      socket.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtAccessPayload>(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      // Kiem tra blacklist (tai khoan vua bi deactivate) - mirror notifications.gateway.ts. Fail-open
      // neu Redis loi (tranh Redis tam thoi mat ket noi lam nghen toan bo WebSocket).
      let blacklisted = false;
      try {
        blacklisted = await this.redisService.isUserBlacklisted(payload.sub);
      } catch (err) {
        this.logger.warn(
          `Kiem tra blacklist that bai, cho qua ket noi: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (blacklisted) {
        this.logger.debug(`Socket ${socket.id} bi tu choi (tai khoan da bi vo hieu hoa)`);
        socket.disconnect(true);
        return;
      }

      socket.data.userId = payload.sub;
      socket.data.organizationId = payload.organizationId;
      void socket.join(`user:${payload.sub}`);
      this.logger.debug(`Socket ${socket.id} da xac thuc, join room user:${payload.sub}`);
    } catch (err) {
      this.logger.debug(`Socket ${socket.id} token khong hop le: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.debug(`Socket ${socket.id} da ngat ket noi`);
  }

  /**
   * Client xin theo doi 1 cuoc tro chuyen cu the (vd dang mo man hinh chat cua no) - phai la thanh
   * vien moi duoc join room `conversation:<id>`, tranh 1 user nghe len tin nhan cua cuoc tro chuyen
   * ho khong tham gia chi bang cach doan conversationId. Khong dung exception/disconnect khi tu
   * choi (khac handleConnection) - chi khong join, giu nguyen ket noi WS cho cac cuoc tro chuyen khac.
   */
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId?: string },
  ): Promise<void> {
    const userId = socket.data.userId as string | undefined;
    const conversationId = data?.conversationId;
    if (!userId || !conversationId) return;

    const isParticipant = await this.participantsService.isParticipant(conversationId, userId);
    if (!isParticipant) {
      this.logger.debug(`User ${userId} khong phai thanh vien ${conversationId}, tu choi join room`);
      return;
    }
    void socket.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(@ConnectedSocket() socket: Socket, @MessageBody() data: { conversationId?: string }): void {
    if (!data?.conversationId) return;
    void socket.leave(`conversation:${data.conversationId}`);
  }

  /** Tin nhan moi - day ca toi room cuoc tro chuyen (nguoi dang mo man hinh chat) lan room tung
   * thanh vien (nguoi dang o man hinh khac, vd danh sach hoi thoai/badge chua doc) - khong theo doi
   * presence, client tu dedupe/cap nhat idempotent. */
  emitNewMessage(conversationId: string, message: unknown, participantUserIds: string[]): void {
    const payload = { conversationId, message };
    this.server.to(`conversation:${conversationId}`).emit('message:new', payload);
    for (const userId of participantUserIds) {
      this.server.to(`user:${userId}`).emit('message:new', payload);
    }
  }

  /** Cuoc tro chuyen moi (DIRECT lan dau hoac GROUP moi tao) - bao cho tung thanh vien ban dau. */
  emitNewConversation(conversation: unknown, participantUserIds: string[]): void {
    for (const userId of participantUserIds) {
      this.server.to(`user:${userId}`).emit('conversation:new', { conversation });
    }
  }

  /** Cuoc tro chuyen thay doi (vd them/bot thanh vien nhom) - bao cho cac user bi anh huong. */
  emitConversationUpdated(conversation: unknown, targetUserIds: string[]): void {
    for (const userId of targetUserIds) {
      this.server.to(`user:${userId}`).emit('conversation:updated', { conversation });
    }
  }
}
