import { IsDateString } from 'class-validator';

/** 04/11/2026: query GET /work-calendar/working-days. */
export class WorkingDaysQueryDto {
  @IsDateString({}, { message: 'Ngày bắt đầu phải là ngày hợp lệ (ISO-8601)' })
  startDate: string;

  @IsDateString({}, { message: 'Ngày kết thúc phải là ngày hợp lệ (ISO-8601)' })
  endDate: string;
}
