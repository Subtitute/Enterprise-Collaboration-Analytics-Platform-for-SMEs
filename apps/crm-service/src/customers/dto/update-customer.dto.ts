import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString({ message: 'Ten khach hang phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ten khach hang khong duoc de trong' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email khong hop le' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'So dien thoai phai la chuoi ky tu' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Cong ty phai la chuoi ky tu' })
  company?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chu phai la chuoi ky tu' })
  notes?: string;

  // 17/09/2026: cho phep Manager/Org Admin (nguoi co PERMISSIONS.CUSTOMER_UPDATE - da duoc
  // CustomersController.update() gate san, xem RequirePermissions tren controller) doi nguoi phu
  // trach khach hang qua PATCH - xem CustomersService.findAll()/findById() cho quy tac Employee chi
  // xem duoc khach hang minh phu trach. Mirror Project.leadUserId (update-project.dto.ts): KHONG
  // validate ownerUserId co thuc su thuoc organizationId cua nguoi goi hay khong - repo nay chua co
  // co che goi HTTP noi bo sang IAM Service de tra cuu, va frontend chi resolve ten qua danh sach
  // GET /users da loc theo to chuc nen 1 id "ao" se don gian khong hien ten ai.
  @IsOptional()
  @IsUUID('4', { message: 'ownerUserId phai la UUID hop le' })
  ownerUserId?: string;
}
