import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** MAU THAM CHIEU: cac service khac can Redis copy nguyen file nay. */

// 26/08/2026: fix loi MAJOR (ra soat bao mat) - incrementFailedLoginAttempts() ben duoi truoc day
// thuc hien INCR roi, neu ket qua === 1, goi tiep EXPIRE bang 2 lenh Redis RIENG BIET (mirror cung
// loi da sua o apps/gateway/src/rate-limit/rate-limit.middleware.ts). Neu ket noi Redis dut GIUA 2
// lenh do (dung luc counter vua duoc tao, can EXPIRE nhat), key `login-attempts:<email>` se ton tai
// VINH VIEN khong co TTL - tai khoan bi khoa dang nhap oan VINH VIEN thay vi tu mo lai sau cua so
// throttle. Dang ky 1 Lua script (EVALSHA) thuc hien ca INCR va EXPIRE trong DUNG 1 lenh Redis de
// dam bao tinh nguyen tu - dang ky 1 lan duy nhat tai day (cung noi tao client).
export interface RedisWithCustomCommands extends Redis {
  incrWithExpire(key: string, ttlSeconds: number): Promise<number>;
}

const INCR_WITH_EXPIRE_LUA = `
local current = redis.call('INCR', KEYS[1])
if tonumber(current) == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisWithCustomCommands;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      lazyConnect: false,
    }) as RedisWithCustomCommands;

    // Khong co handler 'error' -> mot loi Redis tam thoi (vd mat ket noi) se nem 'error' event
    // khong duoc bat, lam sap toan bo tien trinh Node (hanh vi mac dinh cua EventEmitter).
    this.client.on('error', (err) => this.logger.error('Redis client error', err));

    // 26/08/2026: dang ky lenh tuy chinh incrWithExpire (xem chu thich tren) - phai dang ky lai moi
    // khi tao client moi, dat ngay sau khoi tao client.
    this.client.defineCommand('incrWithExpire', { numberOfKeys: 1, lua: INCR_WITH_EXPIRE_LUA });
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  async blacklistToken(tokenId: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.client.set(`refresh-blacklist:${tokenId}`, '1', 'EX', ttlSeconds);
  }

  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const value = await this.client.get(`refresh-blacklist:${tokenId}`);
    return value !== null;
  }

  /**
   * Thu hoi access token cua mot tai khoan (vd vua bi deactivate) - Technical_Spec.md muc 6
   * (bo sung 21/07/2026). Gateway kiem tra khoa nay song song voi verify chu ky JWT.
   */
  async blacklistUser(userId: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.client.set(`blacklist:user:${userId}`, '1', 'EX', ttlSeconds);
  }

  /**
   * Dem so lan dang nhap THAT BAI lien tiep theo email (da chuan hoa chu thuong o phia goi,
   * xem AuthService.login()) - bo sung 22/08/2026 de chan brute-force dang nhap THEO TAI KHOAN
   * CU THE, bo sung cho rate-limit theo IP da co san o Gateway. Fixed-window bang INCR + EXPIRE
   * lan dau, mirror createRateLimitMiddleware (apps/gateway/src/rate-limit/rate-limit.middleware.ts).
   */
  async incrementFailedLoginAttempts(email: string, windowSeconds: number): Promise<number> {
    // 26/08/2026: thay INCR + EXPIRE (2 lenh rieng biet, khong nguyen tu) bang incrWithExpire (Lua
    // script dang ky trong onModuleInit()) - xem chu thich chi tiet o dau file.
    const key = `login-attempts:${email}`;
    return this.client.incrWithExpire(key, windowSeconds);
  }

  async getFailedLoginAttempts(email: string): Promise<number> {
    const value = await this.client.get(`login-attempts:${email}`);
    return value ? parseInt(value, 10) : 0;
  }

  /** Xoa bo dem ngay khi dang nhap thanh cong - khong de nguoi dung hop le bi khoa oan vi vai lan go nham truoc do. */
  async resetFailedLoginAttempts(email: string): Promise<void> {
    await this.client.del(`login-attempts:${email}`);
  }

  // 22/08/2026: fix audit "/health chua kiem tra Redis" - login()/deactivate() cua service nay deu
  // phu thuoc Redis (throttle dang nhap, blacklist token) nhung /health truoc day chi ping
  // Postgres, an di truong hop Redis chet trong luc 2 co che tren dang fail-open lang le. Dung cho
  // HealthController (mirror analytics-service/redis.service.ts ping()).
  async ping(): Promise<string> {
    return this.client.ping();
  }
}
