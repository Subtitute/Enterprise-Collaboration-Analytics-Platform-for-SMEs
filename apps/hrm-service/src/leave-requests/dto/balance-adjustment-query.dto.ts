import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** 04/11/2026: query GET /leave-requests/balance-adjustments. */
export class BalanceAdjustmentQueryDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'userId phải là UUID hợp lệ' })
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Năm phải là số nguyên' })
  @Min(2000, { message: 'Năm không hợp lệ' })
  @Max(2100, { message: 'Năm không hợp lệ' })
  year?: number;
}
