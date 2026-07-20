import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PaginationQueryDto, PERMISSIONS } from '@app/common-dto';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Quan tri > Thanh vien - Wireframe.md muc 8. */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: PaginationQueryDto) {
    return this.usersService.findAll(organizationId, query);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.usersService.findById(organizationId, id);
  }

  @Post('invite')
  @RequirePermissions(PERMISSIONS.USER_INVITE)
  invite(@CurrentUser('organizationId') organizationId: string, @Body() dto: InviteUserDto) {
    return this.usersService.invite(organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(organizationId, id, dto);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  deactivate(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.usersService.deactivate(organizationId, id, actorId);
  }
}
