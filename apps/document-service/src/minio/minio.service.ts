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
  /** Client rieng chi de ky presigned URL bang public endpoint (xem ghi chu o configuration.ts). */
  private publicUrlClient: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.bucket = this.configService.get<string>('minio.bucket')!;
    const accessKey = this.configService.get<string>('minio.accessKey')!;
    const secretKey = this.configService.get<string>('minio.secretKey')!;
    // `region` duoc dat co dinh de tranh viec SDK tu goi mang xac dinh region cua bucket
    // (getBucketRegion) truoc khi ky - voi publicUrlClient, cuoc goi do se that bai vi
    // endpoint public (vd "localhost:9010") khong the ket noi duoc TU BEN TRONG container.
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

  async removeObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
  }

  /**
   * URL GET co chu ky tam thoi (mac dinh 900s = 15 phut) - client tai truc tiep tu MinIO, khong
   * qua service nay. `respHeaders` (vd `response-content-disposition`) la tham so override chuan
   * cua S3 GetObject - duoc MinIO SDK dua vao chu ky nen khong the bi gia mao phia client.
   */
  async presignedGetObject(
    objectKey: string,
    expirySeconds = 900,
    respHeaders?: Record<string, string>,
  ): Promise<string> {
    return this.publicUrlClient.presignedGetObject(this.bucket, objectKey, expirySeconds, respHeaders);
  }

  /**
   * 22/08/2026: dung cho health check (Terminus) - health.controller.ts. Goi 1 request HEAD
   * nhe (bucketExists) toi MinIO de xac nhan server + credentials con song, KHONG doc/ghi du
   * lieu. Bucket da duoc container `minio-init` tao san (xem ghi chu tren class) nen ket qua
   * `false` (bucket khong ton tai) cung duoc coi la mot dang loi cau hinh - throw de dong bo
   * voi truong hop mang/loi ket noi that bai.
   */
  async checkConnection(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      throw new Error(`MinIO bucket "${this.bucket}" khong ton tai`);
    }
  }
}
