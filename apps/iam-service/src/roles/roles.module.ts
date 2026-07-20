import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { PermissionsSeederService } from './permissions-seeder.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission])],
  providers: [RolesService, PermissionsSeederService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RolesModule {}
