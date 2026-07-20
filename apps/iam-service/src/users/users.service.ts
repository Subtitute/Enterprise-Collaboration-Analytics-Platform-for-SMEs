import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { OutboxService } from '../outbox/outbox.service';
import {
  EVENT_TYPES,
  PaginatedResponse,
  PaginationQueryDto,
  UserDeactivatedPayload,
  UserRegisteredPayload,
  paginate,
} from '@app/common-dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  departmentId: string | null;
  isActive: boolean;
  roles: { id: string; name: string }[];
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    private readonly outboxService: OutboxService,
  ) {}

  async findAll(
    organizationId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<PublicUser>> {
    const [data, total] = await this.userRepo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data.map((u) => this.toPublicUser(u)), total, query.page, query.limit);
  }

  async findById(organizationId: string, id: string): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return this.toPublicUser(user);
  }

  async invite(organizationId: string, dto: InviteUserDto): Promise<PublicUser> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email da duoc su dung');

    const saved = await this.dataSource.transaction(async (manager) => {
      const roles = dto.roleIds?.length
        ? await manager.find(Role, { where: { id: In(dto.roleIds), organizationId } })
        : [];
      const passwordHash = await bcrypt.hash(dto.initialPassword, 10);

      const user = await manager.save(
        manager.create(User, {
          organizationId,
          email: dto.email,
          fullName: dto.fullName,
          departmentId: dto.departmentId ?? null,
          passwordHash,
          roles,
          isActive: true,
        }),
      );

      const payload: UserRegisteredPayload = {
        userId: user.id,
        email: user.email,
        departmentId: user.departmentId ?? null,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.USER_REGISTERED,
        organizationId,
        producer: 'iam-service',
        payload: payload as unknown as Record<string, unknown>,
      });

      return user;
    });

    return this.toPublicUser(saved);
  }

  async update(organizationId: string, id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.departmentId !== undefined) user.departmentId = dto.departmentId;
    if (dto.roleIds) {
      user.roles = await this.roleRepo.find({ where: { id: In(dto.roleIds), organizationId } });
    }
    const saved = await this.userRepo.save(user);
    return this.toPublicUser(saved);
  }

  async deactivate(organizationId: string, id: string, actorId: string): Promise<PublicUser> {
    const existing = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Khong tim thay nguoi dung');

    const saved = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneOrFail(User, { where: { id, organizationId } });
      user.isActive = false;
      const updated = await manager.save(user);

      const payload: UserDeactivatedPayload = { userId: updated.id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.USER_DEACTIVATED,
        organizationId,
        producer: 'iam-service',
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });

    return this.toPublicUser(saved);
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      departmentId: user.departmentId ?? null,
      isActive: user.isActive,
      roles: (user.roles ?? []).map((r) => ({ id: r.id, name: r.name })),
      createdAt: user.createdAt,
    };
  }
}
