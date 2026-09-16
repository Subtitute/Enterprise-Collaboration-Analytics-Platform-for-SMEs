import { IsDateString, IsOptional } from 'class-validator';

/**
 * Loc muc lich theo khoang thoi gian dang xem (vd 1 thang tren luoi lich) - KHONG phan trang
 * (khac da so query DTO khac trong repo): so muc lich/1 to chuc/1 khoang thoi gian hop ly (vai
 * chuc ngay le/su kien) qua nho de can phan trang, va giao dien luoi lich can tai TRON VEN 1
 * khoang thoi gian cung luc, khong hop voi phan trang theo so dong. De trong ca 2 field = tra ve
 * TOAN BO muc lich cua to chuc (chap nhan duoc o quy mo do an - xem CalendarEventsService.findAll()).
 */
export class CalendarEventQueryDto {
  @IsOptional()
  @IsDateString({}, { message: 'Ngay bat dau loc phai la ngay hop le (ISO-8601)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngay ket thuc loc phai la ngay hop le (ISO-8601)' })
  endDate?: string;
}
