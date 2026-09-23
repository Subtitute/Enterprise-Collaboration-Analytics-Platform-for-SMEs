import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { LeavePolicy } from '../entities/leave-policy.entity';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';

/** Ma loi Postgres cho vi pham rang buoc unique (vd @Index({unique:true}) tren LeavePolicy.organizationId). */
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class LeavePolicyService {
  constructor(@InjectRepository(LeavePolicy) private readonly policyRepo: Repository<LeavePolicy>) {}

  /**
   * Doc chinh sach nghi phep cua to chuc - tu tao voi gia tri mac dinh (12 ngay/nam, +1 ngay/5 nam
   * tham nien) neu to chuc chua tung cau hinh. Bat QueryFailedError 23505 cho truong hop 2 request
   * dau tien cung goi dong thoi (idempotent, mirror pattern TasksService.assign()).
   */
  async getOrCreate(organizationId: string): Promise<LeavePolicy> {
    const existing = await this.policyRepo.findOne({ where: { organizationId } });
    if (existing) return existing;

    try {
      return await this.policyRepo.save(this.policyRepo.create({ organizationId }));
    } catch (error) {
      const pgErrorCode =
        error instanceof QueryFailedError
          ? (error.driverError as { code?: string } | undefined)?.code
          : undefined;
      if (pgErrorCode === POSTGRES_UNIQUE_VIOLATION) {
        const race = await this.policyRepo.findOne({ where: { organizationId } });
        if (race) return race;
      }
      throw error;
    }
  }

  async update(organizationId: string, dto: UpdateLeavePolicyDto): Promise<LeavePolicy> {
    const policy = await this.getOrCreate(organizationId);
    if (dto.baseDaysPerYear !== undefined) policy.baseDaysPerYear = dto.baseDaysPerYear;
    if (dto.seniorityYearsPerBonusDay !== undefined) policy.seniorityYearsPerBonusDay = dto.seniorityYearsPerBonusDay;
    return this.policyRepo.save(policy);
  }
}
