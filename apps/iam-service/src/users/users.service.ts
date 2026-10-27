import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Brackets, DataSource, EntityManager, In, LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Department } from '../entities/department.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { UserProfileChangeLog } from '../entities/user-profile-change-log.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { OutboxService } from '../outbox/outbox.service';
import { RedisService } from '../redis/redis.service';
import { MinioService } from '../minio/minio.service';
import { EmailService } from '../email/email.service';
import { parseDurationMs } from '../auth/auth.service';
import { isPostgresUniqueViolation } from '../common/db-errors.util';
import { probeImage, stripImageMetadata } from '../common/image-probe.util';
import {
  ERROR_CODES,
  EVENT_TYPES,
  JwtResetPayload,
  PaginatedResponse,
  PaginationQueryDto,
  PERMISSIONS,
  RoleLevel,
  UserDeactivatedPayload,
  UserDeletedPayload,
  UserDepartmentChangedPayload,
  UserProfileUpdatedPayload,
  UserReactivatedPayload,
  UserRegisteredPayload,
  UserRolesChangedPayload,
  DefaultRoleName,
  normalizeVietnamesePhone,
  paginate,
  // 26/10/2026: danh ba 3 cap (xem findAll()).
  resolveDataScope,
  resolveRoleLevel,
} from '@app/common-dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { DirectoryQueryDto } from './dto/directory-query.dto';
import { ChangeMyPasswordDto } from './dto/change-my-password.dto';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  departmentId: string | null;
  isActive: boolean;
  roles: { id: string; name: string }[];
  createdAt: Date;
  // 26/10/2026: presigned GET TTL ngan (bucket iam-avatars) - null = chua co avatar (client hien chu viet tat).
  avatarUrl: string | null;
}

/** 26/10/2026: "the danh ba" - ten/phong ban (+ email lien lac) cua nguoi ngoai pham vi xem ho so day du. */
export type DirectoryCard = Pick<PublicUser, 'id' | 'email' | 'fullName' | 'departmentId' | 'isActive' | 'avatarUrl'>;

/**
 * 26/10/2026: ho so DAY DU (Technical_Spec.md muc 27.6) - CHI tra qua GET /users/directory va GET
 * /users/:id trong pham vi; GET /users (danh ba) KHONG BAO GIO chua phoneNumber/employeeCode.
 */
export interface UserProfile extends PublicUser {
  phoneNumber: string | null;
  employeeCode: string | null;
  roleLevel: RoleLevel;
}

/** 26/10/2026: nguoi goi cac thao tac ho so/avatar (tu AuthContext). */
export interface ProfileCaller {
  userId: string;
  permissions: string[];
  departmentId: string | null;
  isSuperAdmin?: boolean;
}

// 26/10/2026: gioi han avatar (muc 27.10) - client cat vuong 512px JPEG truoc khi gui nen 2MB la du rong.
export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const MIN_AVATAR_DIMENSION_PX = 128;
const EMPLOYEE_CODE_RE = /^[A-Za-z0-9._-]{1,32}$/;
const EMPLOYEE_CODE_CONSTRAINT = 'uq_users_org_employee_code';

function isEmployeeCodeViolation(error: unknown): boolean {
  return isPostgresUniqueViolation(error) && (error as { constraint?: string }).constraint === EMPLOYEE_CODE_CONSTRAINT;
}

