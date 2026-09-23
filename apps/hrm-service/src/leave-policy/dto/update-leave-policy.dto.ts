import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Body cho PATCH /leave-policy - chi Org Admin (PERMISSIONS.ORG_MANAGE) duoc cau hinh. */
export class UpdateLeavePolicyDto {
  @IsOptional()
  @IsInt({ message: 'Số ngày phép cơ bản phải là số nguyên' })
  @Min(0, { message: 'Số ngày phép cơ bản không được âm' })
  @Max(60, { message: 'Số ngày phép cơ bản không hợp lý (tối đa 60)' })
  baseDaysPerYear?: number;

  @IsOptional()
  @IsInt({ message: 'Số năm thâm niên mỗi lần cộng phép phải là số nguyên' })
  @Min(1, { message: 'Số năm thâm niên mỗi lần cộng phép phải ít nhất là 1' })
  @Max(20, { message: 'Số năm thâm niên mỗi lần cộng phép không hợp lý (tối đa 20)' })
  seniorityYearsPerBonusDay?: number;
}
