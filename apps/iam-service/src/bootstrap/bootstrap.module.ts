import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { SuperAdminBootstrapService } from './super-admin-bootstrap.service';

// 16/09/2026: "Super Admin" - xem super-admin-bootstrap.service.ts.
@Module({
  imports: [TypeOrmModule.forFeature([User, Organization])],
  providers: [SuperAdminBootstrapService],
})
export class BootstrapModule {}
