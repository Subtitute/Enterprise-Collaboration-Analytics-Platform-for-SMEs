import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  // 17/09/2026: bo sung User - DepartmentsService can userRepo de xac thuc managerId (xem
  // Department.managerId) thuoc dung to chuc truoc khi gan cho phong ban.
  imports: [TypeOrmModule.forFeature([Department, User])],
  providers: [DepartmentsService],
  controllers: [DepartmentsController],
})
export class DepartmentsModule {}
