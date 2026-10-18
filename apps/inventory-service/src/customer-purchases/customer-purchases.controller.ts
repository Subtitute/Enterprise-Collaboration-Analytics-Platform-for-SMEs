import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { CustomerPurchasesService } from './customer-purchases.service';
import { CreateCustomerPurchaseDto } from './dto/create-customer-purchase.dto';
import { UpdateCustomerPurchaseDto } from './dto/update-customer-purchase.dto';
import { CustomerPurchaseQueryDto } from './dto/customer-purchase-query.dto';

/** "Gan mat hang cho khach hang" - Technical_Spec.md muc 22. */
@ApiTags('Customer Purchases')
@ApiBearerAuth()
@Controller('customer-purchases')
export class CustomerPurchasesController {
  constructor(private readonly purchasesService: CustomerPurchasesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMER_PURCHASE_VIEW)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @CurrentUser('permissions') callerPermissions: string[],
    @Query() query: CustomerPurchaseQueryDto,
  ) {
    return this.purchasesService.findAll(organizationId, query, callerId, callerPermissions);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_PURCHASE_VIEW)
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @CurrentUser('permissions') callerPermissions: string[],
    @Param('id') id: string,
  ) {
    return this.purchasesService.findById(organizationId, id, callerId, callerPermissions);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMER_PURCHASE_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateCustomerPurchaseDto,
  ) {
    return this.purchasesService.create(organizationId, actorId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_PURCHASE_UPDATE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @CurrentUser('permissions') callerPermissions: string[],
    @Param('id') id: string,
    @Body() dto: UpdateCustomerPurchaseDto,
  ) {
    return this.purchasesService.update(organizationId, id, dto, callerId, callerPermissions);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_PURCHASE_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.purchasesService.remove(organizationId, actorId, id);
  }
}
