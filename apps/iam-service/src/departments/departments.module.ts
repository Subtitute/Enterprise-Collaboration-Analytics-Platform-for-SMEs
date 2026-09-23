import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  // 17/09/2026: bo sung User - DepartmentsService can userRepo de xac thuc managerId (xem
  // Department.managerId) thuoc dung to chuc truoc khi gan cho phong ban.
  // 23/09/2026: bo sung OutboxModule - DepartmentsService gio phat outbox event
  // DEPARTMENT_MANAGER_CHANGED khi tao/sua phong ban (xem departments.service.ts).
  imports: [TypeOrmModule.forFeature([Department, User]), OutboxModule],
  providers: [DepartmentsService],
  controllers: [DepartmentsController],
})
export class DepartmentsModule {}
