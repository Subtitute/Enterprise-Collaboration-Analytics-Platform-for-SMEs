import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '@app/common-dto';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    // 17/09/2026: bo sung inject User repo - can de xac thuc managerId (nguoi phu trach phong
    // ban, xem Department.managerId) thuoc dung to chuc cua nguoi goi truoc khi gan, giong het
    // cach UsersService xac thuc departmentId qua departmentRepo.findOne({ where: { id,
    // organizationId } }) (xem apps/iam-service/src/users/users.service.ts).
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  findAll(organizationId: string): Promise<Department[]> {
    return this.departmentRepo.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  async create(organizationId: string, dto: CreateDepartmentDto): Promise<Department> {
    if (dto.managerId) await this.assertManagerInOrg(organizationId, dto.managerId);
    const department = this.departmentRepo.create({
      organizationId,
      name: dto.name,
      managerId: dto.managerId ?? null,
    });
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
    // 17/09/2026: xac thuc managerId thuoc DUNG to chuc truoc khi gan - cung 1 ly do voi
    // departmentId trong UsersService.update() (xem chu thich tai do): managerId chi la 1 UUID bat
    // ky do client gui len, neu khong kiem tra thi 1 Org Admin cua to chuc A co the truyen id
    // nguoi dung thuoc to chuc B va vo tinh/co y gan sai nguoi phu trach xuyen to chuc.
    if (dto.managerId !== undefined) {
      await this.assertManagerInOrg(organizationId, dto.managerId);
      department.managerId = dto.managerId;
    }
    return this.departmentRepo.save(department);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const department = await this.departmentRepo.findOne({ where: { id, organizationId } });
    if (!department) throw new NotFoundException({ message: 'Khong tim thay phong ban', errorCode: ERROR_CODES.DEPARTMENT_NOT_FOUND });
    await this.departmentRepo.remove(department);
  }

  // 17/09/2026: dung chung cho create()/update() - nem 404 USER_NOT_FOUND (tai su dung ma loi san
  // co trong ERROR_CODES, khong them ma loi moi) neu managerId khong ung voi user nao trong DUNG
  // to chuc dang thao tac.
  private async assertManagerInOrg(organizationId: string, managerId: string): Promise<void> {
    const manager = await this.userRepo.findOne({ where: { id: managerId, organizationId } });
    if (!manager) {
      throw new NotFoundException({
        message: 'Khong tim thay nguoi dung duoc chon lam truong bo phan',
        errorCode: ERROR_CODES.USER_NOT_FOUND,
      });
    }
  }
}
