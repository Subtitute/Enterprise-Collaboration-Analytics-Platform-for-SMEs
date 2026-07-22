import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query phan trang chuan - Technical_Spec.md muc 7 (Quy uoc thiet ke API). */
export class PaginationQueryDto {
  // 22/07/2026: bo sung @Max - phat hien qua code review toan du an: truoc day "page" khong co
  // tran tren, mot request nhu page=999999999&limit=500 van qua duoc class-validator va bien
  // thanh OFFSET khong lo trong MOI cau query danh sach o ca 6 service (mau paginate()/
  // skip: (query.page - 1) * query.limit) - DB phai quet/bo qua hang trieu dong truoc khi tra
  // ve 0 ket qua, de bi loi dung de lam qua tai DB (DoS). Chon 100000: du lon de khong SME nao
  // (quy mo ~10-200 nhan su, xem General_idea.md muc 7) that su phan trang toi trang nay, nhung
  // du nho de chan worst-case OFFSET (voi limit toi da 500 -> offset toi da ~50 trieu dong).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  // 22/07/2026: nang tran tu 100 len 500 - phat hien qua kiem thu thuc te: nhieu man hinh
  // frontend (danh sach du an/nhan vien/task/thu muc/tep, picker chon nguoi phu trach...) chu
  // dong goi limit=200/500 de lay "toan bo" du lieu 1 lan (quy mo SME ~10-200 nhan su, xem
  // General_idea.md muc 7), tran cu 100 khien class-validator tu choi ngay voi 400 Bad Request
  // truoc khi request cham toi tang nghiep vu - gay hang loat man hinh trong/khong tai duoc.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 20;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return { data, meta: { page, limit, total } };
}
