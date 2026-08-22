import { ConflictException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { OutboxService } from '../outbox/outbox.service';
import { RolesService } from '../roles/roles.service';
import { RedisService } from '../redis/redis.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LoginDto } from './dto/login.dto';
import { isPostgresUniqueViolation } from '../common/db-errors.util';
import {
  DefaultRoleName,
  ERROR_CODES,
  EVENT_TYPES,
  JwtAccessPayload,
  JwtRefreshPayload,
  OrganizationRegisteredPayload,
  UserRegisteredPayload,
} from '@app/common-dto';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// 22/07/2026: hash "gia" co dinh, tinh 1 lan luc module duoc load (bcrypt.hashSync, khong phai
// hash cua bat ky mat khau that nao) - dung de login() van chay du 1 luot bcrypt.compare() ngay
// ca khi tai khoan khong ton tai/da bi vo hieu hoa, nham lam PHANG thoi gian phan hoi giua 2
// nhanh: truoc day nhanh "khong tim thay tai khoan" tra loi NGAY (rat nhanh) trong khi nhanh "sai
// mat khau" luon phai cho bcrypt.compare() chay xong (~hang chuc ms) - ke tan cong co the do do
// tre phan hoi de doan biet 1 email co ton tai trong he thong hay khong (timing side-channel,
// loi MAJOR, review 22/07/2026).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password-for-timing-normalization', 10);

// 22/08/2026: chan brute-force dang nhap THEO TAI KHOAN CU THE - xem chu thich day du trong
// AuthService.login() ve ly do dat o day (iam-service) thay vi Gateway.
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60; // 15 phut

/** Ho so nguoi dung cong khai tra ve o response - khong bao gio bao gom passwordHash. */
function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    organizationId: user.organizationId,
    departmentId: user.departmentId ?? null,
    roles: (user.roles ?? []).map((r) => ({ id: r.id, name: r.name })),
  };
}

