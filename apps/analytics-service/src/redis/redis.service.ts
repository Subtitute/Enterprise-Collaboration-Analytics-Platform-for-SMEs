import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * MAU THAM CHIEU tu apps/iam-service/src/redis/redis.service.ts, dieu chinh cho nhu cau
 * cua Analytics Service: cache ket qua truy van KPI (GET /analytics/summary) trong thoi
 * gian ngan de tranh doi TimescaleDB lien tuc khi Dashboard polling (xem analytics.service.ts).
 */
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

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Du lieu cache hong/khong hop le - coi nhu cache miss, khong lam sap request.
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
}
