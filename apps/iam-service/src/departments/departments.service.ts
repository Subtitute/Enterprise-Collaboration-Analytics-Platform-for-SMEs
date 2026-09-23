import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DepartmentManagerChangedPayload, ERROR_CODES, EVENT_TYPES } from '@app/common-dto';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import { OutboxService } from '../outbox/outbox.service';
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
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
  ) {}

  findAll(organizationId: string): Promise<Department[]> {
    return this.departmentRepo.find({ where: { organizationId }, order: { name: 'ASC' } });
  }

  // 23/09/2026: boc trong transaction + phat outbox event DEPARTMENT_MANAGER_CHANGED khi tao phong
  // ban co san managerId - can thiet de Notification Service/Analytics Service biet AI dang phu
  // trach phong ban nao (xem chu thich EVENT_TYPES.DEPARTMENT_MANAGER_CHANGED), phuc vu pham vi
  // hien thi thong bao "Manager chi thay thong bao cua phong ban minh phu trach".
  async create(organizationId: string, dto: CreateDepartmentDto, actorId: string): Promise<Department> {
    if (dto.managerId) await this.assertManagerInOrg(organizationId, dto.managerId);
    return this.dataSource.transaction(async (manager) => {
      const department = await manager.save(
        manager.create(Department, {
          organizationId,
          name: dto.name,
          managerId: dto.managerId ?? null,
        }),
      );
      if (dto.managerId) {
        const payload: DepartmentManagerChangedPayload = { departmentId: department.id, managerId: department.managerId ?? null, actorId };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.DEPARTMENT_MANAGER_CHANGED,
          organizationId,
          producer: 'iam-service',
          payload: payload as unknown as Record<string, unknown>,
        });
      }
      return department;
    });
  }

  async update(organizationId: string, id: string, dto: UpdateDepartmentDto, actorId: string): Promise<Department> {
    const existing = await this.departmentRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay phong ban', errorCode: ERROR_CODES.DEPARTMENT_NOT_FOUND });
    // 17/09/2026: xac thuc managerId thuoc DUNG to chuc truoc khi gan - cung 1 ly do voi
    // departmentId trong UsersService.update() (xem chu thich tai do): managerId chi la 1 UUID bat
    // ky do client gui len, neu khong kiem tra thi 1 Org Admin cua to chuc A co the truyen id
    // nguoi dung thuoc to chuc B va vo tinh/co y gan sai nguoi phu trach xuyen to chuc.
    if (dto.managerId) await this.assertManagerInOrg(organizationId, dto.managerId);
    const managerIdInRequest = dto.managerId !== undefined;

    return this.dataSource.transaction(async (manager) => {
      const department = await manager.findOneOrFail(Department, { where: { id, organizationId } });
      // 25/08/2026: fix ra soat bao mat (khong phai lo hong dang khai thac - class-transformer
      // 0.5.1 + ValidationPipe({whitelist:true}) da chan __proto__/constructor truoc khi toi day)
      // - doi Object.assign(department, dto) sang gan tung field ro rang, bo han su phu thuoc vao
      // whitelist cua thu vien de chan mass-assignment, phong khi DTO nay mo rong them field.
      if (dto.name !== undefined) department.name = dto.name;
      if (managerIdInRequest) department.managerId = dto.managerId ?? null;

      const updated = await manager.save(department);

      // 23/09/2026: chi phat event khi request THAT SU dong truong managerId (ke ca truong hop go
      // ve null) - mirror dung pattern departmentIdInRequest trong UsersService.update().
      if (managerIdInRequest) {
        const payload: DepartmentManagerChangedPayload = { departmentId: updated.id, managerId: updated.managerId ?? null, actorId };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.DEPARTMENT_MANAGER_CHANGED,
          organizationId,
          producer: 'iam-service',
          payload: payload as unknown as Record<string, unknown>,
        });
      }

      return updated;
    });
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