function roleLevelOf(user: Pick<User, 'roles'>): RoleLevel {
  return resolveRoleLevel((user.roles ?? []).map((r) => r.name));
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

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
    // 26/10/2026: avatar + email kich hoat (Technical_Spec.md muc 27) - de cuoi va optional de cac unit
    // test cu (khoi tao 7 tham so) van dung; Nest van inject day du theo kieu.
    private readonly minioService?: MinioService,
    private readonly emailService?: EmailService,
    private readonly jwtService?: JwtService,
  ) {}

  /**
   * 26/10/2026: danh ba 3 cap - truoc day MOI nguoi da xac thuc nhan ho so DAY DU (vai tro, ngay vao
   * lam...) cua toan to chuc. Nay: Org Admin (USER_MANAGE) - day du moi nguoi; Manager (USER_INVITE +
   * co phong ban) - day du chinh minh + thanh vien phong ban minh; con lai - day du chinh minh. Nguoi
   * ngoai pham vi chi con "the danh ba" (DirectoryCard) du de chon nguoi giao viec/chia se/nhan tin.
   * GIU `email` trong the danh ba: la dinh danh lien lac cong viec dang duoc moi picker (giao viec,
   * chia se tai lieu, nhan tin) dung de tim kiem/hien thi (nhieu noi goi thang u.email.toLowerCase()).
   * `caller` tuy chon (goi noi bo/test cu khong truyen = day du nhu truoc).
   */
  async findAll(
    organizationId: string,
    query: PaginationQueryDto,
    caller?: { userId: string; permissions: string[]; departmentId: string | null },
  ): Promise<PaginatedResponse<PublicUser | DirectoryCard>> {
    const [data, total] = await this.userRepo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const scope = caller ? resolveDataScope(caller.permissions, PERMISSIONS.USER_INVITE, caller.departmentId) : 'organization';
    const isFullProfile = (u: User) =>
      scope === 'organization' ||
      u.id === caller?.userId ||
      (scope === 'department' && (u.departmentId ?? null) === caller?.departmentId);
    return paginate(
      await Promise.all(data.map((u) => (isFullProfile(u) ? this.toPublicUser(u) : this.toDirectoryCard(u)))),
      total,
      query.page,
      query.limit,
    );
  }

  /** 26/10/2026: tra ho so DAY DU (UserProfile) - goi tu GET /users/:id khi la chinh chu/Org Admin. */
  async findById(organizationId: string, id: string): Promise<UserProfile> {
    return this.toUserProfile(await this.loadUserOrThrow(organizationId, id));
  }

  /**
   * 26/10/2026: Manager xem ho so day du cua thanh vien CUNG phong ban (GET /users/:id) - ngoai phong ban -> 403.
   * So dien thoai/ma nhan vien CHI kem theo khi muc tieu la Employee (muc 27.7) - Manager khac cung
   * phong van xem duoc ho so day du nhu truoc, nhung khong co 2 truong lien lac.
   */
  async findByIdInDepartment(organizationId: string, id: string, departmentId: string): Promise<PublicUser | UserProfile> {
    const user = await this.loadUserOrThrow(organizationId, id);
    if ((user.departmentId ?? null) !== departmentId) {
      throw new ForbiddenException({
        message: 'Ban chi xem duoc ho so day du cua thanh vien phong ban minh',
        errorCode: ERROR_CODES.DEPARTMENT_SCOPE_FORBIDDEN,
      });
    }
    return roleLevelOf(user) === 'EMPLOYEE' ? this.toUserProfile(user) : this.toPublicUser(user);
  }

  /**
   * 26/10/2026: Danh sach nhan vien (Technical_Spec.md muc 27.6, Wireframe muc 16.1) - Org Admin: ca
   * to chuc; Manager (user:invite + phong ban JWT): CHI Employee phong minh (khong Manager khac, khong
   * Org Admin, khong chinh minh); con lai (Employee, Manager chua co phong ban, Super Admin): 403.
   */
  async directory(organizationId: string, caller: ProfileCaller, query: DirectoryQueryDto): Promise<PaginatedResponse<UserProfile>> {
    const scope = caller.isSuperAdmin ? 'self' : resolveDataScope(caller.permissions, PERMISSIONS.USER_INVITE, caller.departmentId);
    if (scope === 'self') {
      throw new ForbiddenException({ message: 'Ban khong co quyen xem danh sach nhan vien', errorCode: ERROR_CODES.DIRECTORY_FORBIDDEN });
    }
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .where('u.organizationId = :organizationId', { organizationId })
      .andWhere('u.isSuperAdmin = false');
    if (scope === 'department') {
      qb.andWhere('u.departmentId = :callerDept', { callerDept: caller.departmentId })
        .andWhere('u.id <> :callerId', { callerId: caller.userId })
        .andWhere(
          `NOT EXISTS (SELECT 1 FROM user_roles ur INNER JOIN roles rr ON rr.id = ur.role_id
            WHERE ur.user_id = u.id AND lower(rr.name) IN ('org admin', 'manager'))`,
        );
    } else if (query.departmentId) {
      qb.andWhere('u.departmentId = :departmentId', { departmentId: query.departmentId });
    }
    if (query.status) qb.andWhere('u.isActive = :isActive', { isActive: query.status === 'ACTIVE' });
    const search = query.search?.trim();
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const digits = search.replace(/\D/g, '');
      qb.andWhere(
        new Brackets((w) => {
          w.where('u.fullName ILIKE :like', { like })
            .orWhere('u.email ILIKE :like', { like })
            .orWhere('u.employeeCode ILIKE :like', { like });
          if (digits.length >= 3) w.orWhere('u.phoneNumber LIKE :digits', { digits: `%${digits}%` });
        }),
      );
    }
    const [users, total] = await qb
      .orderBy('u.fullName', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginate(await Promise.all(users.map((u) => this.toUserProfile(u))), total, query.page, query.limit);
  }

  /** 26/10/2026: PATCH /users/me - chinh chu chi sua so dien thoai (muc 27.7). */
  async updateMyProfile(organizationId: string, userId: string, dto: UpdateMyProfileDto): Promise<UserProfile> {
    const user = await this.loadUserOrThrow(organizationId, userId);
    if (dto.phoneNumber !== undefined) {
      const phoneNumber = dto.phoneNumber ? this.normalizePhoneOrThrow(dto.phoneNumber) : null;
      if (phoneNumber !== (user.phoneNumber ?? null)) {
        await this.dataSource.transaction(async (manager) => {
          await manager.update(User, { id: userId, organizationId }, { phoneNumber });
          await this.recordProfileChange(manager, organizationId, userId, userId, ['phoneNumber']);
        });
        user.phoneNumber = phoneNumber;
      }
    }
    return this.toUserProfile(user);
  }

  /**
   * 26/10/2026: PATCH /users/me/password - kiem tra mat khau hien tai, mat khau moi khac mat khau cu,
   * roi thu hoi MOI refresh token cua user (moi phien dang nhap, ke ca phien hien tai, phai dang nhap
   * lai - web tu dang xuat sau khi doi thanh cong). Mirror AuthService.resetPassword().
   */
  async changeMyPassword(organizationId: string, userId: string, dto: ChangeMyPasswordDto): Promise<{ success: true }> {
    const user = await this.loadUserOrThrow(organizationId, userId);
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException({ message: 'Mat khau hien tai khong dung', errorCode: ERROR_CODES.CURRENT_PASSWORD_INVALID });
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({ message: 'Mat khau moi phai khac mat khau hien tai', errorCode: ERROR_CODES.NEW_PASSWORD_SAME_AS_CURRENT });
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, { id: userId, organizationId }, { passwordHash });
      await manager.delete(RefreshToken, { userId });
    });
    return { success: true };
  }

  /**
   * 26/10/2026: PUT /users/:id/avatar (:id = uuid hoac 'me') - chinh chu / Org Admin / Manager voi
   * Employee phong minh. Kiem tra magic bytes JPEG/PNG/WebP, <= 2MB, >= 128px; KHONG kiem tra khuon
   * mat (avatar khong bao gio vao pipeline nhan dien - Q2). Ghi object moi -> cap nhat DB -> xoa object cu.
   */
  async setAvatar(
    organizationId: string,
    caller: ProfileCaller,
    targetId: string,
    file: { buffer?: Buffer; size?: number } | undefined,
  ): Promise<UserProfile> {
    const target = await this.loadUserOrThrow(organizationId, targetId);
    this.assertProfileWriteScope(caller, target);
    const buffer = file?.buffer;
    const probe = buffer && buffer.length <= MAX_AVATAR_SIZE_BYTES ? probeImage(buffer) : null;
    if (!buffer || !probe || probe.width < MIN_AVATAR_DIMENSION_PX || probe.height < MIN_AVATAR_DIMENSION_PX) {
      throw new BadRequestException({
        message: 'Anh dai dien phai la JPEG/PNG/WebP, toi da 2MB, toi thieu 128px',
        errorCode: ERROR_CODES.AVATAR_INVALID,
      });
    }
    // 26/10/2026: bo Exif/GPS/XMP... o server truoc khi luu (khong tin anh da qua canvas cua web).
    const sanitized = stripImageMetadata(buffer, probe.mimeType);
    if (!sanitized) {
      throw new BadRequestException({ message: 'Anh dai dien bi hong', errorCode: ERROR_CODES.AVATAR_INVALID });
    }
    const minio = this.requireMinio();
    const key = `${organizationId}/${target.id}/${uuidv4()}.${probe.extension}`;
    await minio.putObject(key, sanitized, probe.mimeType);
    const updatedAt = new Date();
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(User, { id: target.id, organizationId }, { avatarObjectKey: key, avatarUpdatedAt: updatedAt });
        await this.recordProfileChange(manager, organizationId, target.id, caller.userId, ['avatar']);
      });
    } catch (err) {
      await minio.removeObjectQuietly(key);
      throw err;
    }
    await minio.removeObjectQuietly(target.avatarObjectKey);
    target.avatarObjectKey = key;
    target.avatarUpdatedAt = updatedAt;
    return this.toUserProfile(target);
  }

  async removeAvatar(organizationId: string, caller: ProfileCaller, targetId: string): Promise<UserProfile> {
    const target = await this.loadUserOrThrow(organizationId, targetId);
    this.assertProfileWriteScope(caller, target);
    const oldKey = target.avatarObjectKey;
    if (oldKey) {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(User, { id: target.id, organizationId }, { avatarObjectKey: null, avatarUpdatedAt: new Date() });
        await this.recordProfileChange(manager, organizationId, target.id, caller.userId, ['avatar']);
      });
      await this.requireMinio().removeObjectQuietly(oldKey);
      target.avatarObjectKey = null;
    }
    return this.toUserProfile(target);
  }

  /** 26/10/2026: nhat ky sua ho so giu 1 nam (Technical_Spec.md muc 27.4/27.11). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneProfileChangeLogs(): Promise<void> {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    try {
      await this.dataSource.getRepository(UserProfileChangeLog).delete({ createdAt: LessThan(oneYearAgo) });
    } catch (err) {
      this.logger.warn(`Don nhat ky sua ho so that bai: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async invite(
    organizationId: string,
    dto: InviteUserDto,
    callerPermissions: string[],
    // 26/10/2026: phong ban cua nguoi goi (JWT) - Manager moi thi phong ban bi ep ve phong minh.
    callerDepartmentId: string | null = null,
  ): Promise<PublicUser> {
    // 25/08/2026: fix ra soat bao mat - chuan hoa email (trim + chu thuong) TRUOC kiem tra trung,
    // cung ly do voi AuthService.registerOrganization() (xem comment tai do) - tranh tao duoc 2
    // tai khoan nhin-giong-het nhau chi khac hoa/thuong (vd "Bob@Corp.vn" vs "bob@corp.vn").
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      // 26/10/2026: email thuoc to chuc KHAC -> thong bao chung, khong lo "da co o to chuc khac" (muc 27.9).
      if (existing.organizationId !== organizationId) {
        throw new ConflictException({ message: 'Khong the dung email nay', errorCode: ERROR_CODES.EMAIL_UNAVAILABLE });
      }
      throw new ConflictException({ message: 'Email da duoc su dung', errorCode: ERROR_CODES.EMAIL_ALREADY_USED });
    }
    const canManageUsers = callerPermissions.includes(PERMISSIONS.USER_MANAGE);
    // 26/10/2026: so dien thoai/ma nhan vien chi Org Admin duoc dat (muc 27.7) - chan ro rang nhu roleIds.
    if ((dto.phoneNumber || dto.employeeCode) && !canManageUsers) {
      throw new ForbiddenException({
        message: 'Ban khong co quyen dat so dien thoai/ma nhan vien (can quyen user:manage)',
        errorCode: ERROR_CODES.FORBIDDEN_PROFILE_FIELDS,
      });
    }
    const phoneNumber = dto.phoneNumber ? this.normalizePhoneOrThrow(dto.phoneNumber) : null;
    const employeeCode = dto.employeeCode ? this.normalizeEmployeeCodeOrThrow(dto.employeeCode) : null;
    if (employeeCode) await this.assertEmployeeCodeFree(organizationId, employeeCode, null);
    // 26/10/2026: Manager moi -> phong ban ep ve phong cua chinh Manager (giu hanh vi muc 19.1 o server).
    const departmentId = !canManageUsers && callerDepartmentId ? callerDepartmentId : dto.departmentId;

    // 25/07/2026: RBAC bypass CRITICAL (review 25/07/2026) - truoc day dto.roleIds duoc gan THANG
    // cho user moi ma KHONG kiem tra nguoi goi co duoc phep cap NHUNG vai tro do hay khong.
    // Endpoint POST /users/invite chi doi hoi quyen user:invite (Manager mac dinh CO quyen nay -
    // xem DEFAULT_ROLE_PERMISSIONS trong packages/common-dto), trong khi user:manage (quyen thuc
    // su dai dien cho "duoc quan tri vai tro/nguoi dung", dung de gate PATCH /users/:id ngay ben
    // duoi) chi Org Admin moi co. Kich ban khai thac: 1 Manager goi GET /users (co chu dich khong
    // co guard - xem chu thich users.controller.ts) de doc roles:[{id,name}] cua 1 Org Admin co
    // san, roi goi POST /users/invite voi chinh roleId do trong body -> tu tao 1 tai khoan Org
    // Admin moi hoan toan hop le ve mat DB, tu leo thang tu Manager len Admin toan quyen. Chan
    // ngay tai day: neu client GUI kem roleIds (khac rong), nguoi goi BAT BUOC phai co quyen
    // user:manage, neu khong tu choi 403 ro rang thay vi am tham bo qua/gan rong (de loi nay bi
    // phat hien ngay trong test thay vi "thanh cong" sai lech voi y dinh cua client). Da kiem tra
    // frontend (InviteMemberModal.tsx): danh sach vai tro de tick chi tai duoc qua GET /roles, ban
    // than endpoint do da doi hoi role:manage (chi Org Admin) nen 1 Manager dung UI that KHONG BAO
    // GIO gui duoc roleIds khac rong - 403 o day chi chan duong client tu tao request thu cong.
    if (dto.roleIds?.length && !callerPermissions.includes(PERMISSIONS.USER_MANAGE)) {
      throw new ForbiddenException({
        message: 'Ban khong co quyen gan vai tro khi moi thanh vien moi (can quyen user:manage)',
        errorCode: ERROR_CODES.FORBIDDEN_ASSIGN_ROLE,
      });
    }

    // 22/07/2026: xac thuc departmentId thuoc DUNG to chuc cua nguoi goi truoc khi gan cho user
    // moi - truoc day gan thang `dto.departmentId ?? null` khong kiem tra gi (khac voi roleIds
    // ngay ben duoi, von DA duoc loc dung cach qua `{ id: In(dto.roleIds), organizationId }`).
    // Vi departmentId chi la 1 UUID bat ky do client gui len, 1 Org Admin cua to chuc A co the
    // truyen id phong ban thuoc to chuc B va vo tinh/co y lien ket sai user cua to chuc A vao
    // phong ban to chuc B - ro ri quan he du lieu xuyen to chuc (loi MAJOR, review 22/07/2026).
    if (departmentId) {
      const department = await this.departmentRepo.findOne({
        where: { id: departmentId, organizationId },
      });
      if (!department) throw new NotFoundException({ message: 'Khong tim thay phong ban', errorCode: ERROR_CODES.DEPARTMENT_NOT_FOUND });
    }

    // 26/10/2026: bo mat khau mac dinh dung chung (Q7) - khong gui mat khau -> mat khau ngau nhien 32
    // byte (khong hien thi/luu o dau) + token INVITE 72 gio gui qua email kich hoat.
    const sendActivation = !dto.initialPassword;
    const password = dto.initialPassword ?? randomBytes(32).toString('base64url');
    const inviteExpiresIn = this.configService.get<string>('inviteTokenExpiresIn') ?? '72h';

    // 22/07/2026: pre-check findOne() o tren khong nguyen tu voi insert ben duoi - boc them
    // try/catch de bat truong hop hiem gap 2 request moi thanh vien cung email gan nhu dong thoi
    // cung vuot qua pre-check roi 1 ben vi pham unique index `email` khi insert (Postgres error
    // code 23505) - xem chu thich isPostgresUniqueViolation trong db-errors.util.ts.
    try {
      const { user: saved, inviteTokenId } = await this.dataSource.transaction(async (manager) => {
        let roles = dto.roleIds?.length
          ? await manager.find(Role, { where: { id: In(dto.roleIds), organizationId } })
          : [];
        // 26/10/2026: KHONG BAO GIO tao tai khoan 0 vai tro - truoc day Manager moi (khong duoc gan vai
        // tro) tao ra user 0 quyen: khong cham cong, khong xac nhan duoc anh nhan dien. Khong gui/khong
        // khop vai tro nao -> vai tro mac dinh "Employee" cua to chuc.
        if (!roles?.length) {
          roles = (await manager.find(Role, { where: { organizationId, name: DefaultRoleName.EMPLOYEE } })) ?? [];
        }
        const passwordHash = await bcrypt.hash(password, 10);

        const user = await manager.save(
          manager.create(User, {
            organizationId,
            email: normalizedEmail,
            fullName: dto.fullName,
            departmentId: departmentId ?? null,
            passwordHash,
            roles,
            isActive: true,
            phoneNumber,
            employeeCode,
          }),
        );

        const payload: UserRegisteredPayload = {
          userId: user.id,
          email: user.email,
          departmentId: user.departmentId ?? null,
          actorId: user.id,
          // 26/10/2026: ml-service can muc vai tro ngay tu dau (pham vi Manager chi Employee).
          roleLevel: resolveRoleLevel(roles.map((r) => r.name)),
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.USER_REGISTERED,
          organizationId,
          producer: 'iam-service',
          payload: payload as unknown as Record<string, unknown>,
        });

        let tokenId: string | null = null;
        if (sendActivation) {
          const token = await manager.save(
            manager.create(PasswordResetToken, {
              userId: user.id,
              purpose: 'INVITE',
              expiresAt: new Date(Date.now() + parseDurationMs(inviteExpiresIn)),
            }),
          );
          tokenId = token.id;
        }
        return { user, inviteTokenId: tokenId };
      });

      if (inviteTokenId) await this.sendActivationEmail(saved, inviteTokenId, inviteExpiresIn);
      return this.toPublicUser(saved);
    } catch (error) {
      if (isEmployeeCodeViolation(error)) {
        throw new ConflictException({ message: 'Ma nhan vien da duoc dung', errorCode: ERROR_CODES.EMPLOYEE_CODE_TAKEN });
      }
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictException({ message: 'Email da duoc su dung', errorCode: ERROR_CODES.EMAIL_ALREADY_USED });
      }
      throw error;
    }
  }

  /** 26/10/2026: email kich hoat (tai su dung trang /reset-password + AuthService.resetPassword()). */
  private async sendActivationEmail(user: User, tokenId: string, expiresIn: string): Promise<void> {
    if (!this.jwtService || !this.emailService) return;
    try {
      const payload: JwtResetPayload = { sub: user.id, tokenId };
      const token = await this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.resetSecret'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expiresIn: expiresIn as any,
      });
      const link = `${this.configService.get<string>('frontendUrl')}/reset-password?token=${token}`;
      await this.emailService.sendInviteEmail(user.email, user.fullName, link);
    } catch (err) {
      // Tai khoan da tao thanh cong - loi gui email khong duoc lam that bai request moi thanh vien.
      this.logger.error(`Khong gui duoc email kich hoat cho ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateUserDto,
    callerPermissions: string[],
    actorId: string,
  ): Promise<UserProfile> {
    // 26/08/2026: fix loi MAJOR (race condition ghi de dong thoi) - pre-check bang findOne() o day
    // chi de fail-fast (tra 404 nhanh cho id chua tung ton tai/sai to chuc), KHONG con duoc dung de
    // mutate/save nua (xem giai thich chi tiet o transaction ben duoi).
    const existing = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });

    // 25/07/2026: cung 1 lo hong RBAC nhu invite() o tren, ap dung cho "canh cua" thu 2 - PATCH
    // /users/:id doi vai tro cua 1 tai khoan DA TON TAI. Controller hien tai da gate ca endpoint
    // bang @RequirePermissions(USER_MANAGE) nen o tang HTTP khong ai thieu quyen goi toi day duoc,
    // NHUNG kiem tra lai o tang service (thay vi chi tin tuong 1 minh guard tren controller) la
    // phong thu chieu sau bat buoc: service co the duoc goi truc tiep tu noi khac trong tuong lai
    // (vd 1 job noi bo, 1 endpoint moi tai su dung lai update()) ma quen ap lai dung guard, luc do
    // day se la lop chan cuoi cung ngan chan leo thang quyen qua roleIds - xem chu thich invite().
    if (dto.roleIds && !callerPermissions.includes(PERMISSIONS.USER_MANAGE)) {
      throw new ForbiddenException({
        message: 'Ban khong co quyen thay doi vai tro cua nguoi dung (can quyen user:manage)',
        errorCode: ERROR_CODES.FORBIDDEN_CHANGE_ROLE,
      });
    }

    // 28/07/2026: ghi nho TRUOC khi gan vao `user` xem request nay co thuc su dong truong
    // departmentId hay khong (`dto.departmentId !== undefined`) - dung de quyet dinh co phat outbox
    // event USER_DEPARTMENT_CHANGED o cuoi ham hay khong (xem transaction ben duoi). Phai chup lai
    // thanh bien rieng ngay tai day: sau khoi if() ke tiep, `user.departmentId` co the da bi doi
    // (hoac giu nguyen neu request khong dong truong nay) - khong the phan biet nguoc lai truong
    // hop "request gui departmentId=null" (CAN phat event, gia tri moi la null) voi truong hop
    // "request khong dong truong departmentId" (KHONG phat event) chi bang cach doc lai
    // `user.departmentId` sau do.
    const departmentIdInRequest = dto.departmentId !== undefined;
    if (departmentIdInRequest && dto.departmentId !== null) {
      // 22/07/2026: xac thuc departmentId thuoc dung to chuc truoc khi gan - cung 1 lo hong nhu
      // invite() o tren (xem chu thich chi tiet tai do). `null` (bo phong ban) khong can tra cuu.
      const department = await this.departmentRepo.findOne({
        where: { id: dto.departmentId, organizationId },
      });
      if (!department) throw new NotFoundException({ message: 'Khong tim thay phong ban', errorCode: ERROR_CODES.DEPARTMENT_NOT_FOUND });
    }
    // 26/08/2026: tra cuu roles moi (neu co) truoc khi vao transaction - giong departmentId o tren,
    // day la tra cuu Role/Department theo organizationId, KHONG phu thuoc vao trang thai cua chinh
    // ban ghi User dang sua nen khong can nam trong pham vi khoa ben duoi.
    const newRoles = dto.roleIds
      ? await this.roleRepo.find({ where: { id: In(dto.roleIds), organizationId } })
      : undefined;
    // 26/10/2026: so dien thoai/ma nhan vien (muc 27.6) - chuoi rong/null = xoa; chuan hoa truoc transaction.
    const phoneNumber =
      dto.phoneNumber === undefined ? undefined : dto.phoneNumber ? this.normalizePhoneOrThrow(dto.phoneNumber) : null;
    const employeeCode =
      dto.employeeCode === undefined ? undefined : dto.employeeCode ? this.normalizeEmployeeCodeOrThrow(dto.employeeCode) : null;
    if (employeeCode) await this.assertEmployeeCodeFree(organizationId, employeeCode, id);

    // 26/08/2026: fix loi MAJOR (race condition, phat hien qua ra soat) - ban truoc day doc `user`
    // bang findOne() KHONG KHOA o dau ham, sua truc tiep len object do, roi save() no BEN NGOAI
    // transaction. 2 request PATCH dong thoi cho CUNG 1 user (vd request A doi roleIds, request B
    // doi departmentId) co the cung doc trung 1 snapshot cu truoc khi ben nao commit - moi request
    // chi sua field minh quan tam tren snapshot RIENG cua no, nhung `manager.save()` cua TypeORM ghi
    // de TOAN BO trang thai in-memory cua entity (bao gom ca quan he `roles` eager-load), KHONG chi
    // ghi field da doi. Request commit SAU se am tham "xoa" thay doi cua request commit TRUOC ma
    // khong loi gi ca (lost update). Sua dung EXACT pattern pessimistic_write da dung o
    // TasksService.updateStatus()/remove() (xem apps/project-task-service/src/tasks/tasks.service.ts):
    // doc LAI ban ghi BEN TRONG transaction voi khoa ghi (pessimistic_write) - buoc request B phai
    // doi request A commit va nha khoa truoc khi doc, dam bao B luon apply thay doi cua no LEN TREN
    // trang thai MOI NHAT (da bao gom thay doi cua A) thay vi de len snapshot cu.
    const saved = await this.runUpdateTransaction(async (manager) => {
      const changedFields: string[] = [];
      // 16/09/2026: fix loi that (phat hien khi goi PATCH /users/:id that qua API) - `User.roles`
      // la quan he eager:true (xem entities/user.entity.ts), TypeORM tu dong LEFT JOIN sang bang
      // trung gian `user_roles`/`roles` cho MOI truy van tren User, ke ca truy van nay. Ket hop
      // voi `lock: { mode: 'pessimistic_write' }` (FOR UPDATE) sinh loi Postgres "FOR UPDATE
      // cannot be applied to the nullable side of an outer join" - Postgres tu choi khoa 1 hang co
      // the la NULL o phia LEFT JOIN, xay ra VOI MOI user (khong phu thuoc user do co bao nhieu
      // vai tro). `loadEagerRelations: false` tat eager-load CHI cho truy van nay - an toan vi
      // logic ben duoi khong bao gio DOC `user.roles` cu (chi GHI DE toan bo bang `newRoles` khi
      // dto.roleIds duoc gui, xem tra cuu newRoles truoc transaction o tren); khi khong doi vai
      // tro, `user.roles` khong duoc gan gi ca nen manager.save() khong dung toi bang trung gian.
      const user = await manager.findOneOrFail(User, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });

      if (dto.fullName !== undefined && dto.fullName !== user.fullName) {
        user.fullName = dto.fullName;
        changedFields.push('fullName');
      }
      if (departmentIdInRequest) user.departmentId = dto.departmentId ?? null;
      if (newRoles) user.roles = newRoles;
      if (phoneNumber !== undefined && phoneNumber !== (user.phoneNumber ?? null)) {
        user.phoneNumber = phoneNumber;
        changedFields.push('phoneNumber');
      }
      if (employeeCode !== undefined && employeeCode !== (user.employeeCode ?? null)) {
        user.employeeCode = employeeCode;
        changedFields.push('employeeCode');
      }

      const updated = await manager.save(user);
      // 26/10/2026: nhat ky + su kien sua ho so (chi ten truong) va doi muc vai tro (ml-service).
      if (changedFields.length) await this.recordProfileChange(manager, organizationId, id, actorId, changedFields);
      if (newRoles) {
        const rolesPayload: UserRolesChangedPayload = { userId: id, roleLevel: resolveRoleLevel(newRoles.map((r) => r.name)), actorId };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.USER_ROLES_CHANGED,
          organizationId,
          producer: 'iam-service',
          payload: rolesPayload as unknown as Record<string, unknown>,
        });
      }
      // 28/07/2026: boc save() vao 1 transaction va phat outbox event USER_DEPARTMENT_CHANGED CUNG
      // luc khi request co thay doi departmentId (ke ca truong hop go phong ban ve null) - truoc day
      // update() chi goi thang `this.userRepo.save(user)` NGOAI transaction, khong co event nao bao
      // cho Analytics Service biet phong ban cua user vua doi de gop KPI theo phong ban (tinh nang
      // moi - xem UserDepartmentChangedPayload trong packages/common-dto). Mau
      // outbox-emission-trong-transaction nay lay dung theo deactivate()/invite() o tren: ghi
      // outbox_events CUNG transaction voi thay doi nghiep vu de tranh outbox record va DB update bi
      // lech nhau khi 1 trong 2 thao tac that bai giua chung.
      if (departmentIdInRequest) {
        const payload: UserDepartmentChangedPayload = {
          userId: updated.id,
          departmentId: updated.departmentId ?? null,
          actorId,
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
          organizationId,
          producer: 'iam-service',
          payload: payload as unknown as Record<string, unknown>,
        });
      }
      return updated;
    });

    // 26/10/2026: doc lai sau khi luu - ban ghi trong transaction khong nap `roles` (loadEagerRelations:
    // false) nen muc vai tro/ho so tra ve phai lay tu ban ghi day du (drawer Ho so nhan vien dung ngay).
    return this.findById(organizationId, saved.id);
  }

  /** 26/10/2026: ma nhan vien bi trung do 2 request dong thoi vuot qua pre-check -> 409 ro rang. */
  private async runUpdateTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction(work);
    } catch (error) {
      if (isEmployeeCodeViolation(error)) {
        throw new ConflictException({ message: 'Ma nhan vien da duoc dung', errorCode: ERROR_CODES.EMPLOYEE_CODE_TAKEN });
      }
      throw error;
    }
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
      throw new BadRequestException({
        message: 'Khong the tu vo hieu hoa chinh tai khoan cua minh',
        errorCode: ERROR_CODES.CANNOT_DEACTIVATE_SELF,
      });
    }

    const existing = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });

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
    //
    // 22/08/2026: phat hien qua rieng ra soat - lenh Redis nay truoc day goi THANG, khong
    // try/catch, SAU KHI transaction Postgres o tren DA COMMIT THANH CONG (isActive=false + outbox
    // event da ghi). Neu Redis dang loi/mat ket noi luc nay, request se 500 lam admin tuong thao
    // tac that bai va co the thu lai - trong khi vo hieu hoa DA THANH CONG that su trong DB. Boc
    // try/catch (khong can withTimeout vi day la lenh GHI cuoi cung, khong chan luong nghiep vu
    // nao khac phia sau) - blacklist Redis chi la lop thu hoi token SOM (defense in depth), token
    // van tu het han binh thuong trong toi da 15 phut ke ca khi buoc nay that bai.
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const ttlSeconds = Math.floor(parseDurationMs(accessExpiresIn) / 1000);
    try {
      await this.redisService.blacklistUser(saved.id, ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `Ghi Redis blacklist that bai sau khi deactivate ${saved.id} (bo qua, tai khoan van DA bi vo hieu hoa trong DB, token se tu het han trong toi da ${accessExpiresIn}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return this.toPublicUser(saved);
  }

  /**
   * 22/07/2026: endpoint kich hoat lai 1 tai khoan da bi deactivate() - truoc day KHONG ton tai
   * (deactivate la thao tac 1 chieu, ca nhan bi vo hieu hoa nham hoac can kich hoat lai deu phai
   * sua tay truc tiep tren DB). Khong phat outbox event: packages/common-dto EVENT_TYPES chua co
   * entry USER_REACTIVATED tuong ung, va them event type moi + cap nhat 3 service tieu thu
   * (Notification/Analytics/...) nam ngoai pham vi apps/iam-service/src/** cua fix nay - xem bao
   * cao cuoi cung.
   *
   * 26/10/2026: (1) phat iam.user.reactivated (cung transaction) - ml-service danh dau lai user hoat
   * dong (chan tai anh ho khi dang bi vo hieu hoa, Technical_Spec.md muc 27.8); (2) go khoa blacklist
   * Redis do deactivate() dat - truoc day nguoi vua kich hoat lai dang nhap duoc nhung moi API 401.
   */
  async reactivate(organizationId: string, id: string, actorId?: string): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });

    const saved = await this.dataSource.transaction(async (manager) => {
      user.isActive = true;
      const updated = await manager.save(user);
      const payload: UserReactivatedPayload = { userId: id, actorId: actorId ?? id };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.USER_REACTIVATED,
        organizationId,
        producer: 'iam-service',
        payload: payload as unknown as Record<string, unknown>,
      });
      return updated;
    });
    try {
      await this.redisService.unblacklistUser(id);
    } catch (err) {
      this.logger.warn(`Khong go duoc blacklist Redis sau khi kich hoat lai ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return this.toPublicUser(saved);
  }

  /**
   * 25/09/2026: xoa vinh vien 1 tai khoan - truoc day User la entity DUY NHAT trong toan du an
   * khong co API xoa nao (chi deactivate()/reactivate()), khac Customer/Deal/Task/Project/Document
   * deu co DELETE that su. Phat sinh nhu cau thuc te: du lieu rac do E2E test tao ra (vd "Thanh
   * vien E2E <timestamp>", nay da tach sang to chuc E2E rieng - xem e2e/README.md) khi con trong to
   * chuc demo chi deactivate() duoc, van hien vinh vien trong Quan tri > Thanh vien/Cham cong/...
   * (2 man hinh nay doc danh sach nguoi dung TRUC TIEP tu day, khong loc theo isActive) - nguoi
   * dung phan anh nhieu lan. Xoa CUNG (hard delete), dung quy uoc da co cua du an cho moi entity
   * khac (Doc/Upgrade.md Tier 3: "hien moi thao tac xoa deu la hard delete tren toan du an").
   *
   * Bat buoc PHAI deactivate() truoc (kiem tra isActive=false ben duoi) - rao an toan o tang
   * service (khong chi an nut o UI) cho 1 thao tac khong the hoan tac, tranh xoa nham 1 nhan vien
   * dang lam viec binh thuong.
   *
   * An toan ve rang buoc FK: refresh_tokens/password_reset_tokens (ON DELETE CASCADE tren user_id)
   * va user_roles (ON DELETE CASCADE tren user_id, KHONG cascade tren role_id) tu dong don theo -
   * da xac minh truc tiep tren schema Postgres dang chay truoc khi viet ham nay. hrm/document/
   * project-task-service KHONG giu ban sao User nao (chi luu userId dang UUID tho) nen xoa o day
   * khong anh huong 3 service do.
   *
   * 25/09/2026 (phat hien qua phan hoi thuc te NGAY SAU khi trien khai ban dau, xem
   * RevisionHistory.md): Analytics Service VA ml-service (apps/ml-service) LAI CO tu xay read-model
   * rieng qua Kafka (bang `dim_user`, phuc vu KPI/scoping theo phong ban) - ban dau tuong lam KHONG
   * co, dan den user vua xoa cung o day van "song sot" trong 2 bang do vinh vien (khong service nao
   * tung bao chung "user nay da bi xoa"), lam Anomaly Detection hien UUID tho thay vi ten cho nhung
   * nhan vien da xoa. Sua bang cach PHAT outbox event EVENT_TYPES.USER_DELETED (khac
   * USER_DEACTIVATED/reactivate() o tren - 2 cai do KHONG can event vi user van TON TAI, chi doi
   * trang thai) - Analytics Service/ml-service consume event nay de xoa dong `dim_user` tuong ung.
   */
  async remove(organizationId: string, id: string, actorId: string): Promise<void> {
    if (id === actorId) {
      throw new BadRequestException({
        message: 'Khong the tu xoa chinh tai khoan cua minh',
        errorCode: ERROR_CODES.CANNOT_DELETE_SELF,
      });
    }

    const existing = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });

    if (existing.isActive) {
      throw new BadRequestException({
        message: 'Chi co the xoa vinh vien tai khoan da bi vo hieu hoa - hay vo hieu hoa truoc',
        errorCode: ERROR_CODES.CANNOT_DELETE_ACTIVE_USER,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(User, { id, organizationId });

      // 25/09/2026: phat USER_DELETED - cac service tu xay read-model rieng qua Kafka (dim_user o
      // Analytics Service, apps/ml-service) can biet de xoa "user ma" khoi bang lookup cua ho,
      // khac USER_DEACTIVATED/reactivate() (khong can, vi user van con TON TAI, chi doi trang thai).
      const payload: UserDeletedPayload = { userId: id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.USER_DELETED,
        organizationId,
        producer: 'iam-service',
        payload: payload as unknown as Record<string, unknown>,
      });
    });

    // Mirror deactivate() - phong truong hop con token chua het han (vd deactivate() va remove()
    // cach nhau du lau de token cu bi cap lai qua refresh, hiem nhung khong phai khong the).
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const ttlSeconds = Math.floor(parseDurationMs(accessExpiresIn) / 1000);
    try {
      await this.redisService.blacklistUser(id, ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `Ghi Redis blacklist that bai sau khi xoa ${id} (bo qua, tai khoan van DA bi xoa trong DB): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    // 26/10/2026: xoa vinh vien -> xoa ca object avatar (muc 27.11); vo hieu hoa thi giu avatar.
    await this.minioService?.removeObjectQuietly(existing.avatarObjectKey);
  }

  // ---------------------------------------------------------------- 26/10/2026: ho so/avatar ----

  private async loadUserOrThrow(organizationId: string, id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });
    return user;
  }

  /**
   * Doi/xoa avatar: chinh chu; Org Admin (user:manage); Manager (user:invite + phong ban JWT) CHI voi
   * Employee cung phong ban (khong Manager khac, khong Org Admin). Super Admin: khong co du lieu tenant.
   */
  private assertProfileWriteScope(caller: ProfileCaller, target: User): void {
    const forbidden = new ForbiddenException({
      message: 'Ban khong co quyen thay doi ho so cua nguoi dung nay',
      errorCode: ERROR_CODES.PROFILE_SCOPE_FORBIDDEN,
    });
    if (caller.isSuperAdmin) throw forbidden;
    if (target.id === caller.userId) return;
    const scope = resolveDataScope(caller.permissions, PERMISSIONS.USER_INVITE, caller.departmentId);
    if (scope === 'organization') return;
    if (scope === 'department' && (target.departmentId ?? null) === caller.departmentId && roleLevelOf(target) === 'EMPLOYEE') return;
    throw forbidden;
  }

  private normalizePhoneOrThrow(raw: string): string {
    const phone = normalizeVietnamesePhone(raw);
    if (!phone) {
      throw new BadRequestException({ message: 'So dien thoai khong hop le', errorCode: ERROR_CODES.PHONE_INVALID });
    }
    return phone;
  }

  /** Ma nhan vien luu CHU HOA -> unique index (org, employee_code) khong phan biet hoa thuong. */
  private normalizeEmployeeCodeOrThrow(raw: string): string {
    const code = raw.trim();
    if (!EMPLOYEE_CODE_RE.test(code)) {
      throw new BadRequestException({ message: 'Ma nhan vien khong hop le', errorCode: ERROR_CODES.EMPLOYEE_CODE_INVALID });
    }
    return code.toUpperCase();
  }

  private async assertEmployeeCodeFree(organizationId: string, employeeCode: string, exceptUserId: string | null): Promise<void> {
    const holder = await this.userRepo.findOne({ where: { organizationId, employeeCode } });
    if (holder && holder.id !== exceptUserId) {
      throw new ConflictException({ message: 'Ma nhan vien da duoc dung', errorCode: ERROR_CODES.EMPLOYEE_CODE_TAKEN });
    }
  }

  /** Nhat ky + su kien sua ho so: CHI ten truong, khong bao gio gia tri (gioi han muc dich muc 27.3). */
  private async recordProfileChange(
    manager: EntityManager,
    organizationId: string,
    targetUserId: string,
    actorId: string,
    changedFields: string[],
  ): Promise<void> {
    await manager.save(manager.create(UserProfileChangeLog, { organizationId, targetUserId, actorId, changedFields }));
    const payload: UserProfileUpdatedPayload = { userId: targetUserId, changedFields, actorId };
    await this.outboxService.record(manager, {
      eventType: EVENT_TYPES.USER_PROFILE_UPDATED,
      organizationId,
      producer: 'iam-service',
      payload: payload as unknown as Record<string, unknown>,
    });
  }

  private requireMinio(): MinioService {
    if (!this.minioService) throw new Error('MinioService chua duoc cau hinh');
    return this.minioService;
  }

  private async avatarUrl(user: User): Promise<string | null> {
    if (!user.avatarObjectKey || !this.minioService) return null;
    try {
      return await this.minioService.presignedGetObject(user.avatarObjectKey, this.configService.get<number>('avatarUrlTtlSeconds') ?? 3600);
    } catch (err) {
      // Ky URL loi -> client hien chu viet tat, khong lam hong ca danh sach.
      this.logger.warn(`Khong ky duoc URL avatar ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // 26/10/2026: the danh ba rut gon cho nguoi ngoai pham vi - xem chu thich tai findAll().
  private async toDirectoryCard(user: User): Promise<DirectoryCard> {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      departmentId: user.departmentId ?? null,
      isActive: user.isActive,
      avatarUrl: await this.avatarUrl(user),
    };
  }

  private async toPublicUser(user: User): Promise<PublicUser> {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      departmentId: user.departmentId ?? null,
      isActive: user.isActive,
      roles: (user.roles ?? []).map((r) => ({ id: r.id, name: r.name })),
      createdAt: user.createdAt,
      avatarUrl: await this.avatarUrl(user),
    };
  }

  private async toUserProfile(user: User): Promise<UserProfile> {
    return {
      ...(await this.toPublicUser(user)),
      phoneNumber: user.phoneNumber ?? null,
      employeeCode: user.employeeCode ?? null,
      roleLevel: roleLevelOf(user),
    };
  }
}
