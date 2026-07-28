import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Department } from '../entities/department.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { OutboxModule } from '../outbox/outbox.module';
// 28/07/2026: service moi - resync toan bo departmentId cua moi user vao outbox moi lan khoi dong,
// phuc vu KPI theo phong ban cua Analytics Service (xem chu thich chi tiet trong chinh file nay).
import { UserDepartmentSyncService } from './user-department-sync.service';

// 22/07/2026: bo sung Department vao forFeature() - UsersService gio inject them Department repo
// de xac thuc departmentId thuoc dung to chuc truoc khi gan cho user (xem users.service.ts,
// invite()/update()); thieu dang ky o day se lam Nest nem loi "no metadata for Department" luc
// khoi dong module.
@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Department]), OutboxModule],
  // 28/07/2026: dang ky them UserDepartmentSyncService lam provider de Nest tu goi
  // onApplicationBootstrap() cua no luc khoi dong service (xem OnApplicationBootstrap).
  providers: [UsersService, UserDepartmentSyncService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
