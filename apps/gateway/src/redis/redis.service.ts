import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Sao chep tu apps/iam-service/src/redis/redis.service.ts (file mau tham chieu). */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password'),
      lazyConnect: false,
    });
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  /** Client ioredis tho, dung cho bo dem rate-limit (INCR/EXPIRE) - xem rate-limit.middleware.ts. */
  getClient(): Redis {
    return this.client;
  }
}
