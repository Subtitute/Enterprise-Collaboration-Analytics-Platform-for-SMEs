import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, NotEquals } from 'class-validator';
import { StockMovementType } from '@app/common-dto';

/**
 * Ghi 1 bien dong kho (nhap/xuat/dieu chinh) - Technical_Spec.md muc 22.
 * `quantityDelta` KHONG duoc = 0 (khong co y nghia nghiep vu). Rang buoc DAU theo `type` (IN phai
 * duong, OUT phai am) duoc kiem tra o StockService.recordMovementInTransaction() - khong the bieu
 * dien bang decorator class-validator don gian (phu thuoc lien truong).
 */
export class CreateStockMovementDto {
  @IsUUID('4', { message: 'warehouseId phai la UUID hop le' })
  warehouseId: string;

  @IsUUID('4', { message: 'productId phai la UUID hop le' })
  productId: string;

  @IsEnum(StockMovementType, { message: 'type phai la mot trong IN/OUT/ADJUSTMENT' })
  type: StockMovementType;

  @IsInt({ message: 'quantityDelta phai la so nguyen' })
  @NotEquals(0, { message: 'quantityDelta khong duoc bang 0' })
  quantityDelta: number;

  @IsOptional()
  @IsString({ message: 'Ghi chu phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ghi chu khong duoc la chuoi rong' })
  note?: string;
}
