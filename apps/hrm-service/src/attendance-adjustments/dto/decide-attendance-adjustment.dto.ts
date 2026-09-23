import { IsOptional, IsString } from 'class-validator';

/** Body cho PATCH /attendance-adjustments/:id/approve|reject. */
export class DecideAttendanceAdjustmentDto {
  @IsOptional()
  @IsString({ message: 'Ghi chu quyet dinh phai la chuoi ky tu' })
  decisionNote?: string;
}
