import { Body, Controller, Delete, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, CORRELATION_ID_HEADER, PaginationQueryDto, PERMISSIONS } from '@app/common-dto';
import { ChatbotService, ChatOwner } from './chatbot.service';
import { AskQuestionDto } from './dto/ask-question.dto';

function ownerOf(user: AuthContext): ChatOwner {
  return { userId: user.userId, organizationId: user.organizationId };
}

/**
 * 24/10/2026: Chat bot noi bo (Technical_Spec.md muc 23) - route `/api/v1/chatbot/*` (Gateway them
 * prefix nay vao nhom route analytics, xem apps/gateway/src/proxy/proxy-routes.config.ts). Moi
 * endpoint deu gated `chatbot:use`; pham vi du lieu bot doc duoc van la quyen THAT cua nguoi hoi.
 */
@ApiTags('Chatbot')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.CHATBOT_USE)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @ApiOperation({ summary: 'Tao 1 hoi thoai moi (rong) cua chinh nguoi goi' })
  @Post('conversations')
  createConversation(@CurrentUser() user: AuthContext) {
    return this.chatbotService.createConversation(ownerOf(user));
  }

  @ApiOperation({ summary: 'Lich su hoi thoai cua chinh nguoi goi (moi nhat truoc)' })
  @Get('conversations')
  listConversations(@CurrentUser() user: AuthContext, @Query() query: PaginationQueryDto) {
    return this.chatbotService.listConversations(ownerOf(user), query);
  }

  @ApiOperation({ summary: 'Toan bo tin nhan cua 1 hoi thoai (chi chu so huu)' })
  @Get('conversations/:id/messages')
  listMessages(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.chatbotService.listMessages(ownerOf(user), id);
  }

  @ApiOperation({
    summary:
      'Gui 1 cau hoi, nhan cau tra loi cuoi (khong streaming) - bot tu tra cuu tai lieu/cong viec/cham cong/nghi phep qua Gateway bang JWT cua nguoi hoi',
  })
  @Post('conversations/:id/messages')
  ask(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body() dto: AskQuestionDto,
    // Header Authorization GOC (Bearer JWT nguoi hoi) - http-proxy-middleware cua Gateway chuyen tiep
    // nguyen ven moi header cua client, tool cua bot dung lai chinh header nay de goi nguoc Gateway.
    @Headers('authorization') authorization: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.chatbotService.ask(
      {
        userId: user.userId,
        organizationId: user.organizationId,
        permissions: user.permissions ?? [],
        authorization: authorization ?? '',
        correlationId,
      },
      id,
      dto.question,
    );
  }

  @ApiOperation({ summary: 'Xoa 1 hoi thoai (chi chu so huu), kem toan bo tin nhan' })
  @Delete('conversations/:id')
  deleteConversation(@CurrentUser() user: AuthContext, @Param('id') id: string) {
    return this.chatbotService.deleteConversation(ownerOf(user), id);
  }
}