/** Quy doi chuoi thoi han kieu "15m"/"7d" sang milliseconds. */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * unitMs[unit];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly outboxService: OutboxService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async registerOrganization(dto: RegisterOrganizationDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.adminEmail } });
    if (existing) throw new ConflictException({
      message: 'Email da duoc su dung boi mot to chuc khac',
      errorCode: ERROR_CODES.EMAIL_ALREADY_USED_BY_ORG,
    });

    // 22/07/2026: pre-check findOne() o tren khong nguyen tu voi insert ben duoi - boc them
    // try/catch de bat truong hop hiem gap 2 request dang ky cung email gan nhu dong thoi, ca hai
    // cung vuot qua pre-check roi 1 ben vi pham unique index `email` khi insert (Postgres error
    // code 23505) - xem chu thich isPostgresUniqueViolation trong db-errors.util.ts.
    let created: { user: User; organization: Organization };
    try {
      created = await this.dataSource.transaction(async (manager) => {
        const organization = await manager.save(
          manager.create(Organization, { name: dto.organizationName, taxCode: dto.taxCode }),
        );

        const roles = await this.rolesService.seedDefaultRoles(manager, organization.id);
        const passwordHash = await bcrypt.hash(dto.adminPassword, 10);

        const user = await manager.save(
          manager.create(User, {
            organizationId: organization.id,
            email: dto.adminEmail,
            fullName: dto.adminFullName,
            passwordHash,
            isActive: true,
            roles: [roles[DefaultRoleName.ORG_ADMIN]],
          }),
        );

        const orgPayload: OrganizationRegisteredPayload = {
          organizationId: organization.id,
          name: organization.name,
          ownerUserId: user.id,
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.ORGANIZATION_REGISTERED,
          organizationId: organization.id,
          producer: 'iam-service',
          payload: orgPayload as unknown as Record<string, unknown>,
        });

        const userPayload: UserRegisteredPayload = {
          userId: user.id,
          email: user.email,
          departmentId: null,
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.USER_REGISTERED,
          organizationId: organization.id,
          producer: 'iam-service',
          payload: userPayload as unknown as Record<string, unknown>,
        });

        return { user, organization };
      });
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictException({
      message: 'Email da duoc su dung boi mot to chuc khac',
      errorCode: ERROR_CODES.EMAIL_ALREADY_USED_BY_ORG,
    });
      }
      throw error;
    }

    const { user, organization } = created;
    const tokens = await this.issueTokenPair(user);
    return {
      ...tokens,
      user: toPublicUser(user),
      organization: { id: organization.id, name: organization.name },
    };
  }

  async login(dto: LoginDto) {
    // 22/08/2026: bo sung chan brute-force dang nhap THEO TAI KHOAN CU THE (khong chi theo IP nhu
    // rate-limit hien co o Gateway - apps/gateway/src/rate-limit/rate-limit.middleware.ts, toi da
    // 100 request/60s/IP, ap dung cho MOI route). Gateway KHONG the tu lam viec nay: no la reverse
    // proxy thuan, chu dong tat bodyParser (NestFactory.create(AppModule, {bodyParser: false}),
    // apps/gateway/src/main.ts) de khong tieu thu stream body truoc khi forward nguyen ven toi
    // downstream - nghia la Gateway khong doc duoc dto.email de dung lam khoa. Dat kiem tra o day
    // (iam-service, noi email THUC SU duoc parse boi @Body() LoginDto) la dung tang kien truc.
    const emailKey = dto.email.trim().toLowerCase();
    const attempts = await this.redisService.getFailedLoginAttempts(emailKey);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      throw new HttpException(
        {
          message: 'Tai khoan nay da dang nhap sai qua nhieu lan, vui long thu lai sau it phut',
          errorCode: ERROR_CODES.TOO_MANY_LOGIN_ATTEMPTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      // 22/07/2026: van chay bcrypt.compare() (voi DUMMY_PASSWORD_HASH co dinh) truoc khi tu choi
      // de nhanh nay ton thoi gian tuong duong nhanh "sai mat khau" ben duoi - xem chu thich
      // DUMMY_PASSWORD_HASH dau file. Ket qua bi bo qua, chi de lam phang thoi gian phan hoi.
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      await this.redisService.incrementFailedLoginAttempts(emailKey, LOGIN_ATTEMPT_WINDOW_SECONDS);
      throw new UnauthorizedException({
      message: 'Email hoac mat khau khong dung',
      errorCode: ERROR_CODES.INVALID_CREDENTIALS,
    });
    }
    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.redisService.incrementFailedLoginAttempts(emailKey, LOGIN_ATTEMPT_WINDOW_SECONDS);
      throw new UnauthorizedException({
      message: 'Email hoac mat khau khong dung',
      errorCode: ERROR_CODES.INVALID_CREDENTIALS,
    });
    }
    await this.redisService.resetFailedLoginAttempts(emailKey);
    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: toPublicUser(user) };
  }

  async refresh(refreshTokenValue: string) {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshTokenValue, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Refresh token khong hop le hoac da het han',
        errorCode: ERROR_CODES.REFRESH_TOKEN_INVALID,
      });
    }

    // 25/07/2026: MAJOR (review 25/07/2026) - truoc day goi thang isTokenBlacklisted() khong co
    // try/catch: 1 su co Redis tam thoi (mat ket noi, timeout...) se nem loi thang len, lam ca
    // luong refresh() 500 chung chung thay vi chi bo qua kiem tra blacklist - khac voi triet ly
    // "fail-open" da ap dung o Gateway (jwt-auth.middleware.ts) va cac Redis-call khac tuong tu o
    // Analytics-service: mat Redis tam thoi KHONG duoc phep lam sap ca luong dang nhap/refresh cua
    // toan he thong. Danh doi co chu dich: neu Redis dang loi, coi nhu "chua bi thu hoi" (fail
    // open) - ban ghi RefreshToken trong Postgres (kiem tra ben duoi qua revokeRefreshToken() sau
    // nay va userRepo.findOne()) van la co che xac thuc/thu hoi CHINH, Redis blacklist chi la lop
    // phong thu chieu sau (defense in depth) danh cho truong hop token da bi revoke NHUNG chua het
    // han JWT - uu tien tinh san sang (availability) hon do nghiem ngat tuyet doi o day.
    let isBlacklisted = false;
    try {
      isBlacklisted = await this.redisService.isTokenBlacklisted(payload.tokenId);
    } catch (err) {
      this.logger.warn(
        `Kiem tra Redis blacklist that bai, coi nhu token CHUA bi thu hoi (fail-open): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    if (isBlacklisted) {
      throw new UnauthorizedException({
        message: 'Refresh token da bi thu hoi',
        errorCode: ERROR_CODES.REFRESH_TOKEN_REVOKED,
      });
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        message: 'Nguoi dung khong ton tai hoac da bi vo hieu hoa',
        errorCode: ERROR_CODES.USER_INACTIVE_OR_MISSING,
      });
    }

    // Xoay vong token: thu hoi token cu ngay khi cap token moi. revokeRefreshToken() tu no da
    // dong thoi la "chot" kiem tra token con hop le hay khong (xem chu thich trong ham) - neu no
    // nem UnauthorizedException nghia la 1 request khac da thu hoi token nay truoc, dung o day
    // ma khong cap token moi.
    await this.revokeRefreshToken(payload.tokenId, payload.exp);

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: toPublicUser(user) };
  }

  async logout(refreshTokenValue: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshTokenValue, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
      await this.revokeRefreshToken(payload.tokenId, payload.exp);
    } catch {
      // Token da khong hop le / da bi thu hoi tu truoc (vd revokeRefreshToken nem loi vi affected
      // = 0) - coi nhu da dang xuat, khong can bao loi cho client.
    }
  }

  /**
   * 22/07/2026: xoa truc tiep theo id va dung so dong bi anh huong (`affected`) lam dieu kien
   * "token con hop le" DUY NHAT - truoc day tach lam 2 buoc rieng (refresh(): findOne doc ban ghi
   * roi moi goi ham nay de remove()); giua 2 buoc doc/ghi do, 2 request refresh() goi dong thoi
   * VOI CUNG 1 refresh token (vd nguoi dung mo 2 tab, hoac client tu dong retry request refresh
   * bi timeout) deu co the doc thay ban ghi con ton tai TRUOC KHI ben nao kip xoa no - dan den ca
   * hai deu vuot qua kiem tra va cung duoc cap 1 cap token moi rieng (replay race: 1 refresh token
   * hop le bi dung de mo ra 2 phien thay vi 1). 1 cau lenh DELETE ... WHERE id = X don le da
   * nguyen tu o muc Postgres (khoa row trong luc xoa, request den sau phai doi va nhan ve 0 dong
   * bi anh huong khi row da bi xoa) nen khong can boc them dataSource.transaction() - repo.delete()
   * chinh la "chot" quyet dinh duy nhat, request den sau bi tu choi bang UnauthorizedException
   * thay vi duoc cap token moi. Dung chung cho ca logout() va refresh() (xoay vong token).
   */
  private async revokeRefreshToken(tokenId: string, expUnixSeconds?: number): Promise<void> {
    const result = await this.refreshTokenRepo.delete({ id: tokenId });
    if (!result.affected) {
      throw new UnauthorizedException({
        message: 'Refresh token khong ton tai hoac da bi thu hoi',
        errorCode: ERROR_CODES.REFRESH_TOKEN_NOT_FOUND_OR_REVOKED,
      });
    }
    const ttlSeconds = expUnixSeconds
      ? Math.max(0, expUnixSeconds - Math.floor(Date.now() / 1000))
      : 0;
    // 25/07/2026: MAJOR (review 25/07/2026) - cung tinh than fail-open voi isTokenBlacklisted()
    // o refresh() phia tren, nhung o chieu nguoc lai (ghi thay vi doc): neu Redis dang loi luc
    // ghi blacklist, KHONG duoc phep lam that bai ca logout()/rotation cua refresh() - ban ghi
    // RefreshToken vua bi delete() ngay phia tren (result.affected > 0, da xac nhan truoc khi toi
    // day) MOI la co che thu hoi CHINH va da du hieu luc (JWT verifyAsync() cua lan refresh/logout
    // sau se khong con tim thay ban ghi tuong ung); ghi blacklist Redis o day chi la lop phong thu
    // chieu sau bo sung, log-and-swallow neu that bai thay vi nem loi len lam nguoi dung "dang
    // xuat khong thanh cong" hay "refresh() 500" chi vi Redis tam thoi gian doan.
    try {
      await this.redisService.blacklistToken(tokenId, ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `Ghi Redis blacklist that bai (bo qua, RefreshToken trong DB da bi thu hoi la co che chinh): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const roles = user.roles ?? [];
    const permissionKeys = Array.from(
      new Set(roles.flatMap((role) => (role.permissions ?? []).map((p) => p.key))),
    );
    const roleNames = roles.map((r) => r.name);

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      roles: roleNames,
      permissions: permissionKeys,
      // 28/07/2026: xem ghi chu departmentId tai JwtAccessPayload (@app/common-dto) - nang cap
      // access-control tai lieu theo phong ban (Document Service, FolderShare).
      departmentId: user.departmentId ?? null,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn') as any,
    });

    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn')!;
    const expiresAt = new Date(Date.now() + parseDurationMs(refreshExpiresIn));
    const tokenRecord = await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({ userId: user.id, expiresAt }),
    );

    const refreshPayload: JwtRefreshPayload = { sub: user.id, tokenId: tokenRecord.id };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: refreshExpiresIn as any,
    });

    return { accessToken, refreshToken };
  }
}
