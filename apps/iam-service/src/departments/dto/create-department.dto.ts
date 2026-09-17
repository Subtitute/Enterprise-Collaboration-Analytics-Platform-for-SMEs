import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // 17/09/2026: id nguoi dung duoc chon lam truong bo phan (xem Department.managerId) - tuy chon,
  // co the tao phong ban ma chua gan nguoi phu trach.
  @IsOptional()
  @IsUUID()
  managerId?: string;
}
