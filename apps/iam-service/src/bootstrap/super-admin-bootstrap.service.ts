import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';

// 16/09/2026: ten to chuc "he thong" co dinh, dung de nhan dien/tao lai ban ghi an cu Super Admin
// - xem Organization.isSystem. Khong dung lam khoa duy nhat (khong co unique constraint tren
// `name`) nhung du dung trong pham vi 1 lan bootstrap luc khoi dong service.
const PLATFORM_ORGANIZATION_NAME = 'Nen tang ECAP (Super Admin)';

/**
 * 16/09/2026: "Super Admin" (tinh nang moi) - tu dong tao tai khoan quan tri nen tang DAU TIEN
 * luc iam-service khoi dong, neu SUPER_ADMIN_EMAIL/PASSWORD duoc cau hinh VA chua co tai khoan
 * nao dung email do. Khong co luong dang ky Super Admin qua API (se la 1 lo hong bao mat nghiem
 * trong neu bat ky ai cung tu tao duoc tai khoan quan tri toan nen tang) - day la CACH DUY NHAT
 * de co tai khoan Super Admin dau tien, mirror mau "bootstrap qua bien moi truong, idempotent"
 * thay vi 1 script rieng (khong dung chung duoc voi TypeORM repository/validation nhu o day).
 *
 * Idempotent: chi kiem tra "da co user nao dung dung email nay chua" - neu co (ke ca do chinh
 * Super Admin da tu doi mat khau sau nay) thi BO QUA hoan toan, khong bao gio ghi de tai khoan da
 * ton tai. Chay lai moi lan service khoi dong nen an toan tuyet doi khi restart nhieu lan.
 */
@Injectable()
export class SuperAdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SuperAdminBootstrapService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Organization) private readonly organizationRepo: Repository<Organization>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('superAdmin.email');
    const password = this.configService.get<string>('superAdmin.password');
    if (!email || !password) return;

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (existing) return;

    const organization = await this.getOrCreatePlatformOrganization();
    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = this.configService.get<string>('superAdmin.fullName') ?? 'Super Admin';

    await this.userRepo.save(
      this.userRepo.create({
        organizationId: organization.id,
        email: normalizedEmail,
        fullName,
        passwordHash,
        isActive: true,
        isSuperAdmin: true,
        roles: [],
      }),
    );
    this.logger.log(`Da tao tai khoan Super Admin dau tien: ${normalizedEmail}`);
  }

  private async getOrCreatePlatformOrganization(): Promise<Organization> {
    const existing = await this.organizationRepo.findOne({ where: { isSystem: true } });
    if (existing) return existing;
    return this.organizationRepo.save(
      this.organizationRepo.create({ name: PLATFORM_ORGANIZATION_NAME, isSystem: true }),
    );
  }
}
