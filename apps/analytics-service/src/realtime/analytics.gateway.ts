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
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAccessPayload, PERMISSIONS } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';

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
    private readonly redisService: RedisService,
    // 26/10/2026: tra dim_user/dim_department_manager de chia phong WS theo pham vi (xem resolveRooms()).
    @InjectDataSource() private readonly dataSource: DataSource,
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

      // 25/08/2026: fix ra soat bao mat - REST qua Gateway da kiem tra blacklist tu 21/07/2026
      // (jwt-auth.middleware.ts) nen 1 tai khoan vua bi deactivate mat quyen truy cap REST NGAY,
      // nhung WebSocket khong di qua Gateway/InternalAuthGuard nen truoc ban sua nay hoan toan bo
      // sot - 1 token con han (toi 15 phut) van mo duoc ket noi WS moi va tiep tuc nhan du lieu
      // hoat dong real-time cua to chuc sau khi tai khoan da bi vo hieu hoa. Fail-open neu Redis
      // loi (cung triet ly voi REST) - khong de 1 su co Redis chan ca tinh nang real-time.
      let blacklisted = false;
      try {
        blacklisted = await this.redisService.isUserBlacklisted(payload.sub);
      } catch (err) {
        this.logger.warn(
          `Kiem tra blacklist that bai, cho qua ket noi: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (blacklisted) {
        this.logger.warn(`Tu choi ket noi (tai khoan da bi vo hieu hoa): ${client.id}`);
        client.disconnect(true);
        return;
      }

      // 25/08/2026: fix ra soat bao mat - handleConnection() truoc day chi verify chu ky JWT
      // (XAC THUC), khong kiem tra quyen `analytics:view` (UY QUYEN) nhu ban REST tuong duong da
      // lam (@RequirePermissions(PERMISSIONS.ANALYTICS_VIEW) tren AnalyticsController - quyen nay
      // KHONG co san o vai tro Employee mac dinh, xem packages/common-dto/src/enums/permission.enum.ts).
      // Truoc ban sua nay, 1 nhan vien khong co quyen xem bao cao van bi chan o REST nhung van mo
      // ket noi WS duoc va tho dong nhan feed hoat dong real-time (eventId/eventType/actorId) cua
      // ca to chuc - lech chinh sach uy quyen giua 2 kenh cho CUNG 1 tinh nang.
      if (!payload.permissions?.includes(PERMISSIONS.ANALYTICS_VIEW)) {
        this.logger.warn(`Tu choi ket noi (thieu quyen analytics:view): ${client.id}`);
        client.disconnect(true);
        return;
      }

      const rooms = await this.resolveRooms(payload);
      await client.join(rooms);
      this.logger.log(`Client ${client.id} da tham gia phong ${rooms.join(', ')}`);
    } catch {
      this.logger.warn(`Tu choi ket noi (token khong hop le hoac het han): ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client ngat ket noi: ${client.id}`);
  }

  /**
   * 26/10/2026: phong WS theo pham vi xem (mirror AnalyticsService.getRecentActivity()) - truoc day
   * MOI client co analytics:view (ke ca Manager) deu vao phong `org:<id>` va nhan push hoat dong cua
   * CA to chuc (FE tu thua nhan khong loc duoc o pham vi 'department'). Org Admin (USER_MANAGE): phong
   * to chuc; Manager: phong `user:<chinh minh>` + `dept:<phong ban minh thuoc ve/phu trach>`. Loi tra
   * cuu phong ban phu trach -> chi con phong ban JWT (khong mo rong pham vi khi loi).
   */
  private async resolveRooms(payload: JwtAccessPayload): Promise<string[]> {
    if (payload.permissions?.includes(PERMISSIONS.USER_MANAGE)) return [`org:${payload.organizationId}`];
    let managed: string[] = [];
    try {
      const rows = await this.dataSource.query<{ department_id: string }[]>(
        `SELECT department_id FROM dim_department_manager WHERE organization_id = $1 AND manager_id = $2`,
        [payload.organizationId, payload.sub],
      );
      managed = rows.map((row) => row.department_id);
    } catch (err) {
      this.logger.warn(`Khong tra duoc phong ban phu trach cho WS: ${err instanceof Error ? err.message : String(err)}`);
    }
    const departments = new Set([payload.departmentId, ...managed].filter((id): id is string => Boolean(id)));
    return [`user:${payload.sub}`, ...Array.from(departments, (id) => `dept:${id}`)];
  }

  /**
   * Duoc goi boi KafkaConsumerService ngay sau khi ghi thanh cong vao fact table,
   * day su kien tho toi toan bo client dang xem Dashboard cua cung 1 to chuc.
   *
   * 26/10/2026: chi day toi Org Admin (phong to chuc), chinh nguoi thuc hien va Manager cua phong ban
   * nguoi thuc hien (tra dim_user) - xem resolveRooms(). socket.io tu khu trung khi 1 client o nhieu phong.
   */
  emitActivity(
    organizationId: string,
    data: { eventId: string; eventType: string; occurredAt: string; actorId: string | null },
  ): void {
    if (!this.server) return;
    void this.lookupActorDepartment(data.actorId).then((departmentId) => {
      let target = this.server.to(`org:${organizationId}`);
      if (data.actorId) target = target.to(`user:${data.actorId}`);
      if (departmentId) target = target.to(`dept:${departmentId}`);
      target.emit('analytics:activity', data);
    });
  }

  private async lookupActorDepartment(actorId: string | null): Promise<string | null> {
    if (!actorId) return null;
    try {
      const rows = await this.dataSource.query<{ department_id: string | null }[]>(
        `SELECT department_id FROM dim_user WHERE user_id = $1`,
        [actorId],
      );
      return rows[0]?.department_id ?? null;
    } catch {
      return null;
    }
  }
}
