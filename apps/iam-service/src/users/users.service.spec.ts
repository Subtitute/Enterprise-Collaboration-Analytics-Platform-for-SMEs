import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EVENT_TYPES, PERMISSIONS } from '@app/common-dto';
import { UsersService } from './users.service';

/**
 * 25/07/2026: unit test moi cho UsersService - truoc day KHONG ton tai bat ky test nao cho service
 * nay (no debt tu vong review truoc, xem bao cao cuoi cung). Uu tien bao ve 2 nhom hanh vi:
 *   1) RBAC-grant-guard vua duoc bo sung trong invite()/update() (Fix CRITICAL, review 25/07/2026):
 *      chi nguoi goi co quyen user:manage moi duoc phep gan/doi roleIds cho 1 user, chan dung
 *      duong khai thac "Manager tu leo thang thanh Org Admin qua POST /users/invite".
 *   2) Cac nhanh nghiep vu quan trong da co san nhung chua duoc test: xac thuc departmentId dung
 *      to chuc (invite()/update()), tu-chan-vo-hieu-hoa-chinh-minh (deactivate()), va reactivate().
 * Khong dung @nestjs/testing Test.createTestingModule (khong can DI that) - khoi tao truc tiep
 * UsersService voi cac repo/service phu thuoc duoc gia lap bang jest.fn(), giong tinh than cac
 * *.controller.spec.ts da co san trong service nay (vd auth.controller.spec.ts: `new
 * AuthController(authServiceMock)`).
 */
