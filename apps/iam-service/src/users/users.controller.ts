import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { ERROR_CODES, PaginationQueryDto, PERMISSIONS } from '@app/common-dto';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
// 25/07/2026: pipe dung chung validate :id la UUID hop le truoc khi cham toi DB - xem chu thich
// chi tiet trong common/uuid-param.pipe.ts (loi MINOR, review 25/07/2026).
import { uuidParamPipe } from '../common/uuid-param.pipe';

/** Quan tri > Thanh vien - Wireframe.md muc 8. */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 22/07/2026: CO CHU DICH KHONG gan @RequirePermissions(USER_MANAGE) o day, KHAC voi yeu cau
  // ban dau cua review (vi Wireframe.md muc 8 goi day la man hinh Quan tri > Thanh vien). Da kiem
  // tra ky frontend (grep apps/web/src/**) va phat hien GET /users con la nguon du lieu NEN TANG
  // cho apps/web/src/hooks/useOrgUsers.ts (fetchAllUsers()/useOrgUsersQuery()/useUserNameMap()) -
  // dung o RAT NHIEU man hinh KHONG PHAI admin, ma MOI nhan vien da xac thuc deu vao duoc ngay sau
  // khi dang nhap: Dashboard (RecentActivityFeed - route /dashboard, KHONG co requireAdmin trong
  // App.tsx), AssigneePicker/TaskCard/TaskDetailModal (chon/hien ten nguoi phu trach cong viec -
  // can TASK_VIEW/TASK_CREATE, khong can USER_MANAGE), ShareModal (chia se tai lieu - can
  // DOCUMENT_SHARE), va tim kiem tong hop o Topbar (useGlobalSearch). Neu gan USER_MANAGE (chi
  // role Org Admin co, xem DEFAULT_ROLE_PERMISSIONS trong @app/common-dto) thi Manager va Employee
  // - da so nguoi dung thuc te - se bi 403 ngay tren trang Dashboard va hang loat man hinh
  // Du an/Cong viec/Tai lieu co ban, mot regression nghiem trong hon chinh lo hong dang sua. Vi
  // vay ap dung dung nguyen tac da dung cho GET /departments (xem departments.controller.ts): de
  // mo cho moi nguoi dung da xac thuc trong to chuc thay vi gan sai guard chi-quan-tri roi lam vo
  // hieu phan lon ung dung - xem bao cao cuoi cung ve quyet dinh lech khoi yeu cau review ban dau
  // nay va de xuat theo doi (vd tach 1 permission "doc danh ba" rieng, hoac 1 endpoint roster gon
  // hon chi tra id/fullName, thay vi toan bo PublicUser bao gom isActive/roles/departmentId).
  // findOne() (:id) ben duoi van duoc sua dung nhu yeu cau (tu-xem HOAC user:manage) - do moi la
  // hanh vi review thuc su lo ngai ("doc ho so DAY DU cua BAT KY dong nghiep nao qua ID").
  @Get()
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: PaginationQueryDto) {
    return this.usersService.findAll(organizationId, query);
  }

  // 22/07/2026: truoc day endpoint nay cung hoan toan khong co guard - bat ky nhan vien da xac
  // thuc nao (khac phong ban, khac vai tro) deu doc duoc ho so day du cua BAT KY dong nghiep nao
  // chi can biet id, vuot xa y dinh ban dau cua tinh nang Ho so ca nhan (bo sung 22/07/2026, xem
  // Technical_Spec.md changelog "Trang Ho so ca nhan"): "moi thanh vien tu xem duoc CHINH MINH",
  // khong phai "xem duoc BAT KY AI". Khong dung @RequirePermissions don thuan duoc vi can bieu
  // thi dieu kien "id === chinh minh HOAC co quyen user:manage" (OR) - PermissionsGuard
  // (packages/common-guard, ngoai pham vi sua o day) chi ho tro kiem tra AND cac permission khai
  // bao san tren decorator, khong co co che OR voi 1 dieu kien tuy bien nhu "la chinh chu". Vi vay
  // tu kiem tra thu cong trong handler: cho qua neu :id trung voi nguoi goi (tu-xem, dung cho
  // trang Ho so ca nhan) HOAC nguoi goi co quyen user:manage (dung cho Quan tri > Thanh vien xem
  // ho so nguoi khac); nguoc lai 403.
  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') callerId: string,
    @CurrentUser('permissions') callerPermissions: string[],
    // 25/07/2026: them uuidParamPipe() de tra 400 Vietnamese ro rang khi :id sai dinh dang, thay
    // vi de QueryFailedError tho tu Postgres roi xuong 500 chung chung (loi MINOR, review
    // 25/07/2026) - xem chu thich chi tiet trong common/uuid-param.pipe.ts.
    @Param('id', uuidParamPipe()) id: string,
  ) {
    const isSelf = id === callerId;
    const canManageUsers = (callerPermissions ?? []).includes(PERMISSIONS.USER_MANAGE);
    if (!isSelf && !canManageUsers) {
      throw new ForbiddenException({
        message: 'Ban chi co the xem ho so cua chinh minh',
        errorCode: ERROR_CODES.FORBIDDEN_SELF_PROFILE_ONLY,
      });
    }
    return this.usersService.findById(organizationId, id);
  }

  @Post('invite')
  @RequirePermissions(PERMISSIONS.USER_INVITE)
  invite(
    @CurrentUser('organizationId') organizationId: string,
    // 25/07/2026: RBAC bypass CRITICAL - can permissions cua nguoi goi de UsersService.invite()
    // tu quyet dinh co cho phep dto.roleIds duoc ap dung hay khong (chi user:manage moi duoc cap
    // vai tro cho thanh vien moi) - xem chu thich chi tiet trong users.service.ts invite().
    @CurrentUser('permissions') callerPermissions: string[],
    @Body() dto: InviteUserDto,
  ) {
    return this.usersService.invite(organizationId, dto, callerPermissions ?? []);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    // 25/07/2026: cung ly do voi invite() o tren - truyen tiep permissions cho lop chan phong thu
    // chieu sau trong UsersService.update() (dto.roleIds).
    @CurrentUser('permissions') callerPermissions: string[],
    @Param('id', uuidParamPipe()) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(organizationId, id, dto, callerPermissions ?? []);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  deactivate(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id', uuidParamPipe()) id: string,
  ) {
    return this.usersService.deactivate(organizationId, id, actorId);
  }

  // 22/07/2026: endpoint moi - truoc day khong co cach nao kich hoat lai 1 tai khoan da bi
  // deactivate() ngoai thao tac tay truc tiep tren DB (Quan tri > Thanh vien chi co nut "Vo hieu
  // hoa", khong co chieu nguoc lai). Cung quyen voi deactivate() (user:manage). Khong phat outbox
  // event - packages/common-dto EVENT_TYPES chua co entry USER_REACTIVATED tuong ung va viec them
  // event type moi + xu ly o 3 service tieu thu (Notification/Analytics/...) nam ngoai pham vi
  // apps/iam-service/src/** cua fix nay (xem bao cao cuoi cung).
  @Patch(':id/reactivate')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  reactivate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', uuidParamPipe()) id: string,
  ) {
    return this.usersService.reactivate(organizationId, id);
  }
}
