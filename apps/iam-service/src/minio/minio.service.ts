import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

// 26/10/2026: avatar nguoi dung (Technical_Spec.md muc 27.5) - chep tu apps/hrm-service/src/minio/
// minio.service.ts (cung withTimeout chong MinIO "treo"), them removeObject() cho thay/xoa avatar.
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

const OBJECT_TIMEOUT_MS = 15_000;

/**
 * Bucket `iam-avatars` private (tao san boi container minio-init). Client rieng ky presigned URL
 * bang public endpoint (trinh duyet phan giai duoc), client noi bo de PUT/REMOVE.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private publicUrlClient: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.bucket = this.configService.get<string>('minio.bucket')!;
    const accessKey = this.configService.get<string>('minio.accessKey') ?? '';
    const secretKey = this.configService.get<string>('minio.secretKey') ?? '';
    // region co dinh: presignedGetObject() khong phai goi mang de hoi region cua bucket.
    const region = 'us-east-1';
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('minio.endpoint')!,
      port: this.configService.get<number>('minio.port'),
      useSSL: this.configService.get<boolean>('minio.useSsl'),
      region,
      accessKey,
      secretKey,
    });
    this.publicUrlClient = new Minio.Client({
      endPoint: this.configService.get<string>('minio.publicEndpoint')!,
      port: this.configService.get<number>('minio.publicPort'),
      useSSL: this.configService.get<boolean>('minio.publicUseSsl'),
      region,
      accessKey,
      secretKey,
    });
    this.logger.log(`Da khoi tao MinIO client (bucket: ${this.bucket})`);
  }

  async putObject(objectKey: string, buffer: Buffer, mimeType: string): Promise<void> {
    await withTimeout(
      this.client.putObject(this.bucket, objectKey, buffer, buffer.length, { 'Content-Type': mimeType }),
      OBJECT_TIMEOUT_MS,
      `Upload MinIO vuot qua ${OBJECT_TIMEOUT_MS}ms (object: ${objectKey})`,
    );
  }

  /** Xoa object cu SAU khi DB da cap nhat - loi chi ghi log (object mo coi trong bucket private). */
  async removeObjectQuietly(objectKey: string | null | undefined): Promise<void> {
    if (!objectKey) return;
    try {
      await withTimeout(this.client.removeObject(this.bucket, objectKey), OBJECT_TIMEOUT_MS, 'Xoa object MinIO qua thoi gian');
    } catch (err) {
      this.logger.warn(`Khong xoa duoc avatar cu ${objectKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async presignedGetObject(objectKey: string, expirySeconds: number): Promise<string> {
    return this.publicUrlClient.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }
}
