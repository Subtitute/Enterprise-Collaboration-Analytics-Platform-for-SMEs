import { Allow, IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';
import { TIMESHEET_EXCEPTION_TYPES, TimesheetExceptionType } from '../timesheet-calculator';

/**
 * 04/11/2026: DTO cua module ky cong. Cac truong @Allow() chi de qua duoc whitelist - kiem tra nam o
 * TimesheetsService de moi sai sot deu tra dung ma TIMESHEET_MONTH_INVALID/TIMESHEET_ENTRY_INVALID.
 */
export class TimesheetMonthQueryDto {
  @Allow()
  month: string;
}

export class TimesheetExceptionsQueryDto extends PaginationQueryDto {
  @Allow()
  month: string;

  @IsOptional()
  @IsIn([...TIMESHEET_EXCEPTION_TYPES], { message: 'Loại ngoại lệ không hợp lệ' })
  type?: TimesheetExceptionType;
}

export class UpsertTimesheetEntryDto {
  @Allow()
  userId: string;

  @Allow()
  workDate: string;

  @Allow()
  symbol: string;

  @Allow()
  note: string;
}

export class LockTimesheetPeriodDto {
  @IsOptional()
  @IsBoolean({ message: 'force phải là true hoặc false' })
  force?: boolean;
}

export class UnlockTimesheetPeriodDto {
  @IsString({ message: 'Lý do mở khoá phải là chuỗi ký tự' })
  @Matches(/\S/, { message: 'Lý do mở khoá không được để trống' })
  reason: string;
}
