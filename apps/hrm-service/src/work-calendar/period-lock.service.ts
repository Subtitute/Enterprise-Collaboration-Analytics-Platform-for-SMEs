import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ERROR_CODES } from '@app/common-dto';
import { TimesheetPeriod } from '../entities/timesheet-period.entity';

/** 04/11/2026: khoa tu van theo to chuc + thang - thang chua co dong ky cong thi khong co gi de khoa dong. */
export function periodLockKey(organizationId: string, month: string): string {
  return `timesheet:${organizationId}:${month}`;
}

/**
 * 04/11/2026: chot chan moi thao tac lam doi du lieu cua thang da khoa ky cong. Dat o work-calendar de
 * cac module nghi phep/lam them/giai trinh goi duoc ma khong phu thuoc vong voi module ky cong.
 */
@Injectable()
export class PeriodLockService {
  constructor(@InjectRepository(TimesheetPeriod) private readonly periodRepo: Repository<TimesheetPeriod>) {}

  /**
   * Nem TIMESHEET_PERIOD_LOCKED neu 1 ngay trong `dates` thuoc thang da khoa. Truyen `manager` khi dang
   * trong giao dich: giu khoa tu van CHIA SE cua thang toi het giao dich, nen thao tac nay va viec khoa ky
   * (khoa doc quyen, TimesheetsService.lock()) khong the chay xen nhau - ke ca lan khoa dau tien, khi dong
   * ky cong chua ton tai. Lay khoa theo thu tu thang tang dan de cac don vat qua thang khong deadlock.
   */
  async assertOpen(organizationId: string, dates: string[], manager?: EntityManager): Promise<void> {
    const months = [...new Set(dates.map((date) => date.slice(0, 7)))].sort();
    if (months.length === 0) return;

    if (manager) {
      for (const month of months) {
        await manager.query('SELECT pg_advisory_xact_lock_shared(hashtext($1))', [periodLockKey(organizationId, month)]);
      }
    }
    const where = months.map((month) => ({ organizationId, year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) }));
    const select = { id: true, year: true, month: true, status: true };
    const periods = manager ? await manager.find(TimesheetPeriod, { where, select }) : await this.periodRepo.find({ where, select });

    const locked = periods.find((period) => period.status === 'LOCKED');
    if (locked) {
      const month = String(locked.month).padStart(2, '0');
      throw new ConflictException({
        message: `Kỳ công tháng ${month}/${locked.year} đã khoá, không thể thay đổi dữ liệu của tháng này`,
        errorCode: ERROR_CODES.TIMESHEET_PERIOD_LOCKED,
        errorParams: { month: `${locked.year}-${month}` },
      });
    }
  }
}
