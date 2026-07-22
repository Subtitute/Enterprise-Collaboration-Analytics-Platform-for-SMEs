import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Department } from '../entities/department.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { OutboxModule } from '../outbox/outbox.module';

// 22/07/2026: bo sung Department vao forFeature() - UsersService gio inject them Department repo
// de xac thuc departmentId thuoc dung to chuc truoc khi gan cho user (xem users.service.ts,
// invite()/update()); thieu dang ky o day se lam Nest nem loi "no metadata for Department" luc
// khoi dong module.
@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Department]), OutboxModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
