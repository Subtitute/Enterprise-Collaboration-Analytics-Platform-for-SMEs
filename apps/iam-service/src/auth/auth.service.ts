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

    const { user, organization } = await this.dataSource.transaction(async (manager) => {
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

    const stored = await this.refreshTokenRepo.findOne({ where: { id: payload.tokenId } });
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token khong ton tai hoac da het han');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Nguoi dung khong ton tai hoac da bi vo hieu hoa');
    }

    // Xoay vong token: thu hoi token cu ngay khi cap token moi
    await this.revokeRefreshToken(stored);

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: toPublicUser(user) };
  }

  async logout(refreshTokenValue: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshTokenValue, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
      const stored = await this.refreshTokenRepo.findOne({ where: { id: payload.tokenId } });
      if (stored) {
        await this.revokeRefreshToken(stored);
      }
    } catch {
      // Token da khong hop le - coi nhu da dang xuat, khong can bao loi cho client
    }
  }

  private async revokeRefreshToken(stored: RefreshToken): Promise<void> {
    const ttlSeconds = Math.max(0, Math.floor((stored.expiresAt.getTime() - Date.now()) / 1000));
    await this.redisService.blacklistToken(stored.id, ttlSeconds);
    await this.refreshTokenRepo.remove(stored);
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
