import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Sao chep tu apps/iam-service/src/redis/redis.service.ts (file mau tham chieu). */

// 26/08/2026: fix loi MAJOR (ra soat bao mat) - checkRateLimit() (rate-limit.middleware.ts) truoc
// day thuc hien INCR roi, neu ket qua === 1, goi tiep EXPIRE bang 2 lenh Redis RIENG BIET. Neu ket
// noi Redis dut GIUA 2 lenh do (dung luc key vua duoc tao, can EXPIRE nhat), key bo dem se ton tai
// VINH VIEN khong co TTL - toan bo request sau nay cua chinh IP/to chuc do bi tinh don vao 1 "cua
// so" khong bao gio tu reset, tuong duong bi rate-limit khoa oan vinh vien. Dang ky 1 Lua script
// (EVALSHA) thuc hien CA HAI buoc trong DUNG 1 lenh Redis de dam bao tinh nguyen tu - khong con "khe
// ho" giua 2 lenh de su co mang len tieng. Dang ky 1 lan duy nhat tai day (cung noi tao client).
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
    // khi tao client moi (vd sau reconnect/khoi tao lai instance), dat ngay sau khoi tao client.
    this.client.defineCommand('incrWithExpire', { numberOfKeys: 1, lua: INCR_WITH_EXPIRE_LUA });
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  /** Client ioredis tho, dung cho bo dem rate-limit (incrWithExpire) - xem rate-limit.middleware.ts. */
  getClient(): RedisWithCustomCommands {
    return this.client;
  }

  /** Kiem tra tai khoan da bi blacklist (vd vua bi deactivate) - khoa do IAM Service ghi. */
  async isUserBlacklisted(userId: string): Promise<boolean> {
    const value = await this.client.get(`blacklist:user:${userId}`);
    return value !== null;
  }
}
