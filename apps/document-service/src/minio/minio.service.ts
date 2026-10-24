import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

// 22/08/2026: phat hien qua rieng ra soat - SDK `minio` (xac minh truc tiep trong
// node_modules/minio/src/internal/request.ts) khong dat timeout tren bat ky HTTP call nao (khong
// `timeout` option, khong `req.setTimeout()`), nen 1 lan MinIO "treo" mang (khong phai tu choi
// ngay, ma khong bao gio phan hoi - vd container dong bang, ket noi nua-mo) khien moi ham cua
// client nay "treo" VO THOI HAN. Cung 1 lop loi voi ioredis `enableOfflineQueue` da tung sua o
// noi khac (vd apps/gateway/src/rate-limit/rate-limit.middleware.ts) nhung chua duoc ap dung cho
// MinIO. Boc timeout de moi thao tac LUON tra loi (thanh cong hoac loi) trong thoi gian gioi han.
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
// 25/08/2026: fix code review Major (phat hien qua dot ra soat toan du an lan 3) - removeObject()
// truoc day KHONG duoc boc timeout nhu putObject()/checkConnection() (cung 1 SDK, cung khong dat
// timeout tren HTTP call, xem chu thich dau file), dan goi tu files.service.ts SAU KHI transaction
// DB da commit (xoa file / don ban cu) - neu MinIO "treo" mang, request DELETE/upload van cho VO
// THOI HAN du DB da xong viec, du du lieu that su khong con lien quan.
const REMOVE_OBJECT_TIMEOUT_MS = 10_000;
// putObject co the that su can vai chuc giay cho file lon (toi da MAX_FILE_SIZE_BYTES, xem
// files.service.ts) tren mang cham nhung VAN CO TIEN TRIEN - 30s la tran an toan chi de chan
// truong hop "treo" THAT SU (0 thong luong, khong phai cham), khong phai gioi han thoi gian upload
// binh thuong.
const PUT_OBJECT_TIMEOUT_MS = 30_000;
// 24/10/2026: doc lai noi dung file de trich van ban cho RAG (rag/document-indexer.service.ts) -
// chay nen, khong nam tren duong request cua nguoi dung, cung tran 30s voi putObject.
const GET_OBJECT_TIMEOUT_MS = 30_000;

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
    await withTimeout(
      this.client.putObject(this.bucket, objectKey, buffer, sizeBytes, { 'Content-Type': mimeType }),
      PUT_OBJECT_TIMEOUT_MS,
      `Upload MinIO vuot qua ${PUT_OBJECT_TIMEOUT_MS}ms (object: ${objectKey})`,
    );
  }

  /**
   * 24/10/2026: tai toan bo noi dung 1 object vao bo nho (Buffer) - dung cho RAG. `maxBytes` chan
   * tren: vuot qua thi huy stream va nem loi ngay (khong buffer tiep 1 file qua lon vao RAM).
   */
  async getObjectBuffer(objectKey: string, maxBytes: number): Promise<Buffer> {
    const read = async (): Promise<Buffer> => {
      const stream = await this.client.getObject(this.bucket, objectKey);
      const parts: Buffer[] = [];
      let total = 0;
      for await (const part of stream) {
        const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part as Uint8Array);
        total += buffer.length;
        if (total > maxBytes) {
          stream.destroy();
          throw new Error(`Object MinIO vuot qua ${maxBytes} byte (object: ${objectKey})`);
        }
        parts.push(buffer);
      }
      return Buffer.concat(parts);
    };
    return withTimeout(read(), GET_OBJECT_TIMEOUT_MS, `Doc object MinIO vuot qua ${GET_OBJECT_TIMEOUT_MS}ms (object: ${objectKey})`);
  }

  async removeObject(objectKey: string): Promise<void> {
    await withTimeout(
      this.client.removeObject(this.bucket, objectKey),
      REMOVE_OBJECT_TIMEOUT_MS,
      `Xoa object MinIO vuot qua ${REMOVE_OBJECT_TIMEOUT_MS}ms (object: ${objectKey})`,
    );
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
