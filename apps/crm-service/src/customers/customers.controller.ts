import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { AuthContext, PERMISSIONS } from '@app/common-dto';
import { toScopeCaller } from '../user-directory/user-directory';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';

/** Quan ly khach hang (CRM-lite) - Technical_Spec.md muc 16, Wireframe.md muc 12. */
@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMER_VIEW)
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    // 17/09/2026: can them userId/permissions cua nguoi goi de CustomersService.findAll() gioi han
    // Employee chi thay khach hang minh phu trach (xem chu thich tai service).
    @CurrentUser('userId') callerId: string,
    @CurrentUser('permissions') callerPermissions: string[],
    @Query() query: CustomerQueryDto,
    // 26/10/2026: phong ban cua nguoi goi (JWT) - Manager thay khach hang cua phong ban minh.
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.customersService.findAll(organizationId, query, callerId, callerPermissions, departmentId ?? null);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_VIEW)
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @CurrentUser('permissions') callerPermissions: string[],
    @Param('id') id: string,
    // 26/10/2026: xem findAll() o tren.
    @CurrentUser('departmentId') departmentId: string | null,
  ) {
    return this.customersService.findById(organizationId, id, callerId, callerPermissions, departmentId ?? null);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMER_CREATE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(organizationId, actorId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_UPDATE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    // 26/10/2026: chi sua khach hang nam trong pham vi xem cua nguoi goi.
    @CurrentUser() caller: AuthContext,
  ) {
    return this.customersService.update(organizationId, id, dto, toScopeCaller(caller));
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMER_DELETE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    // 26/10/2026: chi xoa khach hang nam trong pham vi xem cua nguoi goi.
    @CurrentUser() caller: AuthContext,
  ) {
    return this.customersService.remove(organizationId, actorId, id, toScopeCaller(caller));
  }
}
