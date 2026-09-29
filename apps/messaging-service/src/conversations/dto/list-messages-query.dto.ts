import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** GET /conversations/:id/messages - phan trang kieu cursor (beforeMessageId), khong dung page/limit chuan. */
export class ListMessagesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @IsOptional()
  @IsUUID('4')
  beforeMessageId?: string;
}
