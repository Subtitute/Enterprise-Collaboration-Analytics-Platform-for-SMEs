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
  ) {
    return this.projectsService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROJECT_VIEW)
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.projectsService.findById(organizationId, id);
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
