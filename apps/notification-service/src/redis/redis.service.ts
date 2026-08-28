import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// 25/08/2026: fix ra soat bao mat - truoc day service nay KHONG dung Redis (xem ghi chu config o
// configuration.ts giai thich vi sao bien REDIS_* van duoc tiem san du khong dung toi). Bo sung
// ban sao TOI GIAN cua RedisService (MAU THAM CHIEU: apps/iam-service/src/redis/redis.service.ts)
// - CHI can 1 ham DOC (isUserBlacklisted), khong can cac ham GHI (blacklistToken/
// incrementFailedLoginAttempts/...) vi service nay khong bao gio tu blacklist ai, chi can biet
// tai khoan co dang bi blacklist hay khong truoc khi cho 1 ket noi WebSocket vao (xem
// realtime/notifications.gateway.ts) - WS khong di qua Gateway/InternalAuthGuard nen khong tu
// dong duoc bao ve boi kiem tra blacklist da co san cho REST (jwt-auth.middleware.ts).
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

const BLACKLIST_CHECK_TIMEOUT_MS = 1000;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      lazyConnect: false,
    });

    // Khong co handler 'error' -> mot loi Redis tam thoi (vd mat ket noi) se nem 'error' event
    // khong duoc bat, lam sap toan bo tien trinh Node (hanh vi mac dinh cua EventEmitter).
    this.client.on('error', (err) => this.logger.error('Redis client error', err));
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  /** Doc cung khoa `blacklist:user:${userId}` ma UsersService.deactivate() (iam-service) ghi. */
  async isUserBlacklisted(userId: string): Promise<boolean> {
    const value = await withTimeout(
      this.client.get(`blacklist:user:${userId}`),
      BLACKLIST_CHECK_TIMEOUT_MS,
      `Kiem tra blacklist Redis vuot qua ${BLACKLIST_CHECK_TIMEOUT_MS}ms`,
    );
    return value !== null;
  }
}
