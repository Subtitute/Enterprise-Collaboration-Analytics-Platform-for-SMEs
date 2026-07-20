import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtAccessPayload } from '@app/common-dto';

/**
 * WebSocket Gateway cho Notification Service - Technical_Spec.md muc 3.5, Wireframe.md muc 6.
 *
 * Chay tren duong dan Socket.IO mac dinh (KHONG dat `path` tuy chinh): API Gateway rewrite
 * `/ws/notifications/**` -> `/socket.io/**` truoc khi proxy toi service nay, nen tu goc nhin
 * cua service, day chi la 1 Socket.IO server binh thuong o duong dan mac dinh.
 *
 * Xac thuc: service nay KHONG dat sau InternalAuthGuard cho WS (header noi bo khong forward
 * duoc qua WS handshake nhu REST) - tu verify JWT access token truc tiep bang JwtService.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(socket: Socket): void {
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

  /** Day thong bao moi toi room cua 1 user - goi boi NotificationsService sau khi insert. */
  emitNewNotification(userId: string, notification: unknown): void {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  /** Day so luong chua doc moi nhat toi room cua 1 user. */
  emitUnreadCount(userId: string, count: number): void {
    this.server.to(`user:${userId}`).emit('notification:unread-count', { count });
  }
}
