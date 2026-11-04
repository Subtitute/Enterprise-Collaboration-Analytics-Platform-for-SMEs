import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LeaveType } from '@app/common-dto';
import { LEGACY_REASON_PATTERNS } from './leave-type.util';

/**
 * 04/11/2026: moc phan biet don cu voi don moi: tu dot nang cap nay don moi luon co leave_type dung ngay
 * luc tao, nen backfill khong duoc dung toi. Neu khong co moc, don moi chon phep nam voi ly do "Personal
 * leave ..." se bi doi thanh nghi khong luong o lan khoi dong sau va hoan lai so du da duyet.
 */
const BACKFILL_CREATED_BEFORE = '2026-11-05T00:00:00+07:00';

/**
 * 04/11/2026: chay moi lan khoi dong, idempotent - suy leave_type cho don cu tu tien to `reason` (cot moi
 * mac dinh ANNUAL). Khong sua `reason`, khong doi updated_at. Loi SQL chi ghi log, khong chan khoi dong
 * (mirror UserDepartmentSyncService.backfillDefaultRoles() ben iam-service).
 */
@Injectable()
export class LeaveTypeBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LeaveTypeBackfillService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.backfill();
  }

  async backfill(): Promise<number> {
    try {
      let total = 0;
      for (const { leaveType, source } of LEGACY_REASON_PATTERNS) {
        const result: [unknown, number] = await this.dataSource.query(
          `UPDATE leave_requests SET leave_type = $1 WHERE leave_type = $2 AND created_at < $3 AND reason ~* $4`,
          [leaveType, LeaveType.ANNUAL, BACKFILL_CREATED_BEFORE, source],
        );
        total += result?.[1] ?? 0;
      }
      if (total > 0) this.logger.log(`Da suy loai nghi cho ${total} don cu tu tien to ly do`);
      return total;
    } catch (err) {
      this.logger.warn(`Khong backfill duoc loai nghi: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
  }
}
