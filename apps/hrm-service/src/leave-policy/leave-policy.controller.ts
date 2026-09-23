import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { LeavePolicyService } from './leave-policy.service';
import { UpdateLeavePolicyDto } from './dto/update-leave-policy.dto';

/** Chinh sach nghi phep (so ngay phep co ban + tham nien) - HRM-lite mo rong (bo sung 22/09/2026). */
@ApiTags('LeavePolicy')
@ApiBearerAuth()
@Controller('leave-policy')
export class LeavePolicyController {
  constructor(private readonly leavePolicyService: LeavePolicyService) {}

  /** Khong yeu cau permission dac biet - moi nhan vien deu can biet chinh sach de hieu so du phep cua minh. */
  @Get()
  findOne(@CurrentUser('organizationId') organizationId: string) {
    return this.leavePolicyService.getOrCreate(organizationId);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.ORG_MANAGE)
  update(@CurrentUser('organizationId') organizationId: string, @Body() dto: UpdateLeavePolicyDto) {
    return this.leavePolicyService.update(organizationId, dto);
  }
}
