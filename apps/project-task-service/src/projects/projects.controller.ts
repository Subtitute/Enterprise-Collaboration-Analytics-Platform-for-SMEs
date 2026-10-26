import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, PERMISSIONS } from '@app/common-dto';
// 26/10/2026: pham vi xem cho cac thao tac GHI theo id (xem ProjectsService.assertCallerScope()).
import { toScopeCaller } from '../user-directory/user-directory';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';

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
    // 26/10/2026: phong ban cua nguoi goi (JWT) - Manager thay du an lien quan toi phong ban minh.
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.projectsService.findAll(organizationId, query, userId, permissions ?? [], departmentId ?? null);
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
    // 26/10/2026: xem findAll() o tren.
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.projectsService.findById(organizationId, id, userId, permissions ?? [], departmentId ?? null);
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
    // 26/10/2026: actor cho su kien PROJECT_LEAD_CHANGED (tai lieu theo pham vi du an).
    @CurrentUser('userId') actorId: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.projectsService.update(organizationId, id, dto, actorId, toScopeCaller(caller));
  }

  @Post(':id/complete')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  complete(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.projectsService.complete(organizationId, id, actorId, toScopeCaller(caller));
  }

  @Post(':id/reopen')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  reopen(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.projectsService.reopen(organizationId, id, actorId, toScopeCaller(caller));
  }

  /** 22/07/2026 (fix code review, loi MINOR - Fix 7): bo sung endpoint luu tru du an - truoc do
   *  ProjectStatus.ARCHIVED khong bao gio duoc gan boi bat ky endpoint nao (dead code). */
  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  archive(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.projectsService.archive(organizationId, id, actorId, toScopeCaller(caller));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PROJECT_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.projectsService.remove(organizationId, actorId, id, toScopeCaller(caller));
  }

  // 22/09/2026: thanh vien du an (ProjectMember) - thay the co che gia lap bang localStorage o
  // frontend. Mirror dung ranh gioi quyen cua nhung endpoint mutate/view khac cua chinh du an nay
  // (PROJECT_UPDATE cho them/xoa, PROJECT_VIEW cho xem danh sach).
  @Get(':id/members')
  @RequirePermissions(PERMISSIONS.PROJECT_VIEW)
  listMembers(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    // 26/10/2026: chi doc thanh vien cua du an nam trong pham vi xem cua nguoi goi.
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.projectsService.listMembers(organizationId, id, { userId, permissions: permissions ?? [], departmentId: departmentId ?? null });
  }

  @Post(':id/members')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  addMember(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.projectsService.addMember(organizationId, id, actorId, dto.userId, toScopeCaller(caller));
  }

  @Delete(':id/members/:userId')
  @RequirePermissions(PERMISSIONS.PROJECT_UPDATE)
  removeMember(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    // 26/10/2026: actor cho su kien PROJECT_MEMBER_REMOVED (tai lieu theo pham vi du an).
    @CurrentUser('userId') actorId: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.projectsService.removeMember(organizationId, id, userId, actorId, toScopeCaller(caller));
  }
}