describe('UsersService', () => {
  const ORG_ID = 'org-1';
  const ACTOR_ID = 'actor-1';

  let userRepo: { findOne: jest.Mock };
  let roleRepo: { find: jest.Mock };
  let departmentRepo: { findOne: jest.Mock };
  let outboxService: { record: jest.Mock };
  let redisService: { blacklistUser: jest.Mock; unblacklistUser: jest.Mock };
  let configService: { get: jest.Mock };
  let managerMock: { find: jest.Mock; save: jest.Mock; create: jest.Mock; findOneOrFail: jest.Mock; delete: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    userRepo = { findOne: jest.fn() };
    roleRepo = { find: jest.fn() };
    departmentRepo = { findOne: jest.fn() };
    outboxService = { record: jest.fn().mockResolvedValue(undefined) };
    redisService = { blacklistUser: jest.fn().mockResolvedValue(undefined), unblacklistUser: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn().mockReturnValue('15m') };

    managerMock = {
      find: jest.fn(),
      // TypeORM EntityManager.create() thuc te chi merge plain object vao 1 the hien entity - voi
      // muc dich unit test o day, tra ve THANG object dau vao la du (khong can hanh vi entity that).
      create: jest.fn((_entity, data) => data),
      save: jest.fn(),
      findOneOrFail: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (manager: typeof managerMock) => unknown) => cb(managerMock)),
    };

    service = new UsersService(
      dataSource as any,
      userRepo as any,
      roleRepo as any,
      departmentRepo as any,
      outboxService as any,
      redisService as any,
      configService as any,
    );
  });

  describe('invite()', () => {
    const baseDto = {
      email: 'new@example.com',
      fullName: 'Nguoi Moi',
      initialPassword: 'Password123!',
    };

    it('tu choi (409) neu email da duoc su dung', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(service.invite(ORG_ID, baseDto as any, [])).rejects.toThrow(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('tu choi (404) neu departmentId khong thuoc dung to chuc cua nguoi goi', async () => {
      userRepo.findOne.mockResolvedValue(null);
      departmentRepo.findOne.mockResolvedValue(null); // khong tim thay trong ORG_ID

      await expect(
        service.invite(ORG_ID, { ...baseDto, departmentId: 'dept-of-other-org' } as any, []),
      ).rejects.toThrow(NotFoundException);
      expect(departmentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'dept-of-other-org', organizationId: ORG_ID },
      });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('RBAC bypass CRITICAL: tu choi (403) khi nguoi goi KHONG co quyen user:manage nhung van gui roleIds', async () => {
      userRepo.findOne.mockResolvedValue(null);

      // Nguoi goi chi co user:invite (dung nhu role Manager mac dinh) - KHONG co user:manage.
      await expect(
        service.invite(ORG_ID, { ...baseDto, roleIds: ['role-org-admin'] } as any, [
          PERMISSIONS.USER_INVITE,
        ]),
      ).rejects.toThrow(ForbiddenException);
      // Phai chan TRUOC khi mo transaction - khong duoc tao user du 1 phan nao ca.
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('cho phep khi nguoi goi CO quyen user:manage va gan dung roleIds duoc yeu cau', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const grantedRoles = [{ id: 'role-org-admin', name: 'Org Admin' }];
      managerMock.find.mockResolvedValue(grantedRoles);
      managerMock.save.mockImplementation(async (entity: any) => ({
        id: 'new-user-id',
        createdAt: new Date(),
        roles: grantedRoles,
        ...entity,
      }));

      const result = await service.invite(
        ORG_ID,
        { ...baseDto, roleIds: ['role-org-admin'] } as any,
        [PERMISSIONS.USER_MANAGE],
      );

      expect(managerMock.find).toHaveBeenCalledWith(expect.anything(), {
        where: { id: expect.anything(), organizationId: ORG_ID },
      });
      expect(result.roles).toEqual([{ id: 'role-org-admin', name: 'Org Admin' }]);
    });

    it('khong gui roleIds (undefined) thi KHONG bi chan du nguoi goi khong co user:manage', async () => {
      userRepo.findOne.mockResolvedValue(null);
      managerMock.save.mockImplementation(async (entity: any) => ({
        id: 'new-user-id',
        createdAt: new Date(),
        roles: [],
        ...entity,
      }));

      await expect(
        service.invite(ORG_ID, baseDto as any, [PERMISSIONS.USER_INVITE]),
      ).resolves.toMatchObject({ id: 'new-user-id' });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('update()', () => {
    it('tu choi (404) neu departmentId moi khong thuoc dung to chuc', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', organizationId: ORG_ID });
      departmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(ORG_ID, 'user-1', { departmentId: 'dept-of-other-org' } as any, [], ACTOR_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('RBAC bypass CRITICAL: tu choi (403) khi nguoi goi khong co user:manage nhung gui roleIds', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', organizationId: ORG_ID, roles: [] });

      await expect(
        service.update(ORG_ID, 'user-1', { roleIds: ['role-org-admin'] } as any, [
          PERMISSIONS.USER_INVITE,
        ], ACTOR_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cho phep khi nguoi goi co user:manage va cap nhat dung roleIds', async () => {
      const existingUser = { id: 'user-1', organizationId: ORG_ID, roles: [], fullName: 'Cu' };
      userRepo.findOne.mockResolvedValue(existingUser);
      const newRoles = [{ id: 'role-manager', name: 'Manager' }];
      roleRepo.find.mockResolvedValue(newRoles);
      // 28/07/2026: update() gio boc save() vao dataSource.transaction() (xem users.service.ts) -
      // save() thuc te chay qua managerMock.save (khong con qua userRepo.save nhu truoc).
      //
      // 26/08/2026: fix race condition (pessimistic_write) - update() gio doc LAI ban ghi qua
      // manager.findOneOrFail() BEN TRONG transaction (khong con mutate truc tiep object tra ve tu
      // userRepo.findOne() nhu truoc), nen phai mock ca findOneOrFail tra ve dung entity nay.
      managerMock.findOneOrFail.mockResolvedValue(existingUser);
      managerMock.save.mockImplementation(async (u: any) => u);

      const result = await service.update(ORG_ID, 'user-1', { roleIds: ['role-manager'] } as any, [
        PERMISSIONS.USER_MANAGE,
      ], ACTOR_ID);

      expect(roleRepo.find).toHaveBeenCalledWith({
        where: { id: expect.anything(), organizationId: ORG_ID },
      });
      // 26/08/2026: khoa row bang pessimistic_write truoc khi apply thay doi - mirror
      // TasksService.updateStatus() (tasks.service.spec.ts), xem chu thich fix trong users.service.ts.
      expect(managerMock.findOneOrFail).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
      );
      expect(result.roles).toEqual([{ id: 'role-manager', name: 'Manager' }]);
      // 28/07/2026: request nay khong dong truong departmentId -> khong duoc phat
      // USER_DEPARTMENT_CHANGED (xem 3 test rieng ben duoi cho hanh vi phat/khong phat event nay).
      // 26/10/2026: doi vai tro -> CHI phat iam.user.roles_changed (muc vai tro cho ml-service, muc 27.4).
      expect(outboxService.record).toHaveBeenCalledTimes(1);
      expect(outboxService.record).toHaveBeenCalledWith(managerMock, {
        eventType: EVENT_TYPES.USER_ROLES_CHANGED,
        organizationId: ORG_ID,
        producer: 'iam-service',
        payload: { userId: 'user-1', roleLevel: 'MANAGER', actorId: ACTOR_ID },
      });
    });

    // 28/07/2026: nhom test moi - update() gio phat outbox event USER_DEPARTMENT_CHANGED khi va chi
    // khi request co dong truong departmentId (ke ca gia tri null), phuc vu KPI theo phong ban cua
    // Analytics Service (xem UserDepartmentChangedPayload, packages/common-dto va
    // user-department-sync.service.spec.ts cho buoc resync luc khoi dong).
    it('phat outbox event USER_DEPARTMENT_CHANGED voi departmentId MOI khi request doi phong ban', async () => {
      const existingUser = {
        id: 'user-1',
        organizationId: ORG_ID,
        departmentId: 'dept-old',
        roles: [],
      };
      userRepo.findOne.mockResolvedValue(existingUser);
      departmentRepo.findOne.mockResolvedValue({ id: 'dept-new', organizationId: ORG_ID });
      // 26/08/2026: xem chu thich tai test "cho phep khi nguoi goi co user:manage..." o tren - update()
      // gio doc lai entity qua manager.findOneOrFail() (pessimistic_write) truoc khi mutate/save.
      managerMock.findOneOrFail.mockResolvedValue(existingUser);
      managerMock.save.mockImplementation(async (u: any) => u);

      const result = await service.update(ORG_ID, 'user-1', { departmentId: 'dept-new' } as any, [], ACTOR_ID);

      expect(outboxService.record).toHaveBeenCalledTimes(1);
      expect(outboxService.record).toHaveBeenCalledWith(managerMock, {
        eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
        organizationId: ORG_ID,
        producer: 'iam-service',
        payload: { userId: 'user-1', departmentId: 'dept-new', actorId: ACTOR_ID },
      });
      expect(result.departmentId).toBe('dept-new');
    });

    it('phat outbox event USER_DEPARTMENT_CHANGED voi departmentId=null khi go user khoi phong ban', async () => {
      const existingUser = {
        id: 'user-1',
        organizationId: ORG_ID,
        departmentId: 'dept-old',
        roles: [],
      };
      userRepo.findOne.mockResolvedValue(existingUser);
      managerMock.findOneOrFail.mockResolvedValue(existingUser);
      managerMock.save.mockImplementation(async (u: any) => u);

      const result = await service.update(ORG_ID, 'user-1', { departmentId: null } as any, [], ACTOR_ID);

      // `null` khong can tra cuu Department (xem comment 22/07/2026 trong users.service.ts).
      expect(departmentRepo.findOne).not.toHaveBeenCalled();
      expect(outboxService.record).toHaveBeenCalledTimes(1);
      expect(outboxService.record).toHaveBeenCalledWith(managerMock, {
        eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
        organizationId: ORG_ID,
        producer: 'iam-service',
        payload: { userId: 'user-1', departmentId: null, actorId: ACTOR_ID },
      });
      expect(result.departmentId).toBeNull();
    });

    it('KHONG phat outbox event USER_DEPARTMENT_CHANGED neu request khong dong truong departmentId', async () => {
      const existingUser = {
        id: 'user-1',
        organizationId: ORG_ID,
        departmentId: 'dept-old',
        roles: [],
      };
      userRepo.findOne.mockResolvedValue(existingUser);
      managerMock.findOneOrFail.mockResolvedValue(existingUser);
      managerMock.save.mockImplementation(async (u: any) => u);

      await service.update(ORG_ID, 'user-1', { fullName: 'Ten Moi' } as any, [], ACTOR_ID);

      // 26/10/2026: doi ho ten -> CHI phat iam.user.profile_updated (ten truong, khong gia tri), khong
      // phat USER_DEPARTMENT_CHANGED.
      expect(outboxService.record).toHaveBeenCalledTimes(1);
      expect(outboxService.record).toHaveBeenCalledWith(managerMock, {
        eventType: EVENT_TYPES.USER_PROFILE_UPDATED,
        organizationId: ORG_ID,
        producer: 'iam-service',
        payload: { userId: 'user-1', changedFields: ['fullName'], actorId: ACTOR_ID },
      });
    });
  });

  describe('deactivate()', () => {
    it('tu choi (400) khi tu vo hieu hoa chinh minh', async () => {
      await expect(service.deactivate(ORG_ID, 'user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('vo hieu hoa thanh cong 1 user khac va thu hoi access token qua Redis blacklist', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-2', organizationId: ORG_ID, isActive: true });
      managerMock.findOneOrFail.mockResolvedValue({
        id: 'user-2',
        organizationId: ORG_ID,
        isActive: true,
      });
      managerMock.save.mockImplementation(async (u: any) => u);

      const result = await service.deactivate(ORG_ID, 'user-2', 'actor-1');

      expect(result.isActive).toBe(false);
      expect(redisService.blacklistUser).toHaveBeenCalledWith('user-2', expect.any(Number));
    });

    it('tu choi (404) neu user khong ton tai trong to chuc', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivate(ORG_ID, 'user-2', 'actor-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reactivate()', () => {
    it('tu choi (404) neu user khong ton tai trong to chuc', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.reactivate(ORG_ID, 'user-2')).rejects.toThrow(NotFoundException);
    });

    it('kich hoat lai thanh cong 1 user da bi deactivate', async () => {
      const existing = { id: 'user-2', organizationId: ORG_ID, isActive: false, roles: [] };
      userRepo.findOne.mockResolvedValue(existing);
      // 26/10/2026: reactivate() gio luu trong transaction (cung outbox iam.user.reactivated).
      managerMock.save.mockImplementation(async (u: any) => u);

      const result = await service.reactivate(ORG_ID, 'user-2', ACTOR_ID);

      expect(result.isActive).toBe(true);
      expect(managerMock.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
      // 26/10/2026: phat event cho ml-service + go khoa blacklist Redis do deactivate() dat (truoc day
      // nguoi vua kich hoat lai dang nhap duoc nhung moi API deu 401 GATEWAY_ACCOUNT_DISABLED).
      expect(outboxService.record).toHaveBeenCalledWith(managerMock, {
        eventType: EVENT_TYPES.USER_REACTIVATED,
        organizationId: ORG_ID,
        producer: 'iam-service',
        payload: { userId: 'user-2', actorId: ACTOR_ID },
      });
      expect(redisService.unblacklistUser).toHaveBeenCalledWith('user-2');
    });

    it('loi Redis khi go blacklist khong lam that bai viec kich hoat lai', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-2', organizationId: ORG_ID, isActive: false, roles: [] });
      managerMock.save.mockImplementation(async (u: any) => u);
      redisService.unblacklistUser.mockRejectedValueOnce(new Error('redis down'));
      await expect(service.reactivate(ORG_ID, 'user-2', ACTOR_ID)).resolves.toMatchObject({ isActive: true });
    });
  });

  describe('remove()', () => {
    it('tu choi (400) khi tu xoa chinh minh', async () => {
      await expect(service.remove(ORG_ID, 'user-1', 'user-1')).rejects.toThrow(BadRequestException);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('tu choi (404) neu user khong ton tai trong to chuc', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(ORG_ID, 'user-2', 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('tu choi (400) neu tai khoan van dang active - phai vo hieu hoa truoc', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-2', organizationId: ORG_ID, isActive: true });
      await expect(service.remove(ORG_ID, 'user-2', 'actor-1')).rejects.toThrow(BadRequestException);
      expect(managerMock.delete).not.toHaveBeenCalled();
    });

    it('xoa cung thanh cong 1 tai khoan da vo hieu hoa VA phat event USER_DELETED', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-2', organizationId: ORG_ID, isActive: false });

      await service.remove(ORG_ID, 'user-2', 'actor-1');

      expect(managerMock.delete).toHaveBeenCalledWith(expect.anything(), { id: 'user-2', organizationId: ORG_ID });
      expect(outboxService.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.USER_DELETED,
          organizationId: ORG_ID,
          payload: { userId: 'user-2', actorId: 'actor-1' },
        }),
      );
      expect(redisService.blacklistUser).toHaveBeenCalledWith('user-2', expect.any(Number));
    });
  });

  // 26/10/2026: danh ba 3 cap - ho so day du chi trong pham vi, ngoai pham vi la "the danh ba".
  describe('findAll() / findByIdInDepartment() - danh ba theo pham vi', () => {
    const users = [
      { id: 'me', email: 'me@x.vn', fullName: 'Toi', organizationId: ORG_ID, departmentId: 'dept-a', isActive: true, roles: [{ id: 'r1', name: 'Manager' }], createdAt: new Date() },
      { id: 'mate', email: 'mate@x.vn', fullName: 'Dong nghiep', organizationId: ORG_ID, departmentId: 'dept-a', isActive: true, roles: [], createdAt: new Date() },
      { id: 'other', email: 'other@x.vn', fullName: 'Phong khac', organizationId: ORG_ID, departmentId: 'dept-b', isActive: true, roles: [], createdAt: new Date() },
    ];
    const isFull = (u: Record<string, unknown>) => 'roles' in u && 'createdAt' in u;

    beforeEach(() => {
      (userRepo as any).findAndCount = jest.fn().mockResolvedValue([users, users.length]);
    });

    it('Org Admin/khong co caller: ho so day du cho moi nguoi', async () => {
      const res = await service.findAll(ORG_ID, { page: 1, limit: 50 } as any, { userId: 'me', permissions: [PERMISSIONS.USER_MANAGE], departmentId: null });
      expect(res.data.every((u) => isFull(u as any))).toBe(true);
      expect((await service.findAll(ORG_ID, { page: 1, limit: 50 } as any)).data.every((u) => isFull(u as any))).toBe(true);
    });

    it('Manager: day du chinh minh + cung phong ban; phong ban khac chi con ten/phong ban/email', async () => {
      const res = await service.findAll(ORG_ID, { page: 1, limit: 50 } as any, { userId: 'me', permissions: [PERMISSIONS.USER_INVITE], departmentId: 'dept-a' });
      const byId = Object.fromEntries(res.data.map((u) => [u.id, u as Record<string, unknown>]));
      expect(isFull(byId.me)).toBe(true);
      expect(isFull(byId.mate)).toBe(true);
      expect(byId.other).toEqual({ id: 'other', email: 'other@x.vn', fullName: 'Phong khac', departmentId: 'dept-b', isActive: true, avatarUrl: null });
    });

    it('Employee: chi ho so cua chinh minh la day du', async () => {
      const res = await service.findAll(ORG_ID, { page: 1, limit: 50 } as any, { userId: 'me', permissions: [], departmentId: 'dept-a' });
      expect(res.data.filter((u) => isFull(u as any)).map((u) => u.id)).toEqual(['me']);
    });

    it('findByIdInDepartment: cung phong ban -> ho so day du, khac phong ban -> 403', async () => {
      userRepo.findOne.mockResolvedValueOnce(users[1]).mockResolvedValueOnce(users[2]);
      await expect(service.findByIdInDepartment(ORG_ID, 'mate', 'dept-a')).resolves.toMatchObject({ id: 'mate', roles: [] });
      await expect(service.findByIdInDepartment(ORG_ID, 'other', 'dept-a')).rejects.toThrow(ForbiddenException);
    });
  });
});
