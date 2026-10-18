import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Sua giao dich - CHI cho sua `note`/`purchasedAt` (metadata), KHONG cho sua quantity/unitPrice/
 * product/warehouse sau khi da tao. Quyet dinh thiet ke CO CHU DICH: cac truong do anh huong truc
 * tiep den ton kho (neu co warehouseId) va du lieu phan tich xu huong da phat su kien - cho phep
 * sua tu do se can logic "dao nguoc bien dong kho cu + ap dung bien dong moi" phuc tap va rui ro
 * hon nhieu so voi loi ich (mirror tinh than toi gian - ClaudeRule.md muc 8). Giao dich sai thuc
 * su (sai san pham/so luong) nen XOA va TAO LAI (xoa se tu hoan tac dung ton kho - xem
 * CustomerPurchasesService.remove()), khong sua tai cho.
 */
export class UpdateCustomerPurchaseDto {
  @IsOptional()
  @IsDateString({}, { message: 'Ngay giao dich phai la ngay hop le (ISO-8601)' })
  purchasedAt?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chu phai la chuoi ky tu' })
  @IsNotEmpty({ message: 'Ghi chu khong duoc la chuoi rong' })
  note?: string;
}
