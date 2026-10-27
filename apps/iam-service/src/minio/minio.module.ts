import { Global, Module } from '@nestjs/common';
import { MinioService } from './minio.service';

// 26/10/2026: avatar nguoi dung (Technical_Spec.md muc 27.5) - chep tu apps/hrm-service/src/minio.
@Global()
@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
