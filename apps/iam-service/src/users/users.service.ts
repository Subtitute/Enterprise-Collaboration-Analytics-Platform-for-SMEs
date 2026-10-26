import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Department } from '../entities/department.entity';
import { OutboxService } from '../outbox/outbox.service';
import { RedisService } from '../redis/redis.service';
import { parseDurationMs } from '../auth/auth.service';
import { isPostgresUniqueViolation } from '../common/db-errors.util';
import {
  ERROR_CODES,
  EVENT_TYPES,
  PaginatedResponse,
  PaginationQueryDto,
  PERMISSIONS,
  UserDeactivatedPayload,
  UserDeletedPayload,
  UserDepartmentChangedPayload,
  UserRegisteredPayload,
  paginate,
  // 26/10/2026: danh ba 3 cap (xem findAll()).
  resolveDataScope,
} from '@app/common-dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  departmentId: string | null;
  isActive: boolean;
  roles: { id: string; name: string }[];
  createdAt: Date;
}

/** 26/10/2026: "the danh ba" - ten/phong ban (+ email lien lac) cua nguoi ngoai pham vi xem ho so day du. */
export type DirectoryCard = Pick<PublicUser, 'id' | 'email' | 'fullName' | 'departmentId' | 'isActive'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    // 22/07/2026: bo sung inject Department repo - can de xac thuc departmentId thuoc dung to
    // chuc cua nguoi goi truoc khi gan cho user (xem invite()/update() ben duoi), giong het cach
    // roleIds da duoc kiem tra qua roleRepo.find({ where: { id: In(...), organizationId } }).
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    private readonly outboxService: OutboxService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 26/10/2026: danh ba 3 cap - truoc day MOI nguoi da xac thuc nhan ho so DAY DU (vai tro, ngay vao
   * lam...) cua toan to chuc. Nay: Org Admin (USER_MANAGE) - day du moi nguoi; Manager (USER_INVITE +
   * co phong ban) - day du chinh minh + thanh vien phong ban minh; con lai - day du chinh minh. Nguoi
   * ngoai pham vi chi con "the danh ba" (DirectoryCard) du de chon nguoi giao viec/chia se/nhan tin.
   * GIU `email` trong the danh ba: la dinh danh lien lac cong viec dang duoc moi picker (giao viec,
   * chia se tai lieu, nhan tin) dung de tim kiem/hien thi (nhieu noi goi thang u.email.toLowerCase()).
   * `caller` tuy chon (goi noi bo/test cu khong truyen = day du nhu truoc).
   */
  async findAll(
    organizationId: string,
    query: PaginationQueryDto,
    caller?: { userId: string; permissions: string[]; departmentId: string | null },
  ): Promise<PaginatedResponse<PublicUser | DirectoryCard>> {
    const [data, total] = await this.userRepo.findAndCount({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    const scope = caller ? resolveDataScope(caller.permissions, PERMISSIONS.USER_INVITE, caller.departmentId) : 'organization';
    const isFullProfile = (u: User) =>
      scope === 'organization' ||
      u.id === caller?.userId ||
      (scope === 'department' && (u.departmentId ?? null) === caller?.departmentId);
    return paginate(
      data.map((u) => (isFullProfile(u) ? this.toPublicUser(u) : this.toDirectoryCard(u))),
      total,
      query.page,
      query.limit,
    );
  }

  async findById(organizationId: string, id: string): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });
    return this.toPublicUser(user);
  }

  /** 26/10/2026: Manager xem ho so day du cua thanh vien CUNG phong ban (GET /users/:id) - ngoai phong ban -> 403. */
  async findByIdInDepartment(organizationId: string, id: string, departmentId: string): Promise<PublicUser> {
    const user = await this.findById(organizationId, id);
    if (user.departmentId !== departmentId) {
      throw new ForbiddenException({
        message: 'Ban chi xem duoc ho so day du cua thanh vien phong ban minh',
        errorCode: ERROR_CODES.DEPARTMENT_SCOPE_FORBIDDEN,
      });
    }
    return user;
  }

  async invite(
    organizationId: string,
    dto: InviteUserDto,
    callerPermissions: string[],
  ): Promise<PublicUser> {
    // 25/08/2026: fix ra soat bao mat - chuan hoa email (trim + chu thuong) TRUOC kiem tra trung,
    // cung ly do voi AuthService.registerOrganization() (xem comment tai do) - tranh tao duoc 2
    // tai khoan nhin-giong-het nhau chi khac hoa/thuong (vd "Bob@Corp.vn" vs "bob@corp.vn").
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.userRepo.findOne({ where: { email: normalizedEmail } });
    if (existing) throw new ConflictException({ message: 'Email da duoc su dung', errorCode: ERROR_CODES.EMAIL_ALREADY_USED });

    // 25/07/2026: RBAC bypass CRITICAL (review 25/07/2026) - truoc day dto.roleIds duoc gan THANG
    // cho user moi ma KHONG kiem tra nguoi goi co duoc phep cap NHUNG vai tro do hay khong.
    // Endpoint POST /users/invite chi doi hoi quyen user:invite (Manager mac dinh CO quyen nay -
    // xem DEFAULT_ROLE_PERMISSIONS trong packages/common-dto), trong khi user:manage (quyen thuc
    // su dai dien cho "duoc quan tri vai tro/nguoi dung", dung de gate PATCH /users/:id ngay ben
    // duoi) chi Org Admin moi co. Kich ban khai thac: 1 Manager goi GET /users (co chu dich khong
    // co guard - xem chu thich users.controller.ts) de doc roles:[{id,name}] cua 1 Org Admin co
    // san, roi goi POST /users/invite voi chinh roleId do trong body -> tu tao 1 tai khoan Org
    // Admin moi hoan toan hop le ve mat DB, tu leo thang tu Manager len Admin toan quyen. Chan
    // ngay tai day: neu client GUI kem roleIds (khac rong), nguoi goi BAT BUOC phai co quyen
    // user:manage, neu khong tu choi 403 ro rang thay vi am tham bo qua/gan rong (de loi nay bi
    // phat hien ngay trong test thay vi "thanh cong" sai lech voi y dinh cua client). Da kiem tra
    // frontend (InviteMemberModal.tsx): danh sach vai tro de tick chi tai duoc qua GET /roles, ban
    // than endpoint do da doi hoi role:manage (chi Org Admin) nen 1 Manager dung UI that KHONG BAO
    // GIO gui duoc roleIds khac rong - 403 o day chi chan duong client tu tao request thu cong.
    if (dto.roleIds?.length && !callerPermissions.includes(PERMISSIONS.USER_MANAGE)) {
      throw new ForbiddenException({
        message: 'Ban khong co quyen gan vai tro khi moi thanh vien moi (can quyen user:manage)',
        errorCode: ERROR_CODES.FORBIDDEN_ASSIGN_ROLE,
      });
    }

    // 22/07/2026: xac thuc departmentId thuoc DUNG to chuc cua nguoi goi truoc khi gan cho user
    // moi - truoc day gan thang `dto.departmentId ?? null` khong kiem tra gi (khac voi roleIds
    // ngay ben duoi, von DA duoc loc dung cach qua `{ id: In(dto.roleIds), organizationId }`).
    // Vi departmentId chi la 1 UUID bat ky do client gui len, 1 Org Admin cua to chuc A co the
    // truyen id phong ban thuoc to chuc B va vo tinh/co y lien ket sai user cua to chuc A vao
    // phong ban to chuc B - ro ri quan he du lieu xuyen to chuc (loi MAJOR, review 22/07/2026).
    if (dto.departmentId) {
      const department = await this.departmentRepo.findOne({
        where: { id: dto.departmentId, organizationId },
      });
      if (!department) throw new NotFoundException({ message: 'Khong tim thay phong ban', errorCode: ERROR_CODES.DEPARTMENT_NOT_FOUND });
    }

    // 22/07/2026: pre-check findOne() o tren khong nguyen tu voi insert ben duoi - boc them
    // try/catch de bat truong hop hiem gap 2 request moi thanh vien cung email gan nhu dong thoi
    // cung vuot qua pre-check roi 1 ben vi pham unique index `email` khi insert (Postgres error
    // code 23505) - xem chu thich isPostgresUniqueViolation trong db-errors.util.ts.
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const roles = dto.roleIds?.length
          ? await manager.find(Role, { where: { id: In(dto.roleIds), organizationId } })
          : [];
        const passwordHash = await bcrypt.hash(dto.initialPassword, 10);

        const user = await manager.save(
          manager.create(User, {
            organizationId,
            email: normalizedEmail,
            fullName: dto.fullName,
            departmentId: dto.departmentId ?? null,
            passwordHash,
            roles,
            isActive: true,
          }),
        );

        const payload: UserRegisteredPayload = {
          userId: user.id,
          email: user.email,
          departmentId: user.departmentId ?? null,
          actorId: user.id,
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.USER_REGISTERED,
          organizationId,
          producer: 'iam-service',
          payload: payload as unknown as Record<string, unknown>,
        });

        return user;
      });

      return this.toPublicUser(saved);
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictException({ message: 'Email da duoc su dung', errorCode: ERROR_CODES.EMAIL_ALREADY_USED });
      }
      throw error;
    }
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateUserDto,
    callerPermissions: string[],
    actorId: string,
  ): Promise<PublicUser> {
    // 26/08/2026: fix loi MAJOR (race condition ghi de dong thoi) - pre-check bang findOne() o day
    // chi de fail-fast (tra 404 nhanh cho id chua tung ton tai/sai to chuc), KHONG con duoc dung de
    // mutate/save nua (xem giai thich chi tiet o transaction ben duoi).
    const existing = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });

    // 25/07/2026: cung 1 lo hong RBAC nhu invite() o tren, ap dung cho "canh cua" thu 2 - PATCH
    // /users/:id doi vai tro cua 1 tai khoan DA TON TAI. Controller hien tai da gate ca endpoint
    // bang @RequirePermissions(USER_MANAGE) nen o tang HTTP khong ai thieu quyen goi toi day duoc,
    // NHUNG kiem tra lai o tang service (thay vi chi tin tuong 1 minh guard tren controller) la
    // phong thu chieu sau bat buoc: service co the duoc goi truc tiep tu noi khac trong tuong lai
    // (vd 1 job noi bo, 1 endpoint moi tai su dung lai update()) ma quen ap lai dung guard, luc do
    // day se la lop chan cuoi cung ngan chan leo thang quyen qua roleIds - xem chu thich invite().
    if (dto.roleIds && !callerPermissions.includes(PERMISSIONS.USER_MANAGE)) {
      throw new ForbiddenException({
        message: 'Ban khong co quyen thay doi vai tro cua nguoi dung (can quyen user:manage)',
        errorCode: ERROR_CODES.FORBIDDEN_CHANGE_ROLE,
      });
    }

    // 28/07/2026: ghi nho TRUOC khi gan vao `user` xem request nay co thuc su dong truong
    // departmentId hay khong (`dto.departmentId !== undefined`) - dung de quyet dinh co phat outbox
    // event USER_DEPARTMENT_CHANGED o cuoi ham hay khong (xem transaction ben duoi). Phai chup lai
    // thanh bien rieng ngay tai day: sau khoi if() ke tiep, `user.departmentId` co the da bi doi
    // (hoac giu nguyen neu request khong dong truong nay) - khong the phan biet nguoc lai truong
    // hop "request gui departmentId=null" (CAN phat event, gia tri moi la null) voi truong hop
    // "request khong dong truong departmentId" (KHONG phat event) chi bang cach doc lai
    // `user.departmentId` sau do.
    const departmentIdInRequest = dto.departmentId !== undefined;
    if (departmentIdInRequest && dto.departmentId !== null) {
      // 22/07/2026: xac thuc departmentId thuoc dung to chuc truoc khi gan - cung 1 lo hong nhu
      // invite() o tren (xem chu thich chi tiet tai do). `null` (bo phong ban) khong can tra cuu.
      const department = await this.departmentRepo.findOne({
        where: { id: dto.departmentId, organizationId },
      });
      if (!department) throw new NotFoundException({ message: 'Khong tim thay phong ban', errorCode: ERROR_CODES.DEPARTMENT_NOT_FOUND });
    }
    // 26/08/2026: tra cuu roles moi (neu co) truoc khi vao transaction - giong departmentId o tren,
    // day la tra cuu Role/Department theo organizationId, KHONG phu thuoc vao trang thai cua chinh
    // ban ghi User dang sua nen khong can nam trong pham vi khoa ben duoi.
    const newRoles = dto.roleIds
      ? await this.roleRepo.find({ where: { id: In(dto.roleIds), organizationId } })
      : undefined;

    // 26/08/2026: fix loi MAJOR (race condition, phat hien qua ra soat) - ban truoc day doc `user`
    // bang findOne() KHONG KHOA o dau ham, sua truc tiep len object do, roi save() no BEN NGOAI
    // transaction. 2 request PATCH dong thoi cho CUNG 1 user (vd request A doi roleIds, request B
    // doi departmentId) co the cung doc trung 1 snapshot cu truoc khi ben nao commit - moi request
    // chi sua field minh quan tam tren snapshot RIENG cua no, nhung `manager.save()` cua TypeORM ghi
    // de TOAN BO trang thai in-memory cua entity (bao gom ca quan he `roles` eager-load), KHONG chi
    // ghi field da doi. Request commit SAU se am tham "xoa" thay doi cua request commit TRUOC ma
    // khong loi gi ca (lost update). Sua dung EXACT pattern pessimistic_write da dung o
    // TasksService.updateStatus()/remove() (xem apps/project-task-service/src/tasks/tasks.service.ts):
    // doc LAI ban ghi BEN TRONG transaction voi khoa ghi (pessimistic_write) - buoc request B phai
    // doi request A commit va nha khoa truoc khi doc, dam bao B luon apply thay doi cua no LEN TREN
    // trang thai MOI NHAT (da bao gom thay doi cua A) thay vi de len snapshot cu.
    const saved = await this.dataSource.transaction(async (manager) => {
      // 16/09/2026: fix loi that (phat hien khi goi PATCH /users/:id that qua API) - `User.roles`
      // la quan he eager:true (xem entities/user.entity.ts), TypeORM tu dong LEFT JOIN sang bang
      // trung gian `user_roles`/`roles` cho MOI truy van tren User, ke ca truy van nay. Ket hop
      // voi `lock: { mode: 'pessimistic_write' }` (FOR UPDATE) sinh loi Postgres "FOR UPDATE
      // cannot be applied to the nullable side of an outer join" - Postgres tu choi khoa 1 hang co
      // the la NULL o phia LEFT JOIN, xay ra VOI MOI user (khong phu thuoc user do co bao nhieu
      // vai tro). `loadEagerRelations: false` tat eager-load CHI cho truy van nay - an toan vi
      // logic ben duoi khong bao gio DOC `user.roles` cu (chi GHI DE toan bo bang `newRoles` khi
      // dto.roleIds duoc gui, xem tra cuu newRoles truoc transaction o tren); khi khong doi vai
      // tro, `user.roles` khong duoc gan gi ca nen manager.save() khong dung toi bang trung gian.
      const user = await manager.findOneOrFail(User, {
        where: { id, organizationId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });

      if (dto.fullName !== undefined) user.fullName = dto.fullName;
      if (departmentIdInRequest) user.departmentId = dto.departmentId ?? null;
      if (newRoles) user.roles = newRoles;

      const updated = await manager.save(user);
      // 28/07/2026: boc save() vao 1 transaction va phat outbox event USER_DEPARTMENT_CHANGED CUNG
      // luc khi request co thay doi departmentId (ke ca truong hop go phong ban ve null) - truoc day
      // update() chi goi thang `this.userRepo.save(user)` NGOAI transaction, khong co event nao bao
      // cho Analytics Service biet phong ban cua user vua doi de gop KPI theo phong ban (tinh nang
      // moi - xem UserDepartmentChangedPayload trong packages/common-dto). Mau
      // outbox-emission-trong-transaction nay lay dung theo deactivate()/invite() o tren: ghi
      // outbox_events CUNG transaction voi thay doi nghiep vu de tranh outbox record va DB update bi
      // lech nhau khi 1 trong 2 thao tac that bai giua chung.
      if (departmentIdInRequest) {
        const payload: UserDepartmentChangedPayload = {
          userId: updated.id,
          departmentId: updated.departmentId ?? null,
          actorId,
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
          organizationId,
          producer: 'iam-service',
          payload: payload as unknown as Record<string, unknown>,
        });
      }
      return updated;
    });

    return this.toPublicUser(saved);
  }

  async deactivate(organizationId: string, id: string, actorId: string): Promise<PublicUser> {
    // 22/07/2026: chan tu vo hieu hoa chinh minh - truoc day khong co kiem tra nao, bat ky nguoi
    // dung nao co quyen user:manage (ke ca Org Admin DUY NHAT con lai cua to chuc) deu co the tu
    // bam "Vo hieu hoa" len chinh tai khoan dang dung de dang nhap, tu khoa minh khoi he thong ma
    // khong con ai kip dang nhap lai de kich hoat lai (last-admin lockout) - loi MAJOR, review
    // 22/07/2026. Chi kiem tra dung pham vi "tu vo hieu hoa chinh minh" (id === actorId) theo yeu
    // cau fix; CHUA dem so luong user:manage con active khac trong to chuc (vd admin A vo hieu
    // hoa admin B la nguoi co quyen quan tri cuoi cung khac van chua bi chan o day) - xem bao cao
    // cuoi cung ve gioi han da biet nay va endpoint reactivate() moi bo sung ben duoi.
    if (id === actorId) {
      throw new BadRequestException({
        message: 'Khong the tu vo hieu hoa chinh tai khoan cua minh',
        errorCode: ERROR_CODES.CANNOT_DEACTIVATE_SELF,
      });
    }

    const existing = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });

    const saved = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneOrFail(User, { where: { id, organizationId } });
      user.isActive = false;
      const updated = await manager.save(user);

      const payload: UserDeactivatedPayload = { userId: updated.id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.USER_DEACTIVATED,
        organizationId,
        producer: 'iam-service',
        payload: payload as unknown as Record<string, unknown>,
      });

      return updated;
    });

    // Thu hoi access token dang hieu luc cua tai khoan vua bi deactivate ngay lap tuc, thay vi
    // cho token het han tu nhien (toi da 15 phut) - Technical_Spec.md muc 6 (bo sung 21/07/2026).
    // TTL bang chinh thoi han access token de khoa blacklist tu dong het hieu luc cung luc.
    //
    // 22/08/2026: phat hien qua rieng ra soat - lenh Redis nay truoc day goi THANG, khong
    // try/catch, SAU KHI transaction Postgres o tren DA COMMIT THANH CONG (isActive=false + outbox
    // event da ghi). Neu Redis dang loi/mat ket noi luc nay, request se 500 lam admin tuong thao
    // tac that bai va co the thu lai - trong khi vo hieu hoa DA THANH CONG that su trong DB. Boc
    // try/catch (khong can withTimeout vi day la lenh GHI cuoi cung, khong chan luong nghiep vu
    // nao khac phia sau) - blacklist Redis chi la lop thu hoi token SOM (defense in depth), token
    // van tu het han binh thuong trong toi da 15 phut ke ca khi buoc nay that bai.
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const ttlSeconds = Math.floor(parseDurationMs(accessExpiresIn) / 1000);
    try {
      await this.redisService.blacklistUser(saved.id, ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `Ghi Redis blacklist that bai sau khi deactivate ${saved.id} (bo qua, tai khoan van DA bi vo hieu hoa trong DB, token se tu het han trong toi da ${accessExpiresIn}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return this.toPublicUser(saved);
  }

  /**
   * 22/07/2026: endpoint kich hoat lai 1 tai khoan da bi deactivate() - truoc day KHONG ton tai
   * (deactivate la thao tac 1 chieu, ca nhan bi vo hieu hoa nham hoac can kich hoat lai deu phai
   * sua tay truc tiep tren DB). Khong phat outbox event: packages/common-dto EVENT_TYPES chua co
   * entry USER_REACTIVATED tuong ung, va them event type moi + cap nhat 3 service tieu thu
   * (Notification/Analytics/...) nam ngoai pham vi apps/iam-service/src/** cua fix nay - xem bao
   * cao cuoi cung.
   */
  async reactivate(organizationId: string, id: string): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!user) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });

    user.isActive = true;
    const saved = await this.userRepo.save(user);
    return this.toPublicUser(saved);
  }

  /**
   * 25/09/2026: xoa vinh vien 1 tai khoan - truoc day User la entity DUY NHAT trong toan du an
   * khong co API xoa nao (chi deactivate()/reactivate()), khac Customer/Deal/Task/Project/Document
   * deu co DELETE that su. Phat sinh nhu cau thuc te: du lieu rac do E2E test tao ra (vd "Thanh
   * vien E2E <timestamp>", nay da tach sang to chuc E2E rieng - xem e2e/README.md) khi con trong to
   * chuc demo chi deactivate() duoc, van hien vinh vien trong Quan tri > Thanh vien/Cham cong/...
   * (2 man hinh nay doc danh sach nguoi dung TRUC TIEP tu day, khong loc theo isActive) - nguoi
   * dung phan anh nhieu lan. Xoa CUNG (hard delete), dung quy uoc da co cua du an cho moi entity
   * khac (Doc/Upgrade.md Tier 3: "hien moi thao tac xoa deu la hard delete tren toan du an").
   *
   * Bat buoc PHAI deactivate() truoc (kiem tra isActive=false ben duoi) - rao an toan o tang
   * service (khong chi an nut o UI) cho 1 thao tac khong the hoan tac, tranh xoa nham 1 nhan vien
   * dang lam viec binh thuong.
   *
   * An toan ve rang buoc FK: refresh_tokens/password_reset_tokens (ON DELETE CASCADE tren user_id)
   * va user_roles (ON DELETE CASCADE tren user_id, KHONG cascade tren role_id) tu dong don theo -
   * da xac minh truc tiep tren schema Postgres dang chay truoc khi viet ham nay. hrm/document/
   * project-task-service KHONG giu ban sao User nao (chi luu userId dang UUID tho) nen xoa o day
   * khong anh huong 3 service do.
   *
   * 25/09/2026 (phat hien qua phan hoi thuc te NGAY SAU khi trien khai ban dau, xem
   * RevisionHistory.md): Analytics Service VA ml-service (apps/ml-service) LAI CO tu xay read-model
   * rieng qua Kafka (bang `dim_user`, phuc vu KPI/scoping theo phong ban) - ban dau tuong lam KHONG
   * co, dan den user vua xoa cung o day van "song sot" trong 2 bang do vinh vien (khong service nao
   * tung bao chung "user nay da bi xoa"), lam Anomaly Detection hien UUID tho thay vi ten cho nhung
   * nhan vien da xoa. Sua bang cach PHAT outbox event EVENT_TYPES.USER_DELETED (khac
   * USER_DEACTIVATED/reactivate() o tren - 2 cai do KHONG can event vi user van TON TAI, chi doi
   * trang thai) - Analytics Service/ml-service consume event nay de xoa dong `dim_user` tuong ung.
   */
  async remove(organizationId: string, id: string, actorId: string): Promise<void> {
    if (id === actorId) {
      throw new BadRequestException({
        message: 'Khong the tu xoa chinh tai khoan cua minh',
        errorCode: ERROR_CODES.CANNOT_DELETE_SELF,
      });
    }

    const existing = await this.userRepo.findOne({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException({ message: 'Khong tim thay nguoi dung', errorCode: ERROR_CODES.USER_NOT_FOUND });

    if (existing.isActive) {
      throw new BadRequestException({
        message: 'Chi co the xoa vinh vien tai khoan da bi vo hieu hoa - hay vo hieu hoa truoc',
        errorCode: ERROR_CODES.CANNOT_DELETE_ACTIVE_USER,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(User, { id, organizationId });

      // 25/09/2026: phat USER_DELETED - cac service tu xay read-model rieng qua Kafka (dim_user o
      // Analytics Service, apps/ml-service) can biet de xoa "user ma" khoi bang lookup cua ho,
      // khac USER_DEACTIVATED/reactivate() (khong can, vi user van con TON TAI, chi doi trang thai).
      const payload: UserDeletedPayload = { userId: id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.USER_DELETED,
        organizationId,
        producer: 'iam-service',
        payload: payload as unknown as Record<string, unknown>,
      });
    });

    // Mirror deactivate() - phong truong hop con token chua het han (vd deactivate() va remove()
    // cach nhau du lau de token cu bi cap lai qua refresh, hiem nhung khong phai khong the).
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const ttlSeconds = Math.floor(parseDurationMs(accessExpiresIn) / 1000);
    try {
      await this.redisService.blacklistUser(id, ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `Ghi Redis blacklist that bai sau khi xoa ${id} (bo qua, tai khoan van DA bi xoa trong DB): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // 26/10/2026: the danh ba rut gon cho nguoi ngoai pham vi - xem chu thich tai findAll().
  private toDirectoryCard(user: User): DirectoryCard {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      departmentId: user.departmentId ?? null,
      isActive: user.isActive,
    };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId: user.organizationId,
      departmentId: user.departmentId ?? null,
      isActive: user.isActive,
      roles: (user.roles ?? []).map((r) => ({ id: r.id, name: r.name })),
      createdAt: user.createdAt,
    };
  }
}
