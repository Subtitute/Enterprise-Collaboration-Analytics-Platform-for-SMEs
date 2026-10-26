import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, PERMISSIONS } from '@app/common-dto';
import { DocumentSearchService } from './document-search.service';
import { toAccessContext } from '../folders/folder-access.service';
import { SearchChunksDto } from './dto/search-chunks.dto';

/**
 * 24/10/2026: endpoint tim kiem ngu nghia tai lieu (RAG) - CUNG prefix 'files' voi FilesController
 * (mirror cach AiInsightsController dung chung prefix 'analytics' o analytics-service) de khop san
 * nhom route `/api/v1/files` cua Gateway, khong can them prefix moi. Chat bot (analytics-service) goi
 * endpoint nay qua Gateway bang CHINH JWT cua nguoi hoi - quyen DOCUMENT_VIEW + quyen truy cap tung
 * file van ap dung day du.
 */
@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class RagController {
  constructor(private readonly documentSearchService: DocumentSearchService) {}

  @ApiOperation({ summary: 'Tim cac doan tai lieu lien quan nhat toi cau hoi (chi trong tai lieu nguoi goi duoc xem)' })
  @Post('search-chunks')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.DOCUMENT_VIEW)
  searchChunks(@CurrentUser() user: AuthContext, @Body() dto: SearchChunksDto) {
    // 26/10/2026: dung chung toAccessContext() voi Folders/Files controller - chat bot tim tai lieu
    // theo DUNG pham vi du an nhu trang Tai lieu (khong co quy tac rieng cho RAG).
    return this.documentSearchService.search(
      user.organizationId,
      dto,
      toAccessContext(user.userId, user.departmentId, user.permissions),
    );
  }
}
