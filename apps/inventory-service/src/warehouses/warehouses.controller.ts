import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseQueryDto } from './dto/warehouse-query.dto';

/** Quan ly kho hang - Technical_Spec.md muc 22. */
@ApiTags('Warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.WAREHOUSE_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: WarehouseQueryDto) {
    return this.warehousesService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_VIEW)
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.warehousesService.findById(organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.WAREHOUSE_MANAGE)
  create(@CurrentUser('organizationId') organizationId: string, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_MANAGE)
  update(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.WAREHOUSE_MANAGE)
  remove(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.warehousesService.remove(organizationId, id);
  }
}
