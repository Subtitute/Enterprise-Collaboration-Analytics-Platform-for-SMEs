import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { RedisModule } from '../redis/redis.module';
import { RolesModule } from '../roles/roles.module';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminController } from './platform-admin.controller';

@Module({
  // 25/09/2026: RolesModule (exports RolesService) - Super Admin nay co the sua quyen han cua 1
  // vai tro trong 1 to chuc bat ky, xem chu thich PlatformAdminService.updateOrgRolePermissions().
  imports: [TypeOrmModule.forFeature([Organization, User]), RedisModule, RolesModule],
  providers: [PlatformAdminService],
  controllers: [PlatformAdminController],
})
export class PlatformAdminModule {}
