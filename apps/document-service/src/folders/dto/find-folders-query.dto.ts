// 22/07/2026: file moi - Fix 5 (code review). Xem giai thich day du o
// apps/document-service/src/files/dto/find-files-query.dto.ts (cung 1 van de, cung 1 cach xu ly).
import { IsUUID, ValidateIf } from 'class-validator';

/**
 * Query cho `GET /folders`. `parentFolderId` truoc ban sua nay duoc doc tho qua
 * `@Query('parentFolderId') parentFolderId?: string` - khong qua buoc validate nao truoc khi di
 * thang toi dieu kien loc tren cot UUID (`Folder.parentFolderId`), nen 1 gia tri rac (vd "abc")
 * se lam TypeORM nem loi Postgres tho, bi AllExceptionsFilter bat lai thanh 1 loi 500 chung
 * chung thay vi 400 sach.
 *
 * `parentFolderId` CO THE la '' (chuoi rong) - day la quy uoc HOP LE dang duoc dung dong nhat voi
 * `FilesController`/`FindFilesQueryDto`, nghia la "thu muc goc" (xem FoldersService.findAll:
 * `parentFolderId ? parentFolderId : IsNull()`). Vi vay KHONG dung don thuan
 * `@IsOptional() @IsUUID()` (chi bo qua validate khi gia tri la `undefined`/`null`, KHONG bo qua
 * voi chuoi rong). Dung `@ValidateIf` de bo qua validate ca voi `undefined` LAN chuoi rong, chi
 * validate UUID khi co gia tri thuc su.
 */
export class FindFoldersQueryDto {
  @ValidateIf((_dto, value) => value !== undefined && value !== '')
  @IsUUID('4', { message: 'parentFolderId phai la UUID hop le' })
  parentFolderId?: string;
}
