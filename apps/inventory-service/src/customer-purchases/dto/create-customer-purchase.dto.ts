import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

/**
 * Ghi nhan 1 giao dich "gan mat hang cho khach hang" - Technical_Spec.md muc 22. `warehouseId` TUY
 * CHON: co gia tri nghia la giao dich nay THAT SU tru kho (xem StockService), de trong nghia la chi
 * ghi nhan cho muc dich phan tich xu huong (khong tru kho). `unitPrice` TUY CHON - khong truyen se
 * tu dong lay Product.unitPrice HIEN TAI lam gia snapshot.
 */
export class CreateCustomerPurchaseDto {
  @IsUUID('4', { message: 'customerId phai la UUID hop le' })
  customerId: string;

  @IsUUID('4', { message: 'productId phai la UUID hop le' })
  productId: string;

  @IsOptional()
  @IsUUID('4', { message: 'warehouseId phai la UUID hop le' })
  warehouseId?: string;

  @IsInt({ message: 'So luong phai la so nguyen' })
  @IsPositive({ message: 'So luong phai lon hon 0' })
  quantity: number;

  @IsOptional()
  @IsNumber({}, { message: 'Don gia phai la so' })
  @Min(0, { message: 'Don gia khong duoc am' })
  unitPrice?: number;

  @IsDateString({}, { message: 'Ngay giao dich phai la ngay hop le (ISO-8601)' })
  purchasedAt: string;

  @IsOptional()
  @IsString({ message: 'Ghi chu phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ghi chu khong duoc la chuoi rong' })
  note?: string;
}
