import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

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
    await this.client.putObject(this.bucket, objectKey, buffer, sizeBytes, {
      'Content-Type': mimeType,
    });
  }

  /** URL GET co chu ky tam thoi - client (trang duyet duyet cham cong cua Manager) tai truc tiep tu MinIO. */
  async presignedGetObject(objectKey: string, expirySeconds = 900): Promise<string> {
    return this.publicUrlClient.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }
}
