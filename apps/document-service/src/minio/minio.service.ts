import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

/**
 * Wrapper mong quanh MinIO SDK (S3-compatible object storage) - Technical_Spec.md muc 2, muc 3.4.
 * `onModuleInit` khoi tao client, cung mau voi KafkaProducerService/RedisService cua IAM Service.
 * Bucket duoc tao san boi container `minio-init` trong docker-compose.yml - service nay chi dung,
 * khong tu tao bucket.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.bucket = this.configService.get<string>('minio.bucket')!;
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('minio.endpoint')!,
      port: this.configService.get<number>('minio.port'),
      useSSL: this.configService.get<boolean>('minio.useSsl'),
      accessKey: this.configService.get<string>('minio.accessKey')!,
      secretKey: this.configService.get<string>('minio.secretKey')!,
    });
    this.logger.log(`Da khoi tao MinIO client (bucket: ${this.bucket})`);
  }

  async putObject(objectKey: string, buffer: Buffer, sizeBytes: number, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucket, objectKey, buffer, sizeBytes, {
      'Content-Type': mimeType,
    });
  }

  async removeObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  /** URL GET co chu ky tam thoi (mac dinh 900s = 15 phut) - client tai truc tiep tu MinIO, khong qua service nay. */
  async presignedGetObject(objectKey: string, expirySeconds = 900): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }
}
