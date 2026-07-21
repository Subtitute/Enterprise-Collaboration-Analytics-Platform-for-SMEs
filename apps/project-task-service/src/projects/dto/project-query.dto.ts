import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto, ProjectStatus } from '@app/common-dto';

/**
 * Query tim kiem + loc danh sach du an - Wireframe.md muc 4.1 (o tim kiem + dropdown trang thai).
 * Khong co truong loc theo phong ban - dieu chinh 21/07/2026, xem Technical_Spec.md muc 14.
 */
export class ProjectQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: 'search phai la chuoi ky tu' })
  search?: string;

  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'Trang thai du an khong hop le' })
  status?: ProjectStatus;
}
