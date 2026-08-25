import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '@app/common-dto';
import { Department } from '../entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
  ) {}

  findAll(organizationId: string): Promise<Department[]> {
    return this.departmentRepo.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  create(organizationId: string, dto: CreateDepartmentDto): Promise<Department> {
    const department = this.departmentRepo.create({ organizationId, name: dto.name });
    return this.departmentRepo.save(department);
  }

  async update(organizationId: string, id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.departmentRepo.findOne({ where: { id, organizationId } });
    if (!department) throw new NotFoundException({ message: 'Khong tim thay phong ban', errorCode: ERROR_CODES.DEPARTMENT_NOT_FOUND });
    // 25/08/2026: fix ra soat bao mat (khong phai lo hong dang khai thac - class-transformer 0.5.1
    // + ValidationPipe({whitelist:true}) da chan __proto__/constructor truoc khi toi day) - doi
    // Object.assign(department, dto) sang gan tung field ro rang, bo han su phu thuoc vao whitelist
    // cua thu vien de chan mass-assignment, phong khi DTO nay mo rong them field trong tuong lai.
    if (dto.name !== undefined) department.name = dto.name;
    return this.departmentRepo.save(department);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const department = await this.departmentRepo.findOne({ where: { id, organizationId } });
    if (!department) throw new NotFoundException({ message: 'Khong tim thay phong ban', errorCode: ERROR_CODES.DEPARTMENT_NOT_FOUND });
    await this.departmentRepo.remove(department);
  }
}
