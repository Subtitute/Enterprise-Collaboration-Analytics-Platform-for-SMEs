import { Module } from '@nestjs/common';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { TimesheetsController } from './timesheets.controller';
import { TimesheetsService } from './timesheets.service';

/** 04/11/2026: ky cong - xem timesheets.service.ts. Doc entity qua DataSource nen khong can forFeature. */
@Module({
  imports: [WorkCalendarModule],
  providers: [TimesheetsService],
  controllers: [TimesheetsController],
})
export class TimesheetsModule {}
