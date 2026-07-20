import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** MAU THAM CHIEU: cac service khac can Redis copy nguyen file nay. */
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

  async blacklistToken(tokenId: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.client.set(`refresh-blacklist:${tokenId}`, '1', 'EX', ttlSeconds);
  }

  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const value = await this.client.get(`refresh-blacklist:${tokenId}`);
    return value !== null;
  }
}
