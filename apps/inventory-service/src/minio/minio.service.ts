import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

// Sao chep tu apps/document-service/src/minio/minio.service.ts (file mau tham chieu) - xem chu
// thich chi tiet tai do ve ly do boc timeout (SDK `minio` khong tu dat timeout tren HTTP call).
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

const CHECK_CONNECTION_TIMEOUT_MS = 2000;
const REMOVE_OBJECT_TIMEOUT_MS = 10_000;
// Anh san pham nho hon nhieu so voi file tai lieu (xem MAX_IMAGE_SIZE_BYTES, products.service.ts) -
// 30s van la tran an toan hop ly, giu dong bo voi document-service/hrm-service thay vi rut ngan.
const PUT_OBJECT_TIMEOUT_MS = 30_000;

/**
 * Wrapper mong quanh MinIO SDK (S3-compatible object storage) cho anh san pham - Technical_Spec.md
 * muc 22. Sao chep tu apps/document-service/src/minio/minio.service.ts (file mau tham chieu), chi
 * bo presignedGetObject's `respHeaders` (anh san pham khong can ep tai ve, chi hien thi inline).
 * Bucket duoc tao san boi container `minio-init` trong docker-compose.yml.
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
    const accessKey = this.configService.get<string>('minio.accessKey')!;
    const secretKey = this.configService.get<string>('minio.secretKey')!;
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

  async putObject(objectKey: string, buffer: Buffer, sizeBytes: number, mimeType: string): Promise<void> {
    await withTimeout(
      this.client.putObject(this.bucket, objectKey, buffer, sizeBytes, { 'Content-Type': mimeType }),
      PUT_OBJECT_TIMEOUT_MS,
      `Upload MinIO vuot qua ${PUT_OBJECT_TIMEOUT_MS}ms (object: ${objectKey})`,
    );
  }

  async removeObject(objectKey: string): Promise<void> {
    await withTimeout(
      this.client.removeObject(this.bucket, objectKey),
      REMOVE_OBJECT_TIMEOUT_MS,
      `Xoa object MinIO vuot qua ${REMOVE_OBJECT_TIMEOUT_MS}ms (object: ${objectKey})`,
    );
  }

  /** URL GET co chu ky tam thoi (mac dinh 900s = 15 phut) - client tai truc tiep tu MinIO. */
  async presignedGetObject(objectKey: string, expirySeconds = 900): Promise<string> {
    return this.publicUrlClient.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }

  /** Dung cho health check (Terminus) - xem ghi chu tai health.controller.ts ve ly do KHONG goi ham nay trong /health. */
  async checkConnection(): Promise<void> {
    const exists = await withTimeout(
      this.client.bucketExists(this.bucket),
      CHECK_CONNECTION_TIMEOUT_MS,
      `Kiem tra ket noi MinIO vuot qua ${CHECK_CONNECTION_TIMEOUT_MS}ms`,
    );
    if (!exists) {
      throw new Error(`MinIO bucket "${this.bucket}" khong ton tai`);
    }
  }
}
