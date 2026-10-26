import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, PaginationQueryDto, PERMISSIONS } from '@app/common-dto';
// 26/10/2026: pham vi xem cho cac thao tac GHI (xem TasksService.findVisibleTaskOrFail()).
import { toScopeCaller } from '../user-directory/user-directory';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { TaskQueryDto } from './dto/task-query.dto';

/** Quan ly cong viec / Kanban board - Technical_Spec.md muc 3.3, Wireframe.md muc 4. */
@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() query: TaskQueryDto,
    // 17/09/2026: can userId/permissions cua nguoi goi de TasksService.findAll() tu gioi han ket
    // qua cho Employee (khong co TASK_DELETE) - xem chu thich chi tiet tai findAll().
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    // 26/10/2026: phong ban cua nguoi goi (JWT) - Manager thay Task cua du an thuoc pham vi phong ban.
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.tasksService.findAll(organizationId, query, userId, permissions ?? [], departmentId ?? null);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    // 17/09/2026: cung ly do voi findAll() o tren - ap dung dung ranh gioi cho GET 1 Task, tranh
    // Employee vuot rao bang cach doan/nhan UUID Task khong thuoc pham vi cua ho.
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    // 26/10/2026: xem findAll() o tren.
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.tasksService.findById(organizationId, id, userId, permissions ?? [], departmentId ?? null);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TASK_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.tasksService.create(organizationId, actorId, dto, toScopeCaller(caller));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.tasksService.update(organizationId, id, dto, toScopeCaller(caller));
  }

  /**
   * Keo-tha giua cac cot Kanban (Wireframe.md muc 4.2) - endpoint quan trong nhat de
   * minh hoa toan bo pipeline: HTTP -> Outbox (cung transaction) -> OutboxPublisherJob -> Kafka.
   */
  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  updateStatus(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.tasksService.updateStatus(organizationId, id, actorId, dto, toScopeCaller(caller));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TASK_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.tasksService.remove(organizationId, actorId, id, toScopeCaller(caller));
  }

  /** Lich su doi trang thai cua Task - Wireframe.md muc 4.2 (modal chi tiet Task). */
  @Get(':id/status-history')
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  findStatusHistory(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    // 26/10/2026: chi doc lich su cua Task nam trong pham vi xem cua nguoi goi.
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.tasksService.findStatusHistory(organizationId, id, query, { userId, permissions: permissions ?? [], departmentId: departmentId ?? null });
  }

  @Post(':id/assignees')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  assign(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.tasksService.assign(organizationId, id, actorId, dto.userId, toScopeCaller(caller));
  }

  @Delete(':id/assignees/:userId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  unassign(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.tasksService.unassign(organizationId, id, userId, toScopeCaller(caller));
  }

  /** Binh luan khong nam trong analytics pipeline nen khong yeu cau permission dac biet. */
  @Post(':id/comments')
  addComment(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') authorUserId: string,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() caller: AuthContext,
  ) {
    return this.tasksService.addComment(organizationId, id, authorUserId, dto, toScopeCaller(caller));
  }

  @Get(':id/comments')
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  findComments(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    // 26/10/2026: chi doc binh luan cua Task nam trong pham vi xem cua nguoi goi.
    @CurrentUser('userId') userId: string,
    @CurrentUser('permissions') permissions: string[],
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.tasksService.findComments(organizationId, id, query, { userId, permissions: permissions ?? [], departmentId: departmentId ?? null });
  }
}
