import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { FoldersService } from './folders.service';
// 28/07/2026: kieu ngu canh dung chung (kiem soat truy cap thu muc, opt-in) - xem folder-access.service.ts.
// 26/10/2026: toAccessContext() - dung chung voi Files/Rag controller (them co Manager theo phong ban).
import { AccessContext, toAccessContext } from './folder-access.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CreateFolderShareDto } from './dto/create-folder-share.dto';
// 22/07/2026: Fix 5 (code review) - DTO validate UUID cho query `parentFolderId`.
import { FindFoldersQueryDto } from './dto/find-folders-query.dto';

/** Module Tai lieu - Wireframe.md muc 5. */
@ApiTags('Folders')
@ApiBearerAuth()
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  // 28/07/2026: dung chung o moi endpoint can quyet dinh "nguoi goi co phai Org Admin khong" -
  // mirror pattern `canManageUsers` cua UsersController (iam-service): doc truc tiep tu mang
  // `permissions` cua AuthContext, KHONG goi service nao khac. Org Admin (PERMISSIONS.ORG_MANAGE)
  // luon "thay duoc moi thu" trong cac quy tac kiem soat truy cap thu muc RESTRICTED ben duoi.
  private buildAccessContext(userId: string, departmentId: string | null, permissions: string[]): AccessContext {
    return toAccessContext(userId, departmentId, permissions);
  }

  // 26/10/2026: du an nguoi goi gan/xem duoc tai lieu - bo chon du an khi tao/doi thu muc o FE.
  // Khai bao TRUOC cac route ':id/...' de khong bi hieu nham la 1 id thu muc.
  @Get('accessible-projects')
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  listAccessibleProjects(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
  ) {
    return this.foldersService.listAccessibleProjects(organizationId, this.buildAccessContext(userId, departmentId, permissions));
  }

  // 22/07/2026: Fix 3 (code review) - bo sung @RequirePermissions con thieu. Day la endpoint DOC
  // DUY NHAT trong toan bo Document Service (ca FilesController lan cac endpoint con lai cua
  // chinh FoldersController) khong kiem tra quyen, cho phep BAT KY user da dang nhap (bat ke co
  // duoc gan quyen DOCUMENT_VIEW hay khong) liet ke toan bo cay thu muc cua to chuc.
  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    // 28/07/2026: bo sung userId/departmentId/permissions - can de xay AccessContext, loc bo cac
    // thu muc RESTRICTED nguoi goi khong xem duoc (kiem soat truy cap thu muc, opt-in).
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    // 22/07/2026: Fix 5 (code review) - doi sang DTO co validate UUID (xem giai thich day du o
    // dto/find-folders-query.dto.ts), thay vi doc tho `@Query('parentFolderId')`.
    @Query() query: FindFoldersQueryDto,
  ) {
    return this.foldersService.findAll(
      organizationId,
      query.parentFolderId,
      this.buildAccessContext(userId, departmentId, permissions),
    );
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    // 24/10/2026: kiem tra quyen truy cap thu muc cha - xem FoldersService.create().
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Body() dto: CreateFolderDto,
  ) {
    return this.foldersService.create(organizationId, actorId, dto, this.buildAccessContext(actorId, departmentId, permissions));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_UPLOAD)
  update(
    @CurrentUser('organizationId') organizationId: string,
    // 28/07/2026: bo sung userId/departmentId/permissions - can de kiem tra quyen truy cap thu
    // muc VA quyen doi visibility (chi nguoi tao/Org Admin) trong FoldersService.update().
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.update(organizationId, id, dto, this.buildAccessContext(userId, departmentId, permissions));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENT_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    // 28/07/2026: bo sung departmentId/permissions - can de kiem tra quyen truy cap thu muc truoc
    // khi cho xoa (kiem soat truy cap thu muc, opt-in).
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') id: string,
  ) {
    return this.foldersService.remove(
      organizationId,
      actorId,
      id,
      this.buildAccessContext(actorId, departmentId, permissions),
    );
  }

  // 28/07/2026: 3 endpoint moi - quan ly chia se thu muc RESTRICTED (kiem soat truy cap tai lieu
  // theo thu muc, opt-in). Dung chung PERMISSIONS.DOCUMENT_SHARE voi endpoint chia se file da co
  // san (`POST /files/:id/share`) - cung ban chat hanh dong "chia se". Han che THUC SU (chi nguoi
  // tao thu muc/Org Admin) duoc kiem tra sau, o tang service.
  @Post(':id/shares')
  @RequirePermissions(PERMISSIONS.DOCUMENT_SHARE)
  createShare(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') folderId: string,
    @Body() dto: CreateFolderShareDto,
  ) {
    return this.foldersService.createShare(
      organizationId,
      folderId,
      this.buildAccessContext(userId, departmentId, permissions),
      dto,
    );
  }

  @Get(':id/shares')
  @RequirePermissions(PERMISSIONS.DOCUMENT_SHARE)
  listShares(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') folderId: string,
  ) {
    return this.foldersService.listShares(organizationId, folderId, this.buildAccessContext(userId, departmentId, permissions));
  }

  @Delete(':id/shares/:shareId')
  @RequirePermissions(PERMISSIONS.DOCUMENT_SHARE)
  removeShare(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('departmentId') departmentId: string | null,
    @CurrentUser('permissions') permissions: string[],
    @Param('id') folderId: string,
    @Param('shareId') shareId: string,
  ) {
    return this.foldersService.removeShare(
      organizationId,
      folderId,
      shareId,
      this.buildAccessContext(userId, departmentId, permissions),
    );
  }
}
