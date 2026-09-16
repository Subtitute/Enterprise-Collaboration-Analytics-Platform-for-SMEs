import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { RedisModule } from '../redis/redis.module';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminController } from './platform-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, User]), RedisModule],
  providers: [PlatformAdminService],
  controllers: [PlatformAdminController],
})
export class PlatformAdminModule {}
