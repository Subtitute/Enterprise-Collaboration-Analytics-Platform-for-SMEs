import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ERROR_CODES, EVENT_TYPES, PERMISSIONS } from '@app/common-dto';
import { UsersService, type ProfileCaller } from './users.service';

/**
 * 26/10/2026: unit test cho Danh sach nhan vien & ho so that (Technical_Spec.md muc 27.6/27.7/27.13) -
 * ma tran pham vi o iam-service (chinh chu / Org Admin / Manager -> Employee phong minh / phong khac /
 * Manager khac / Org Admin / Manager khong co phong ban / Employee / Super Admin), avatar, so dien
 * thoai, ma nhan vien, moi khong kem mat khau, hop dong DTO (GET /users khong co phoneNumber).
 * Cung kieu khoi tao truc tiep nhu users.service.spec.ts (khong DI that).
 */
describe('UsersService - ho so, avatar, danh sach nhan vien', () => {
  const ORG = 'org-1';
  const DEPT_A = 'dept-a';
  const DEPT_B = 'dept-b';
  const role = (name: string) => ({ id: `role-${name}`, name });
  const users: Record<string, any> = {
    admin: { id: 'admin', organizationId: ORG, departmentId: DEPT_A, roles: [role('Org Admin')], email: 'a@x.vn', fullName: 'Admin' },
    manager: { id: 'manager', organizationId: ORG, departmentId: DEPT_A, roles: [role('Manager')], email: 'm@x.vn', fullName: 'Manager' },
    manager2: { id: 'manager2', organizationId: ORG, departmentId: DEPT_A, roles: [role('Manager')], email: 'm2@x.vn', fullName: 'Manager 2' },
    emp: { id: 'emp', organizationId: ORG, departmentId: DEPT_A, roles: [role('Employee')], email: 'e@x.vn', fullName: 'Emp', phoneNumber: '0912345678', employeeCode: 'NV001' },
    empB: { id: 'empB', organizationId: ORG, departmentId: DEPT_B, roles: [role('Employee')], email: 'eb@x.vn', fullName: 'Emp B' },
  };
  const callers: Record<string, ProfileCaller> = {
    admin: { userId: 'admin', permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_INVITE], departmentId: DEPT_A },
    manager: { userId: 'manager', permissions: [PERMISSIONS.USER_INVITE], departmentId: DEPT_A },
    managerNoDept: { userId: 'manager', permissions: [PERMISSIONS.USER_INVITE], departmentId: null },
    emp: { userId: 'emp', permissions: [], departmentId: DEPT_A },
    superAdmin: { userId: 'sa', permissions: [PERMISSIONS.USER_MANAGE], departmentId: null, isSuperAdmin: true },
  };

  let userRepo: { findOne: jest.Mock; findAndCount: jest.Mock; createQueryBuilder: jest.Mock };
  let outboxService: { record: jest.Mock };
  let minio: { putObject: jest.Mock; removeObjectQuietly: jest.Mock; presignedGetObject: jest.Mock };
  let emailService: { sendInviteEmail: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let manager: { update: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock; delete: jest.Mock };
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let service: UsersService;

  // JPEG toi thieu dung cau truc (SOI, [APP1 Exif/GPS], SOF0 width x height, SOS, du lieu, EOI) - du de
  // probeImage() doc kich thuoc va stripImageMetadata() bo metadata.
  function jpeg(width: number, height: number, withGps = false): Buffer {
    const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
    const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9]);
    const exif = Buffer.from('Exif\0\0GPS-21.0285', 'latin1');
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, exif.length + 2]), exif]);
    return Buffer.concat([Buffer.from([0xff, 0xd8]), withGps ? app1 : Buffer.alloc(0), sof, sos]);
  }

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        if (where.email) return null;
        if (where.employeeCode) return Object.values(users).find((u) => u.employeeCode === where.employeeCode) ?? null;
        const u = users[where.id];
        return u && u.organizationId === where.organizationId ? { ...u } : null;
      }),
      findAndCount: jest.fn(async () => [[users.emp], 1]),
      createQueryBuilder: jest.fn(),
    };
    outboxService = { record: jest.fn().mockResolvedValue(undefined) };
    minio = {
      putObject: jest.fn().mockResolvedValue(undefined),
      removeObjectQuietly: jest.fn().mockResolvedValue(undefined),
      presignedGetObject: jest.fn(async (key: string) => `https://minio/${key}?sig`),
    };
    emailService = { sendInviteEmail: jest.fn().mockResolvedValue(undefined) };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    manager = {
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(async (entity: any) => ({ id: entity.id ?? 'new-id', createdAt: new Date(), roles: entity.roles ?? [], ...entity })),
      create: jest.fn((_e, data) => data),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: typeof manager) => unknown) => cb(manager)),
      getRepository: jest.fn(() => ({ delete: jest.fn() })),
    };
    const configService = {
      get: jest.fn((key: string) => ({ 'jwt.resetSecret': 'reset', frontendUrl: 'http://web', avatarUrlTtlSeconds: 3600, inviteTokenExpiresIn: '72h' })[key] ?? '15m'),
    };
    service = new UsersService(
      dataSource as any,
      userRepo as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { findOne: jest.fn().mockResolvedValue({ id: DEPT_A }) } as any,
      outboxService as any,
      { blacklistUser: jest.fn() } as any,
      configService as any,
      minio as any,
      emailService as any,
      jwtService as any,
    );
  });

  describe('avatar - ma tran pham vi ghi', () => {
    const allowed: [string, string][] = [
      ['emp', 'emp'],
      ['admin', 'emp'],
      ['admin', 'manager'],
      ['manager', 'emp'],
    ];
    const denied: [string, string][] = [
      ['manager', 'empB'], // Employee phong khac
      ['manager', 'manager2'], // Manager khac cung phong
      ['manager', 'admin'], // Org Admin
      ['managerNoDept', 'emp'], // Manager chua co phong ban
      ['emp', 'empB'], // Employee -> nguoi khac
      ['superAdmin', 'emp'], // Super Admin khong co du lieu tenant
    ];

    it.each(allowed)('%s -> %s: cho phep, ghi object moi -> DB -> xoa object cu', async (caller, target) => {
      users[target].avatarObjectKey = 'old-key';
      const result = await service.setAvatar(ORG, callers[caller], target, { buffer: jpeg(512, 512), size: 100 });
      expect(minio.putObject).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${ORG}/${target}/.+\\.jpg$`)), expect.any(Buffer), 'image/jpeg');
      expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: target, organizationId: ORG }, expect.objectContaining({ avatarObjectKey: expect.any(String) }));
      expect(minio.removeObjectQuietly).toHaveBeenCalledWith('old-key');
      expect(result.avatarUrl).toMatch(/^https:\/\/minio\//);
      delete users[target].avatarObjectKey;
    });

    it.each(denied)('%s -> %s: 403 PROFILE_SCOPE_FORBIDDEN, khong ghi gi', async (caller, target) => {
      await expect(service.setAvatar(ORG, callers[caller], target, { buffer: jpeg(512, 512), size: 100 })).rejects.toThrow(ForbiddenException);
      await expect(service.removeAvatar(ORG, callers[caller], target)).rejects.toThrow(ForbiddenException);
      expect(minio.putObject).not.toHaveBeenCalled();
    });

    it('anh luu vao MinIO da bi xoa Exif/GPS (goi thang API, khong qua canvas cua web)', async () => {
      await service.setAvatar(ORG, callers.emp, 'emp', { buffer: jpeg(512, 512, true), size: 100 });
      const stored: Buffer = minio.putObject.mock.calls[0][1];
      expect(stored.includes(Buffer.from('GPS'))).toBe(false);
      expect(stored.includes(Buffer.from('Exif'))).toBe(false);
    });

    it('tu choi anh khong phai JPEG/PNG/WebP, qua nho (<128px) hoac qua 2MB', async () => {
      for (const buffer of [Buffer.from('GIF89a........'), jpeg(100, 512), Buffer.concat([jpeg(512, 512), Buffer.alloc(2 * 1024 * 1024)])]) {
        await expect(service.setAvatar(ORG, callers.emp, 'emp', { buffer, size: buffer.length })).rejects.toMatchObject({
          response: { errorCode: ERROR_CODES.AVATAR_INVALID },
        });
      }
      await expect(service.setAvatar(ORG, callers.emp, 'emp', undefined)).rejects.toThrow(BadRequestException);
    });

    it('nhat ky + su kien profile_updated CHI ten truong, khong co gia tri', async () => {
      await service.setAvatar(ORG, callers.emp, 'emp', { buffer: jpeg(512, 512), size: 100 });
      expect(manager.create).toHaveBeenCalledWith(expect.anything(), { organizationId: ORG, targetUserId: 'emp', actorId: 'emp', changedFields: ['avatar'] });
      expect(outboxService.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        eventType: EVENT_TYPES.USER_PROFILE_UPDATED,
        payload: { userId: 'emp', changedFields: ['avatar'], actorId: 'emp' },
      }));
    });
  });

  describe('directory() - danh sach nhan vien theo pham vi', () => {
    let qb: Record<string, jest.Mock>;
    beforeEach(() => {
      qb = {};
      for (const m of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
      qb.getManyAndCount = jest.fn(async () => [[users.emp], 1]);
      userRepo.createQueryBuilder.mockReturnValue(qb);
    });

    it('Employee / Manager chua co phong ban / Super Admin -> 403 DIRECTORY_FORBIDDEN', async () => {
      for (const caller of [callers.emp, callers.managerNoDept, callers.superAdmin]) {
        await expect(service.directory(ORG, caller, { page: 1, limit: 20 } as any)).rejects.toMatchObject({
          response: { errorCode: ERROR_CODES.DIRECTORY_FORBIDDEN },
        });
      }
    });

    it('Manager: khoa phong ban JWT, bo chinh minh + Manager/Org Admin; tra ho so day du', async () => {
      const res = await service.directory(ORG, callers.manager, { page: 1, limit: 20, departmentId: DEPT_B } as any);
      const conditions = qb.andWhere.mock.calls.map((c) => String(c[0]));
      expect(qb.andWhere).toHaveBeenCalledWith('u.departmentId = :callerDept', { callerDept: DEPT_A });
      expect(conditions.some((c) => c.includes("IN ('org admin', 'manager')"))).toBe(true);
      expect(conditions.some((c) => c.includes(':departmentId'))).toBe(false); // bo qua bo loc phong ban khac
      expect(res.data[0]).toMatchObject({ id: 'emp', phoneNumber: '0912345678', employeeCode: 'NV001', roleLevel: 'EMPLOYEE' });
    });

    it('Org Admin: ca to chuc, loc phong ban/trang thai/tu khoa theo yeu cau', async () => {
      await service.directory(ORG, callers.admin, { page: 1, limit: 20, departmentId: DEPT_B, status: 'ACTIVE', search: '0912 345' } as any);
      expect(qb.andWhere).toHaveBeenCalledWith('u.departmentId = :departmentId', { departmentId: DEPT_B });
      expect(qb.andWhere).toHaveBeenCalledWith('u.isActive = :isActive', { isActive: true });
    });
  });

  describe('GET /users (danh ba) - hop dong DTO', () => {
    it('KHONG BAO GIO chua phoneNumber/employeeCode, ke ca cho Org Admin', async () => {
      const res = await service.findAll(ORG, { page: 1, limit: 20 } as any, { userId: 'admin', permissions: [PERMISSIONS.USER_MANAGE], departmentId: null });
      expect(res.data[0]).not.toHaveProperty('phoneNumber');
      expect(res.data[0]).not.toHaveProperty('employeeCode');
      expect(res.data[0]).toHaveProperty('avatarUrl', null);
    });

    it('findByIdInDepartment: Employee cung phong -> co so dien thoai; Manager cung phong -> khong', async () => {
      await expect(service.findByIdInDepartment(ORG, 'emp', DEPT_A)).resolves.toHaveProperty('phoneNumber', '0912345678');
      await expect(service.findByIdInDepartment(ORG, 'manager2', DEPT_A)).resolves.not.toHaveProperty('phoneNumber');
    });
  });

  describe('so dien thoai + ma nhan vien', () => {
    it('PATCH /users/me chuan hoa so dien thoai, tu choi sai dinh dang', async () => {
      const res = await service.updateMyProfile(ORG, 'emp', { phoneNumber: '+84 987.654.321' });
      expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'emp', organizationId: ORG }, { phoneNumber: '0987654321' });
      expect(res.phoneNumber).toBe('0987654321');
      await expect(service.updateMyProfile(ORG, 'emp', { phoneNumber: '12345' })).rejects.toMatchObject({ response: { errorCode: ERROR_CODES.PHONE_INVALID } });
    });

    it('PATCH /users/:id: ma nhan vien trung (khong phan biet hoa thuong) -> 409, sai dinh dang -> 400', async () => {
      await expect(service.update(ORG, 'empB', { employeeCode: 'nv001' } as any, [PERMISSIONS.USER_MANAGE], 'admin')).rejects.toMatchObject({
        response: { errorCode: ERROR_CODES.EMPLOYEE_CODE_TAKEN },
      });
      await expect(service.update(ORG, 'empB', { employeeCode: 'NV 01' } as any, [PERMISSIONS.USER_MANAGE], 'admin')).rejects.toMatchObject({
        response: { errorCode: ERROR_CODES.EMPLOYEE_CODE_INVALID },
      });
    });

    it('vi pham unique index ma nhan vien do race -> 409 EMPLOYEE_CODE_TAKEN', async () => {
      (manager as any).findOneOrFail = jest.fn(async () => ({ ...users.empB }));
      manager.save.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505', constraint: 'uq_users_org_employee_code' }));
      await expect(service.update(ORG, 'empB', { employeeCode: 'NV777' } as any, [PERMISSIONS.USER_MANAGE], 'admin')).rejects.toThrow(ConflictException);
    });
  });

  describe('invite() - mat khau tuy chon, email kich hoat, pham vi Manager', () => {
    const dto = { email: 'New@X.vn', fullName: 'Nguoi <Moi>' };

    it('khong gui mat khau -> token INVITE 72h + email kich hoat (khong chua mat khau)', async () => {
      await service.invite(ORG, dto as any, [PERMISSIONS.USER_MANAGE]);
      expect(manager.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ purpose: 'INVITE', expiresAt: expect.any(Date) }));
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'new-id', tokenId: 'new-id' }, expect.objectContaining({ secret: 'reset', expiresIn: '72h' }));
      expect(emailService.sendInviteEmail).toHaveBeenCalledWith('new@x.vn', 'Nguoi <Moi>', 'http://web/reset-password?token=signed-token');
    });

    it('co mat khau -> khong tao token, khong gui email', async () => {
      await service.invite(ORG, { ...dto, initialPassword: 'Password123!' } as any, [PERMISSIONS.USER_MANAGE]);
      expect(emailService.sendInviteEmail).not.toHaveBeenCalled();
    });

    it('email thuoc to chuc khac -> loi chung EMAIL_UNAVAILABLE', async () => {
      userRepo.findOne.mockResolvedValueOnce({ id: 'x', organizationId: 'org-khac' });
      await expect(service.invite(ORG, dto as any, [PERMISSIONS.USER_MANAGE])).rejects.toMatchObject({ response: { errorCode: ERROR_CODES.EMAIL_UNAVAILABLE } });
    });

    it('Manager moi: phong ban ep ve phong minh; gui so dien thoai/ma NV -> 403', async () => {
      await service.invite(ORG, { ...dto, departmentId: DEPT_B } as any, [PERMISSIONS.USER_INVITE], DEPT_A);
      expect(manager.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ departmentId: DEPT_A }));
      await expect(service.invite(ORG, { ...dto, phoneNumber: '0912345678' } as any, [PERMISSIONS.USER_INVITE], DEPT_A)).rejects.toMatchObject({
        response: { errorCode: ERROR_CODES.FORBIDDEN_PROFILE_FIELDS },
      });
    });

    it('USER_REGISTERED mang roleLevel', async () => {
      manager.find.mockResolvedValueOnce([role('Manager')]);
      await service.invite(ORG, { ...dto, roleIds: ['role-Manager'] } as any, [PERMISSIONS.USER_MANAGE]);
      expect(outboxService.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        eventType: EVENT_TYPES.USER_REGISTERED,
        payload: expect.objectContaining({ roleLevel: 'MANAGER' }),
      }));
    });
  });

  // 26/10/2026: KHONG tao tai khoan 0 vai tro (Manager moi truoc day tao user 0 quyen).
  describe('invite() - vai tro Employee mac dinh', () => {
    it('khong gui roleIds (Manager hoac Org Admin) -> gan vai tro Employee cua to chuc', async () => {
      manager.find.mockImplementation(async (_e: unknown, opts: any) => (opts.where.name === 'Employee' ? [role('Employee')] : []));
      await service.invite(ORG, { email: 'moi@x.vn', fullName: 'Moi' } as any, [PERMISSIONS.USER_INVITE], DEPT_A);
      expect(manager.find).toHaveBeenCalledWith(expect.anything(), { where: { organizationId: ORG, name: 'Employee' } });
      expect(manager.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ roles: [role('Employee')] }));
      expect(outboxService.record).toHaveBeenCalledWith(manager, expect.objectContaining({ payload: expect.objectContaining({ roleLevel: 'EMPLOYEE' }) }));
    });

    it('roleIds khong khop vai tro nao cua to chuc -> van gan Employee', async () => {
      manager.find.mockImplementation(async (_e: unknown, opts: any) => (opts.where.name === 'Employee' ? [role('Employee')] : []));
      await service.invite(ORG, { email: 'moi2@x.vn', fullName: 'Moi', roleIds: ['khong-ton-tai'] } as any, [PERMISSIONS.USER_MANAGE]);
      expect(manager.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ roles: [role('Employee')] }));
    });
  });

  // 26/10/2026: PATCH /users/me/password (thay nut gia lap tren Ho so ca nhan).
  describe('changeMyPassword()', () => {
    beforeEach(() => {
      users.emp.passwordHash = bcrypt.hashSync('MatKhauCu123!', 4);
    });

    it('dung mat khau hien tai -> luu hash moi + thu hoi MOI refresh token', async () => {
      await expect(service.changeMyPassword(ORG, 'emp', { currentPassword: 'MatKhauCu123!', newPassword: 'MatKhauMoi456!' })).resolves.toEqual({ success: true });
      const [, where, values] = manager.update.mock.calls[0];
      expect(where).toEqual({ id: 'emp', organizationId: ORG });
      expect(bcrypt.compareSync('MatKhauMoi456!', values.passwordHash)).toBe(true);
      expect(manager.delete).toHaveBeenCalledWith(expect.anything(), { userId: 'emp' });
    });

    it('sai mat khau hien tai -> 400 CURRENT_PASSWORD_INVALID; trung mat khau cu -> 400', async () => {
      await expect(service.changeMyPassword(ORG, 'emp', { currentPassword: 'sai-roi', newPassword: 'MatKhauMoi456!' })).rejects.toMatchObject({
        response: { errorCode: ERROR_CODES.CURRENT_PASSWORD_INVALID },
      });
      await expect(service.changeMyPassword(ORG, 'emp', { currentPassword: 'MatKhauCu123!', newPassword: 'MatKhauCu123!' })).rejects.toMatchObject({
        response: { errorCode: ERROR_CODES.NEW_PASSWORD_SAME_AS_CURRENT },
      });
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  it('remove(): xoa vinh vien -> xoa object avatar', async () => {
    users.empB.isActive = false;
    users.empB.avatarObjectKey = 'avatar-key';
    await service.remove(ORG, 'empB', 'admin');
    expect(minio.removeObjectQuietly).toHaveBeenCalledWith('avatar-key');
    delete users.empB.avatarObjectKey;
  });
});
