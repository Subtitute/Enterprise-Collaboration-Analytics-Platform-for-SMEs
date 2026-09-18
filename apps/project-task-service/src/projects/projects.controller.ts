import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';

/** Quan ly du an - Technical_Spec.md muc 3.3, Wireframe.md muc 4. */
@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROJECT_VIEW)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: ProjectQueryDto,
    // 17/09/2026: can userId/permissions cua nguoi goi de ProjectsService.findAll() tu gioi han
    // ket qua cho Employee (khong co PROJECT_CREATE) - xem chu thich chi tiet tai findAll().
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
  ) {
    return this.projectsService.findAll(organizationId, query, userId, permissions ?? []);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROJECT_VIEW)
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    // 17/09/2026: cung ly do voi findAll() o tren - ap dung dung ranh gioi cho GET 1 du an, tranh
    // Employee vuot rao bang cach doan/nhan UUID du an khong thuoc pham vi cua ho.
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
  ) {
    return this.projectsService.findById(organizationId, id, userId, permissions ?? []);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECT_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(organizationId, actorId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(organizationId, id, dto);
  }

  @Post(':id/complete')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  complete(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.complete(organizationId, id, actorId);
  }

  @Post(':id/reopen')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  reopen(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.reopen(organizationId, id, actorId);
  }

  /** 22/07/2026 (fix code review, loi MINOR - Fix 7): bo sung endpoint luu tru du an - truoc do
   *  ProjectStatus.ARCHIVED khong bao gio duoc gan boi bat ky endpoint nao (dead code). */
  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  archive(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.archive(organizationId, id, actorId);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROJECT_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.remove(organizationId, actorId, id);
  }
}
