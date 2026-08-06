import { IsOptional, IsString } from 'class-validator';

/** Body cho PATCH /leave-requests/:id/approve|reject - Technical_Spec.md muc 17. */
export class DecideLeaveRequestDto {
  @IsOptional()
  @IsString({ message: 'Ghi chu quyet dinh phai la chuoi ky tu' })
  decisionNote?: string;
}
