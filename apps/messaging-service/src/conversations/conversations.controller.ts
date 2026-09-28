import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateParticipantsDto } from './dto/update-participants.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';

/** Nhan tin noi bo 1:1 va nhom/kenh giua cac thanh vien cung to chuc. */
@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.MESSAGE_SEND)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.create(organizationId, callerId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.MESSAGE_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @CurrentUser('userId') callerId: string) {
    return this.conversationsService.findAllForUser(organizationId, callerId);
  }

  @Get(':id/messages')
  @RequirePermissions(PERMISSIONS.MESSAGE_VIEW)
  listMessages(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @Param('id') id: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagesService.listMessages(organizationId, id, callerId, query.limit, query.beforeMessageId);
  }

  @Post(':id/messages')
  @RequirePermissions(PERMISSIONS.MESSAGE_SEND)
  sendMessage(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(organizationId, id, callerId, dto);
  }

  // Khong nam trong dac ta REST goc (6 endpoint) - bo sung de Message.deletedAt (bat buoc theo mo
  // hinh du lieu, xem messages.service.ts:deleteMessage) thuc su co 1 duong dan duoc ghi.
  @Delete(':id/messages/:messageId')
  @RequirePermissions(PERMISSIONS.MESSAGE_SEND)
  deleteMessage(
    @CurrentUser('userId') callerId: string,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessage(id, messageId, callerId);
  }

  @Patch(':id/read')
  @RequirePermissions(PERMISSIONS.MESSAGE_VIEW)
  markRead(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @Param('id') id: string,
  ) {
    return this.conversationsService.markRead(organizationId, id, callerId);
  }

  // Gate o day CHI la MESSAGE_VIEW (quyen nhan tin co ban) - dieu kien that su ("chi createdBy HOAC
  // nguoi giu MESSAGE_MANAGE_GROUP") la 1 dieu kien OR khong bieu dien duoc bang @RequirePermissions,
  // duoc kiem tra rieng trong ConversationsService.updateParticipants().
  @Patch(':id/participants')
  @RequirePermissions(PERMISSIONS.MESSAGE_VIEW)
  updateParticipants(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @CurrentUser('permissions') callerPermissions: string[],
    @Param('id') id: string,
    @Body() dto: UpdateParticipantsDto,
  ) {
    return this.conversationsService.updateParticipants(organizationId, id, callerId, callerPermissions, dto);
  }
}
