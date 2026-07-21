import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PaginationQueryDto, PERMISSIONS } from '@app/common-dto';
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
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: TaskQueryDto) {
    return this.tasksService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.tasksService.findById(organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TASK_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(organizationId, actorId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(organizationId, id, dto);
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
  ) {
    return this.tasksService.updateStatus(organizationId, id, actorId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TASK_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.tasksService.remove(organizationId, actorId, id);
  }

  /** Lich su doi trang thai cua Task - Wireframe.md muc 4.2 (modal chi tiet Task). */
  @Get(':id/status-history')
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  findStatusHistory(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tasksService.findStatusHistory(organizationId, id, query);
  }

  @Post(':id/assignees')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  assign(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasksService.assign(organizationId, id, actorId, dto.userId);
  }

  @Delete(':id/assignees/:userId')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  unassign(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.tasksService.unassign(organizationId, id, userId);
  }

  /** Binh luan khong nam trong analytics pipeline nen khong yeu cau permission dac biet. */
  @Post(':id/comments')
  addComment(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') authorUserId: string,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasksService.addComment(organizationId, id, authorUserId, dto);
  }

  @Get(':id/comments')
  @RequirePermissions(PERMISSIONS.TASK_VIEW)
  findComments(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tasksService.findComments(organizationId, id, query);
  }
}
