import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Sao chep tu apps/iam-service/src/redis/redis.service.ts (file mau tham chieu). */
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

  /** Client ioredis tho, dung cho bo dem rate-limit (INCR/EXPIRE) - xem rate-limit.middleware.ts. */
  getClient(): Redis {
    return this.client;
  }

  /** Kiem tra tai khoan da bi blacklist (vd vua bi deactivate) - khoa do IAM Service ghi. */
  async isUserBlacklisted(userId: string): Promise<boolean> {
    const value = await this.client.get(`blacklist:user:${userId}`);
    return value !== null;
  }
}
