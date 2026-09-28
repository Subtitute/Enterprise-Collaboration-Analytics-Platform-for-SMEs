import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// 28/09/2026: ban sao TOI GIAN cua RedisService, mirror apps/notification-service/src/redis/redis.service.ts
// (cung ly do: WS gateway cua service nay khong di qua Gateway/InternalAuthGuard nen khong tu dong
// duoc bao ve boi kiem tra blacklist da co san cho REST - xem realtime/messaging.gateway.ts). Chi
// can 1 ham DOC (isUserBlacklisted), khong can cac ham GHI vi service nay khong tu blacklist ai.
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

    // Khong co handler 'error' -> mot loi Redis tam thoi se nem 'error' event khong duoc bat,
    // lam sap toan bo tien trinh Node (hanh vi mac dinh cua EventEmitter).
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
