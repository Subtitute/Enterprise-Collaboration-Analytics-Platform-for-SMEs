import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  ERROR_CODES,
  EVENT_TYPES,
  LeaveRequestApprovedPayload,
  LeaveRequestCreatedPayload,
  LeaveRequestRejectedPayload,
  LeaveRequestStatus,
  PaginatedResponse,
  paginate,
} from '@app/common-dto';
import { LeaveRequest } from '../entities/leave-request.entity';
import { OutboxService } from '../outbox/outbox.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from './dto/decide-leave-request.dto';
import { LeaveRequestQueryDto } from './dto/leave-request-query.dto';

const PRODUCER = 'hrm-service';

@Injectable()
export class LeaveRequestsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(LeaveRequest) private readonly leaveRequestRepo: Repository<LeaveRequest>,
    private readonly outboxService: OutboxService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateLeaveRequestDto): Promise<LeaveRequest> {
    if (new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException({ message: 'Ngày bắt đầu không được sau ngày kết thúc', errorCode: ERROR_CODES.LEAVE_DATE_RANGE_INVALID });
    }

    return this.dataSource.transaction(async (manager) => {
      const leaveRequest = await manager.save(
        manager.create(LeaveRequest, {
          organizationId,
          userId,
          startDate: dto.startDate,
          endDate: dto.endDate,
          reason: dto.reason,
          status: LeaveRequestStatus.PENDING,
        }),
      );

      const payload: LeaveRequestCreatedPayload = {
        leaveRequestId: leaveRequest.id,
        userId,
        startDate: dto.startDate,
        endDate: dto.endDate,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.LEAVE_REQUEST_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return leaveRequest;
    });
  }

  async findMine(organizationId: string, userId: string, query: LeaveRequestQueryDto): Promise<PaginatedResponse<LeaveRequest>> {
    const [data, total] = await this.leaveRequestRepo.findAndCount({
      where: { organizationId, userId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /** Danh sach nghi phep TOAN TO CHUC (Manager/Org Admin, PERMISSIONS.LEAVE_REQUEST_VIEW) - loc duoc theo userId/status. */
  async findAll(organizationId: string, query: LeaveRequestQueryDto): Promise<PaginatedResponse<LeaveRequest>> {
    const where: { organizationId: string; userId?: string; status?: LeaveRequestStatus } = { organizationId };
    if (query.userId) where.userId = query.userId;
    if (query.status) where.status = query.status;

    const [data, total] = await this.leaveRequestRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  async approve(organizationId: string, id: string, approverId: string, dto: DecideLeaveRequestDto): Promise<LeaveRequest> {
    return this.decide(organizationId, id, approverId, LeaveRequestStatus.APPROVED, dto, EVENT_TYPES.LEAVE_REQUEST_APPROVED);
  }

  async reject(organizationId: string, id: string, approverId: string, dto: DecideLeaveRequestDto): Promise<LeaveRequest> {
    return this.decide(organizationId, id, approverId, LeaveRequestStatus.REJECTED, dto, EVENT_TYPES.LEAVE_REQUEST_REJECTED);
  }

  /**
   * Duyet/tu choi 1 yeu cau nghi phep - mirror pattern khoa pessimistic_write + re-check cua
   * ProjectsService.complete()/archive() (apps/project-task-service) de tranh race condition khi
   * 2 Manager cung duyet 1 yeu cau dong thoi (vd 1 duyet, 1 tu choi cung luc).
   */
  private async decide(
    organizationId: string,
    id: string,
    approverId: string,
    toStatus: LeaveRequestStatus.APPROVED | LeaveRequestStatus.REJECTED,
    dto: DecideLeaveRequestDto,
    eventType: typeof EVENT_TYPES.LEAVE_REQUEST_APPROVED | typeof EVENT_TYPES.LEAVE_REQUEST_REJECTED,
  ): Promise<LeaveRequest> {
    const existing = await this.leaveRequestRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Không tìm thấy yêu cầu nghỉ phép', errorCode: ERROR_CODES.LEAVE_REQUEST_NOT_FOUND });
    if (existing.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException({
        message: 'Yêu cầu nghỉ phép này đã được xử lý trước đó',
        errorCode: ERROR_CODES.LEAVE_REQUEST_ALREADY_DECIDED,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const leaveRequest = await manager.findOne(LeaveRequest, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!leaveRequest) throw new NotFoundException({ message: 'Không tìm thấy yêu cầu nghỉ phép', errorCode: ERROR_CODES.LEAVE_REQUEST_NOT_FOUND });
      if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException({
        message: 'Yêu cầu nghỉ phép này đã được xử lý trước đó',
        errorCode: ERROR_CODES.LEAVE_REQUEST_ALREADY_DECIDED,
      });
      }

      leaveRequest.status = toStatus;
      leaveRequest.approverId = approverId;
      leaveRequest.decisionNote = dto.decisionNote ?? null;
      leaveRequest.decidedAt = new Date();
      const updated = await manager.save(leaveRequest);

      const payload: LeaveRequestApprovedPayload | LeaveRequestRejectedPayload = {
        leaveRequestId: updated.id,
        userId: updated.userId,
        actorId: approverId,
      };
      await this.outboxService.record(manager, {
        eventType,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });
  }
}
