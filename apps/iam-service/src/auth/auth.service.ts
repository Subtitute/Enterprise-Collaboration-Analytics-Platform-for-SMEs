import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
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
    if (existing) throw new ConflictException('Email da duoc su dung boi mot to chuc khac');

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
        throw new ConflictException('Email da duoc su dung boi mot to chuc khac');
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
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      // 22/07/2026: van chay bcrypt.compare() (voi DUMMY_PASSWORD_HASH co dinh) truoc khi tu choi
      // de nhanh nay ton thoi gian tuong duong nhanh "sai mat khau" ben duoi - xem chu thich
      // DUMMY_PASSWORD_HASH dau file. Ket qua bi bo qua, chi de lam phang thoi gian phan hoi.
      await bcrypt.compare(dto.password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Email hoac mat khau khong dung');
    }
    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Email hoac mat khau khong dung');
    }
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
      throw new UnauthorizedException('Refresh token khong hop le hoac da het han');
    }

    const isBlacklisted = await this.redisService.isTokenBlacklisted(payload.tokenId);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token da bi thu hoi');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Nguoi dung khong ton tai hoac da bi vo hieu hoa');
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
      throw new UnauthorizedException('Refresh token khong ton tai hoac da bi thu hoi');
    }
    const ttlSeconds = expUnixSeconds
      ? Math.max(0, expUnixSeconds - Math.floor(Date.now() / 1000))
      : 0;
    await this.redisService.blacklistToken(tokenId, ttlSeconds);
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
