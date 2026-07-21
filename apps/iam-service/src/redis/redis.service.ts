import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** MAU THAM CHIEU: cac service khac can Redis copy nguyen file nay. */
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
}
