import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

// 22/08/2026: sao chep tu apps/document-service/src/minio/minio.service.ts (file mau tham chieu,
// xem docblock class ben duoi) - phat hien qua rieng ra soat: SDK `minio` khong dat timeout tren
// bat ky HTTP call nao, nen 1 lan MinIO "treo" mang (khong tu choi ngay ma khong bao gio phan hoi)
// khien putObject() "treo" VO THOI HAN, lam ca request checkIn()/checkOut() cua nguoi dung "treo"
// theo. Boc timeout de LUON tra loi (thanh cong hoac loi) trong thoi gian gioi han.
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

// Anh cham cong nho hon nhieu so voi MAX_FILE_SIZE_BYTES cua Document Service nen tran an toan
// ngan hon - van chi de chan truong hop "treo" THAT SU (0 thong luong), khong phai upload cham binh thuong.
const PUT_OBJECT_TIMEOUT_MS = 15_000;

/**
 * Wrapper mong quanh MinIO SDK (S3-compatible object storage) - Technical_Spec.md muc 17.
 * Sao chep-va-dieu-chinh tu apps/document-service/src/minio/minio.service.ts (file mau tham
 * chieu) - HRM-lite dung BUCKET RIENG (`hrm-attendance`, xem infra/docker-compose.yml minio-init)
 * thay vi goi HTTP noi bo sang Document Service, giu viec ghi anh cham cong + ban ghi Attendance +
 * outbox event la 1 transaction cuc bo duy nhat (Technical_Spec.md muc 17 giai thich ly do).
 * Bucket duoc tao san boi container `minio-init` - service nay chi dung, khong tu tao bucket.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  /** Client rieng chi de ky presigned URL bang public endpoint (xem ghi chu o configuration.ts). */
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

  /** URL GET co chu ky tam thoi - client (trang duyet duyet cham cong cua Manager) tai truc tiep tu MinIO. */
  async presignedGetObject(objectKey: string, expirySeconds = 900): Promise<string> {
    return this.publicUrlClient.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }
}
