import { IsOptional, IsString } from 'class-validator';

/** Body cho PATCH /overtime-requests/:id/approve|reject. */
export class DecideOvertimeRequestDto {
  @IsOptional()
  @IsString({ message: 'Ghi chu quyet dinh phai la chuoi ky tu' })
  decisionNote?: string;
}
