import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { StockService } from './stock.service';
import { StockQueryDto } from './dto/stock-query.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';

/** Ton kho + lich su nhap/xuat/dieu chinh kho - Technical_Spec.md muc 22. */
@ApiTags('Stock')
@ApiBearerAuth()
@Controller()
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('stock')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_VIEW)
  findStock(@CurrentUser('organizationId') organizationId: string, @Query() query: StockQueryDto) {
    return this.stockService.findStock(organizationId, query);
  }

  @Get('stock-movements')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_VIEW)
  findMovements(@CurrentUser('organizationId') organizationId: string, @Query() query: StockMovementQueryDto) {
    return this.stockService.findMovements(organizationId, query);
  }

  @Post('stock-movements')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_MANAGE)
  createMovement(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stockService.createMovement(organizationId, actorId, dto);
  }
}
