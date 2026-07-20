import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

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
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENT_MANAGE)
  remove(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.departmentsService.remove(organizationId, id);
  }
}
