import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Department } from '../entities/department.entity';
import { OutboxService } from '../outbox/outbox.service';
import { RedisService } from '../redis/redis.service';
import { parseDurationMs } from '../auth/auth.service';
import { isPostgresUniqueViolation } from '../common/db-errors.util';
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
    // 22/07/2026: bo sung inject Department repo - can de xac thuc departmentId thuoc dung to
    // chuc cua nguoi goi truoc khi gan cho user (xem invite()/update() ben duoi), giong het cach
    // roleIds da duoc kiem tra qua roleRepo.find({ where: { id: In(...), organizationId } }).
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    private readonly outboxService: OutboxService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
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

    // 22/07/2026: xac thuc departmentId thuoc DUNG to chuc cua nguoi goi truoc khi gan cho user
    // moi - truoc day gan thang `dto.departmentId ?? null` khong kiem tra gi (khac voi roleIds
    // ngay ben duoi, von DA duoc loc dung cach qua `{ id: In(dto.roleIds), organizationId }`).
    // Vi departmentId chi la 1 UUID bat ky do client gui len, 1 Org Admin cua to chuc A co the
    // truyen id phong ban thuoc to chuc B va vo tinh/co y lien ket sai user cua to chuc A vao
    // phong ban to chuc B - ro ri quan he du lieu xuyen to chuc (loi MAJOR, review 22/07/2026).
    if (dto.departmentId) {
      const department = await this.departmentRepo.findOne({
        where: { id: dto.departmentId, organizationId },
      });
      if (!department) throw new NotFoundException('Khong tim thay phong ban');
    }

    // 22/07/2026: pre-check findOne() o tren khong nguyen tu voi insert ben duoi - boc them
    // try/catch de bat truong hop hiem gap 2 request moi thanh vien cung email gan nhu dong thoi
    // cung vuot qua pre-check roi 1 ben vi pham unique index `email` khi insert (Postgres error
    // code 23505) - xem chu thich isPostgresUniqueViolation trong db-errors.util.ts.
    try {
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
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictException('Email da duoc su dung');
      }
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.departmentId !== undefined) {
      // 22/07/2026: xac thuc departmentId thuoc dung to chuc truoc khi gan - cung 1 lo hong nhu
      // invite() o tren (xem chu thich chi tiet tai do). `null` (bo phong ban) khong can tra cuu.
      if (dto.departmentId !== null) {
        const department = await this.departmentRepo.findOne({
          where: { id: dto.departmentId, organizationId },
        });
        if (!department) throw new NotFoundException('Khong tim thay phong ban');
      }
      user.departmentId = dto.departmentId;
    }
    if (dto.roleIds) {
      user.roles = await this.roleRepo.find({ where: { id: In(dto.roleIds), organizationId } });
    }
    const saved = await this.userRepo.save(user);
    return this.toPublicUser(saved);
  }

  async deactivate(organizationId: string, id: string, actorId: string): Promise<PublicUser> {
    // 22/07/2026: chan tu vo hieu hoa chinh minh - truoc day khong co kiem tra nao, bat ky nguoi
    // dung nao co quyen user:manage (ke ca Org Admin DUY NHAT con lai cua to chuc) deu co the tu
    // bam "Vo hieu hoa" len chinh tai khoan dang dung de dang nhap, tu khoa minh khoi he thong ma
    // khong con ai kip dang nhap lai de kich hoat lai (last-admin lockout) - loi MAJOR, review
    // 22/07/2026. Chi kiem tra dung pham vi "tu vo hieu hoa chinh minh" (id === actorId) theo yeu
    // cau fix; CHUA dem so luong user:manage con active khac trong to chuc (vd admin A vo hieu
    // hoa admin B la nguoi co quyen quan tri cuoi cung khac van chua bi chan o day) - xem bao cao
    // cuoi cung ve gioi han da biet nay va endpoint reactivate() moi bo sung ben duoi.
    if (id === actorId) {
      throw new BadRequestException('Khong the tu vo hieu hoa chinh tai khoan cua minh');
    }

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

    // Thu hoi access token dang hieu luc cua tai khoan vua bi deactivate ngay lap tuc, thay vi
    // cho token het han tu nhien (toi da 15 phut) - Technical_Spec.md muc 6 (bo sung 21/07/2026).
    // TTL bang chinh thoi han access token de khoa blacklist tu dong het hieu luc cung luc.
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const ttlSeconds = Math.floor(parseDurationMs(accessExpiresIn) / 1000);
    await this.redisService.blacklistUser(saved.id, ttlSeconds);

    return this.toPublicUser(saved);
  }

  /**
   * 22/07/2026: endpoint kich hoat lai 1 tai khoan da bi deactivate() - truoc day KHONG ton tai
   * (deactivate la thao tac 1 chieu, ca nhan bi vo hieu hoa nham hoac can kich hoat lai deu phai
   * sua tay truc tiep tren DB). Khong phat outbox event: packages/common-dto EVENT_TYPES chua co
   * entry USER_REACTIVATED tuong ung, va them event type moi + cap nhat 3 service tieu thu
   * (Notification/Analytics/...) nam ngoai pham vi apps/iam-service/src/** cua fix nay - xem bao
   * cao cuoi cung.
   */
  async reactivate(organizationId: string, id: string): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');

    user.isActive = true;
    const saved = await this.userRepo.save(user);
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
