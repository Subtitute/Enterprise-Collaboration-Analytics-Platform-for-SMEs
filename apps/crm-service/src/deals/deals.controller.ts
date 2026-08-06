import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { UpdateDealStageDto } from './dto/update-deal-stage.dto';
import { DealQueryDto } from './dto/deal-query.dto';

/** Quan ly co hoi ban hang / Kanban pipeline ban hang - Technical_Spec.md muc 16, Wireframe.md muc 12. */
@ApiTags('Deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DEAL_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: DealQueryDto) {
    return this.dealsService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DEAL_VIEW)
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.dealsService.findById(organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEAL_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateDealDto,
  ) {
    return this.dealsService.create(organizationId, actorId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEAL_UPDATE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.update(organizationId, id, dto);
  }

  /**
   * Keo-tha giua cac cot Kanban pipeline ban hang (Wireframe.md muc 12) - endpoint quan trong
   * nhat de minh hoa pipeline: HTTP -> Outbox (cung transaction) -> OutboxPublisherJob -> Kafka.
   */
  @Patch(':id/stage')
  @RequirePermissions(PERMISSIONS.DEAL_UPDATE)
  updateStage(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealStageDto,
  ) {
    return this.dealsService.updateStage(organizationId, id, actorId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DEAL_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.dealsService.remove(organizationId, actorId, id);
  }
}
