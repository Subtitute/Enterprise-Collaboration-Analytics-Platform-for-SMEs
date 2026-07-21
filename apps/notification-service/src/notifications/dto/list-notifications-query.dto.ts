import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/**
 * Query cho `GET /notifications` - phan trang chuan + loc theo trang thai doc + loc theo loai
 * thong bao (`type`, khop 1 gia tri trong EVENT_TYPES cua @app/common-dto, vd 'task.assigned').
 */
export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Loc theo trang thai da doc/chua doc' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  })
  @IsBoolean()
  isRead?: boolean;

  @ApiPropertyOptional({ description: 'Loc theo loai thong bao (vd: task.assigned, document.shared)' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  type?: string;
}
