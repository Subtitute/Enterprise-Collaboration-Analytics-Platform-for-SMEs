// 22/07/2026: file moi - Fix 5 (code review).
import { IsUUID, ValidateIf } from 'class-validator';
import { PaginationQueryDto } from '@app/common-dto';

/**
 * Query cho `GET /files` - gop `folderId` (loc theo thu muc) vao CUNG 1 DTO voi phan trang
 * (cung pattern voi `TaskQueryDto` cua project-task-service). Truoc ban sua nay, `folderId` duoc
 * doc tho qua `@Query('folderId') folderId: string | undefined` - khong qua buoc validate nao
 * truoc khi di thang toi dieu kien loc tren cot UUID (`FileMeta.folderId`), nen 1 gia tri rac
 * (vd "abc") se lam TypeORM nem loi Postgres tho, bi AllExceptionsFilter bat lai thanh 1 loi 500
 * chung chung thay vi 400 sach.
 *
 * `folderId` CO THE la '' (chuoi rong) - day la quy uoc HOP LE, nghia la "thu muc goc" (xem
 * FilesService.findAll: `folderId ? folderId : IsNull()`, va apps/web/src/features/documents/
 * api.ts#fetchFiles truyen `folderId: folderId ?? ''` - dung theo dung ky hieu "folderId=" trong
 * contract API). Vi vay KHONG dung don thuan `@IsOptional() @IsUUID()` (chi bo qua validate khi
 * gia tri la `undefined`/`null`, KHONG bo qua voi chuoi rong - se lam hong dung truong hop
 * "thu muc goc" dang hoat dong). Dung `@ValidateIf` de bo qua validate ca voi `undefined` LAN
 * chuoi rong, chi validate UUID khi co gia tri thuc su.
 */
export class FindFilesQueryDto extends PaginationQueryDto {
  @ValidateIf((_dto, value) => value !== undefined && value !== '')
  @IsUUID('4', { message: 'folderId phai la UUID hop le' })
  folderId?: string;
}
