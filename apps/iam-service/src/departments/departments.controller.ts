import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
// 25/07/2026: pipe dung chung validate :id la UUID hop le truoc khi cham toi DB - xem chu thich
// chi tiet trong common/uuid-param.pipe.ts (loi MINOR, review 25/07/2026).
import { uuidParamPipe } from '../common/uuid-param.pipe';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  // 22/07/2026: CO CHU DICH KHONG gan @RequirePermissions(DEPARTMENT_MANAGE) o day (khac voi
  // create/update/remove ben duoi). Da kiem tra frontend (grep apps/web/src/features/**): trang
  // Ho so ca nhan (apps/web/src/features/profile/ProfilePage.tsx, moi thanh vien da xac thuc deu
  // xem duoc - xem Technical_Spec.md muc changelog "Trang Ho so ca nhan") goi GET /departments
  // (qua useDepartmentsQuery() dung chung o apps/web/src/features/admin/hooks.ts) chi de doi
  // departmentId -> ten phong ban hien thi. Neu gan DEPARTMENT_MANAGE, moi nhan vien thuong (role
  // Employee, khong co quyen quan tri phong ban) se bi 403 ngay khi mo trang Ho so ca nhan cua
  // chinh minh. Du lieu tra ve chi la {id, name} - metadata to chuc it nhay cam, khong phai danh
  // sach nhan su hay thong tin quan tri - nen de mo cho moi nguoi dung da xac thuc trong to chuc
  // thay vi gan sai guard chi-quan-tri roi lam vo hieu 1 tinh nang khac (loi MAJOR, review
  // 22/07/2026, nhung fix la "khong doi" co chu dich sau khi xac minh, khong phai bo sot).
  @Get()
  findAll(@CurrentUser('organizationId') organizationId: string) {
    return this.departmentsService.findAll(organizationId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  create(@CurrentUser('organizationId') organizationId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', uuidParamPipe()) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', uuidParamPipe()) id: string,
  ) {
    return this.departmentsService.remove(organizationId, id);
  }
}
