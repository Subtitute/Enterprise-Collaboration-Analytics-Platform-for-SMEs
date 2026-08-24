import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// 22/08/2026: phat hien qua rieng ra soat - fix truoc do (cung ngay) chi boc timeout cho ping()
// (dung cho /health), CHUA boc cho getJson()/setJson() - noi thuc su nam tren duong di NONG
// (GET /analytics/summary duoc Dashboard polling, va AI insight). ioredis mac dinh
// `enableOfflineQueue: true` nen mat ket noi Redis khien 2 ham nay "treo" toi hang chuc giay
// (cho maxRetriesPerRequest) truoc khi try/catch o noi goi (analytics.service.ts/
// ai-insights.service.ts, da co san "coi nhu cache miss" khi bat duoc loi) kip chay - nguoi dung
// van phai cho ca chuc giay moi thay du lieu, du cache-miss-fallback ve TimescaleDB von rat nhanh.
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

const REDIS_CACHE_TIMEOUT_MS = 500;

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
    const raw = await withTimeout(
      this.client.get(key),
      REDIS_CACHE_TIMEOUT_MS,
      `Doc cache Redis vuot qua ${REDIS_CACHE_TIMEOUT_MS}ms (key=${key})`,
    );
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
    await withTimeout(
      this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds),
      REDIS_CACHE_TIMEOUT_MS,
      `Ghi cache Redis vuot qua ${REDIS_CACHE_TIMEOUT_MS}ms (key=${key})`,
    );
  }

  // 22/08/2026: fix audit "/health la liveness-only" - dung cho HealthController (xem
  // health/health.controller.ts) de kiem tra Redis that qua PING thay vi tra ve {status:'ok'}
  // co dinh. Chi expose PING (khong lo `client` ra ngoai) de giu nguyen viec dong goi ket noi
  // ioredis ben trong service nay.
  async ping(): Promise<string> {
    return this.client.ping();
  }
}
