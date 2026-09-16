import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES, PaginatedResponse, PaginationQueryDto, paginate } from '@app/common-dto';
import { Organization } from '../entities/organization.entity';
import { User } from '../entities/user.entity';
import { RedisService } from '../redis/redis.service';
import { parseDurationMs } from '../auth/auth.service';

export interface PlatformOrganizationSummary {
  id: string;
  name: string;
  taxCode: string | null;
  isActive: boolean;
  userCount: number;
  createdAt: Date;
}

export interface PlatformStats {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
}

/**
 * 16/09/2026: "Super Admin" (tinh nang moi) - quan ly VONG DOI cac to chuc (tenant) dang ky tren
 * nen tang, KHONG xem/dung duoc du lieu nghiep vu (du an, tai lieu, khach hang, cham cong...) cua
 * bat ky to chuc nao - dung y giu nguyen bien gioi da to chuc/da tenant hien co (moi guard/query
 * nghiep vu van loc theo organizationId cua nguoi goi, xem General_idea.md muc 4). Day la lan DAU
 * TIEN he thong co 1 vai tro nhin xuyen duoc NHIEU to chuc, nhung CHI o pham vi entity Organization
 * trong chinh iam-service - khong lan sang 6 service nghiep vu con lai.
 */
@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  constructor(
    @InjectRepository(Organization) private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async listOrganizations(query: PaginationQueryDto): Promise<PaginatedResponse<PlatformOrganizationSummary>> {
    const { page, limit } = query;
    // isSystem: false - loc bo to chuc "he thong" dung de an cu tai khoan Super Admin (xem
    // Organization.isSystem) - khong phai 1 khach hang/tenant that, khong quan ly qua API nay.
    const [organizations, total] = await this.organizationRepo.findAndCount({
      where: { isSystem: false },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // So luong to chuc du kien rat nho (quy mo do an tot nghiep, khong phai SaaS nhieu nghin
    // tenant that) - dem userCount tung to chuc 1 truy van la du don gian/de doc, khong can gop
    // thanh 1 subquery phuc tap cho quy mo nay.
    const data = await Promise.all(organizations.map((org) => this.toSummary(org)));
    return paginate(data, total, page, limit);
  }

  async getOrganization(id: string): Promise<PlatformOrganizationSummary> {
    const org = await this.findManagedOrganization(id);
    return this.toSummary(org);
  }

  /**
   * Khoa/mo khoa TOAN BO 1 to chuc - deactivate() chan dang nhap/refresh cua MOI user thuoc to
   * chuc do (xem AuthService.login()/refresh()) VA thu hoi ngay access token dang hieu luc (mirror
   * dung UsersService.deactivate() nhung ap dung cho CA to chuc thay vi 1 user rieng le).
   */
  async setOrganizationActive(id: string, isActive: boolean): Promise<PlatformOrganizationSummary> {
    const org = await this.findManagedOrganization(id);
    org.isActive = isActive;
    const saved = await this.organizationRepo.save(org);

    if (!isActive) {
      await this.blacklistAllUsersSafe(id);
    }

    return this.toSummary(saved);
  }

  async getPlatformStats(): Promise<PlatformStats> {
    const [totalOrganizations, activeOrganizations, totalUsers] = await Promise.all([
      this.organizationRepo.count({ where: { isSystem: false } }),
      this.organizationRepo.count({ where: { isSystem: false, isActive: true } }),
      // isSuperAdmin: false - khong tinh chinh (cac) tai khoan Super Admin vao so lieu "nguoi
      // dung" cua nen tang (ho khong phai nhan su cua bat ky to chuc nghiep vu nao).
      this.userRepo.count({ where: { isSuperAdmin: false } }),
    ]);
    return { totalOrganizations, activeOrganizations, totalUsers };
  }

  private async findManagedOrganization(id: string): Promise<Organization> {
    const org = await this.organizationRepo.findOne({ where: { id, isSystem: false } });
    if (!org) {
      throw new NotFoundException({ message: 'Khong tim thay to chuc', errorCode: ERROR_CODES.ORGANIZATION_NOT_FOUND });
    }
    return org;
  }

  private async toSummary(org: Organization): Promise<PlatformOrganizationSummary> {
    const userCount = await this.userRepo.count({ where: { organizationId: org.id } });
    return {
      id: org.id,
      name: org.name,
      taxCode: org.taxCode ?? null,
      isActive: org.isActive,
      userCount,
      createdAt: org.createdAt,
    };
  }

  /**
   * Fail-open (log-and-swallow) giong het UsersService.deactivate() - to chuc DA bi khoa thanh
   * cong trong Postgres (nguon su that chinh) truoc khi ham nay chay; Redis blacklist chi la lop
   * thu hoi SOM (defense in depth), loi Redis khong duoc phep bien thao tac khoa to chuc thanh
   * "that bai" trong khi DB da doi thanh cong.
   */
  private async blacklistAllUsersSafe(organizationId: string): Promise<void> {
    const users = await this.userRepo.find({ where: { organizationId }, select: ['id'] });
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const ttlSeconds = Math.floor(parseDurationMs(accessExpiresIn) / 1000);

    for (const user of users) {
      try {
        await this.redisService.blacklistUser(user.id, ttlSeconds);
      } catch (err) {
        this.logger.warn(
          `Ghi Redis blacklist that bai cho user ${user.id} sau khi khoa to chuc ${organizationId} ` +
            `(bo qua, to chuc van DA bi khoa trong DB, token se tu het han trong toi da ${accessExpiresIn}): ${
              err instanceof Error ? err.message : String(err)
            }`,
        );
      }
    }
  }
}
