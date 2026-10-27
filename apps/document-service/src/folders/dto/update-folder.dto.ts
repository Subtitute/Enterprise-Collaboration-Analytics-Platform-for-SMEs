import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { FolderVisibility } from '../../entities/folder.entity';

export class UpdateFolderDto {
  // 28/07/2026: sua loi doi chieu hop dong - `name` truoc day BAT BUOC tren MOI lan PATCH (dung
  // cho muc dich doi-ten ban dau, luc entity nay chua co truong nao khac). Sau khi bo sung
  // `visibility` (nang cap kiem soat truy cap), 1 lan PATCH CHI doi visibility (khong doi ten) se
  // bi 400 "name should not be empty" ngay tai tang validate - dung ngu nghia PATCH la chi can
  // gui truong MUON doi. Chuyen `name` sang optional; FoldersService.update() chi gan lai
  // `folder.name` khi truong nay THUC SU duoc truyen (xem ben duoi).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  // 28/07/2026: truong moi - cho phep doi che do hien thi thu muc (kiem soat truy cap opt-in).
  // Optional: PATCH khong dong cham visibility neu khong truyen. Ai duoc phep DAT truong nay
  // (chi nguoi tao thu muc hoac Org Admin) duoc kiem tra o FoldersService.update(), khong phai o
  // DTO nay - DTO chi validate HINH DANG du lieu.
  @IsOptional()
  @IsEnum(FolderVisibility)
  visibility?: FolderVisibility;

  // 26/10/2026: doi du an cua thu muc CAP GOC. `null` = chuyen thanh thu muc toan cong ty (chi Org
  // Admin); khong gui = giu nguyen. @IsOptional bo qua ca null nen null di qua duoc toi service.
  @IsOptional()
  @IsUUID('4', { message: 'projectId phai la UUID hop le' })
  projectId?: string | null;
}
