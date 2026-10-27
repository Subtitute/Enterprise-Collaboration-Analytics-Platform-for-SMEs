import { Module } from '@nestjs/common';
import { UserDirectoryConsumer } from './user-directory.consumer';

/** 26/10/2026: read-model dim_user (user -> phong ban) - xem user-directory.ts. */
@Module({
  providers: [UserDirectoryConsumer],
})
export class UserDirectoryModule {}
