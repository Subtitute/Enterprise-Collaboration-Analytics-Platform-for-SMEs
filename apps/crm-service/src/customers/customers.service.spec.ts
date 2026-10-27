import { NotFoundException } from '@nestjs/common';
import { ILike, In } from 'typeorm';
import { EVENT_TYPES, PERMISSIONS } from '@app/common-dto';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

/**
 * Unit test cho CustomersService - mock thu cong DataSource/Repository (khong boot NestJS module
 * hay DB that), mirror apps/project-task-service/src/tasks/tasks.service.spec.ts va
 * apps/project-task-service/src/projects/projects.service.spec.ts. Tap trung vao: tenant scoping
 * (organizationId) tren tung method, tinh dung openDealCount/openDealValue qua 1 truy van gop
 * (mirror ProjectsService.computeProjectStats()), va hanh vi cascade xoa Deal khi xoa Customer
 * (remove() - FK onDelete: CASCADE, xem customer.entity.ts/deal.entity.ts).
 *
 * 17/09/2026: bo sung pham vi xem theo ownerUserId (findAll()/findById() - Employee chi thay khach
 * hang minh phu trach, Manager/Org Admin thay toan bo) va cap nhat ownerUserId qua update().
 */
describe('CustomersService', () => {
  const organizationId = 'org-1';
  const customerId = 'cust-1';
  const actorId = 'actor-1';
  // 17/09/2026: mo phong 2 nhom quyen theo DEFAULT_ROLE_PERMISSIONS (permission.enum.ts) - Manager/
  // Org Admin co ca CUSTOMER_VIEW lan CUSTOMER_CREATE (xem toan bo khach hang), Employee chi co
  // CUSTOMER_VIEW (chi xem khach hang minh phu trach) - xem chu thich tai CustomersService.findAll().
  // 26/10/2026: chi Org Admin (USER_MANAGE) con xem toan bo; Manager (CUSTOMER_CREATE + phong ban)
  // xem khach hang cua phong ban - xem describe "pham vi phong ban cua Manager" o cuoi file.
  const orgAdminLikePermissions = [PERMISSIONS.USER_MANAGE, PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE];
  const managerLikePermissions = [PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE];
  const employeeLikePermissions = [PERMISSIONS.CUSTOMER_VIEW];

  /** QueryBuilder gia lap chain duoc (select/addSelect/where/andWhere/groupBy) roi tra ve rawResult o getRawMany(). */
  function makeQueryBuilder(rawResult: Array<{ customerId: string; count: string; sum: string }>) {
    const qb: any = {};
    qb.select = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.groupBy = jest.fn().mockReturnValue(qb);
    qb.getRawMany = jest.fn().mockResolvedValue(rawResult);
    return qb;
  }

  describe('findAll - tenant scoping + tim kiem + lam giau openDealCount/openDealValue qua 1 truy van gop', () => {
    it('gioi han theo organizationId, ap dung ILike khong phan biet hoa/thuong khi co search, tinh dung skip/take theo trang', async () => {
      const customerRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const dealRepoMock = { createQueryBuilder: jest.fn() };
      const service = new CustomersService(
        {} as any,
        customerRepoMock as any,
        dealRepoMock as any,
        {} as any,
      );

      await service.findAll(
        organizationId,
        { page: 2, limit: 10, search: 'Cong ty ABC' } as any,
        actorId,
        orgAdminLikePermissions,
      );

      expect(customerRepoMock.findAndCount).toHaveBeenCalledWith({
        where: { organizationId, name: ILike('%Cong ty ABC%') },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });

    it('khong ap dung filter ten neu query khong co search', async () => {
      const customerRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const dealRepoMock = { createQueryBuilder: jest.fn() };
      const service = new CustomersService(
        {} as any,
        customerRepoMock as any,
        dealRepoMock as any,
        {} as any,
      );

      await service.findAll(organizationId, { page: 1, limit: 20 } as any, actorId, orgAdminLikePermissions);

      expect(customerRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId } }),
      );
    });

    it('Employee-like caller (co CUSTOMER_VIEW nhung KHONG co CUSTOMER_CREATE) chi thay khach hang minh phu trach', async () => {
      const customerRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const dealRepoMock = { createQueryBuilder: jest.fn() };
      const service = new CustomersService(
        {} as any,
        customerRepoMock as any,
        dealRepoMock as any,
        {} as any,
      );

      await service.findAll(organizationId, { page: 1, limit: 20 } as any, actorId, employeeLikePermissions);

      expect(customerRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId, ownerUserId: In([actorId]) } }),
      );
    });

    it('lam giau moi khach hang voi openDealCount/openDealValue tu 1 truy van GROUP BY duy nhat, mac dinh 0 neu khong co deal dang hoat dong', async () => {
      const customers = [
        { id: 'c1', organizationId, name: 'A' },
        { id: 'c2', organizationId, name: 'B' },
      ];
      const customerRepoMock = { findAndCount: jest.fn().mockResolvedValue([customers, 2]) };
      const dealRepoMock = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValue(makeQueryBuilder([{ customerId: 'c1', count: '3', sum: '150.5' }])),
      };
      const service = new CustomersService(
        {} as any,
        customerRepoMock as any,
        dealRepoMock as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        actorId,
        orgAdminLikePermissions,
      );

      expect(result.data[0]).toMatchObject({ id: 'c1', openDealCount: 3, openDealValue: 150.5 });
      expect(result.data[1]).toMatchObject({ id: 'c2', openDealCount: 0, openDealValue: 0 });
      expect(dealRepoMock.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('khong goi truy van aggregate neu trang khong co khach hang nao (tranh IN () rong gay loi SQL)', async () => {
      const customerRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const dealRepoMock = { createQueryBuilder: jest.fn() };
      const service = new CustomersService(
        {} as any,
        customerRepoMock as any,
        dealRepoMock as any,
        {} as any,
      );

      const result = await service.findAll(
        organizationId,
        { page: 1, limit: 20 } as any,
        actorId,
        orgAdminLikePermissions,
      );

      expect(result.data).toEqual([]);
      expect(dealRepoMock.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('findById - tenant scoping', () => {
    it('nem NotFoundException (CUSTOMER_NOT_FOUND) neu khach hang khong ton tai hoac thuoc to chuc khac', async () => {
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new CustomersService({} as any, customerRepoMock as any, {} as any, {} as any);

      await expect(
        service.findById(organizationId, customerId, actorId, orgAdminLikePermissions),
      ).rejects.toThrow(NotFoundException);
      expect(customerRepoMock.findOne).toHaveBeenCalledWith({ where: { id: customerId, organizationId } });
    });

    it('tra ve khach hang kem openDealCount/openDealValue khi tim thay dung trong to chuc goi', async () => {
      const customer = { id: customerId, organizationId, name: 'A' };
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(customer) };
      const dealRepoMock = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValue(makeQueryBuilder([{ customerId, count: '2', sum: '500' }])),
      };
      const service = new CustomersService(
        {} as any,
        customerRepoMock as any,
        dealRepoMock as any,
        {} as any,
      );

      const result = await service.findById(organizationId, customerId, actorId, orgAdminLikePermissions);

      expect(result).toMatchObject({ id: customerId, openDealCount: 2, openDealValue: 500 });
    });

    it('Employee-like caller (khong co CUSTOMER_CREATE) them ownerUserId=chinh minh vao dieu kien truy van', async () => {
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new CustomersService({} as any, customerRepoMock as any, {} as any, {} as any);

      await expect(
        service.findById(organizationId, customerId, actorId, employeeLikePermissions),
      ).rejects.toThrow(NotFoundException);
      expect(customerRepoMock.findOne).toHaveBeenCalledWith({
        where: { organizationId, ownerUserId: In([actorId]), id: customerId },
      });
    });

    it('Employee-like caller xem duoc khach hang minh phu trach (khong bi chan boi scoping)', async () => {
      const customer = { id: customerId, organizationId, name: 'A', ownerUserId: actorId };
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(customer) };
      const dealRepoMock = {
        createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])),
      };
      const service = new CustomersService(
        {} as any,
        customerRepoMock as any,
        dealRepoMock as any,
        {} as any,
      );

      const result = await service.findById(organizationId, customerId, actorId, employeeLikePermissions);

      expect(customerRepoMock.findOne).toHaveBeenCalledWith({
        where: { organizationId, ownerUserId: In([actorId]), id: customerId },
      });
      expect(result).toMatchObject({ id: customerId, ownerUserId: actorId });
    });
  });

  describe('create', () => {
    it('tao khach hang moi voi ownerUserId = actorId, cac truong optional mac dinh null khi khong cung cap, ghi outbox CUSTOMER_CREATED cung transaction', async () => {
      const managerMock = {
        create: jest.fn().mockImplementation((_entity: unknown, data: unknown) => data),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve({ id: 'new-cust', ...entity })),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };
      const service = new CustomersService(dataSourceMock as any, {} as any, {} as any, outboxServiceMock as any);

      const dto: CreateCustomerDto = { name: 'Khach hang moi' } as CreateCustomerDto;
      const result = await service.create(organizationId, actorId, dto);

      expect(result).toMatchObject({
        id: 'new-cust',
        organizationId,
        name: 'Khach hang moi',
        email: null,
        phone: null,
        company: null,
        notes: null,
        ownerUserId: actorId,
      });
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.CUSTOMER_CREATED,
          organizationId,
          payload: expect.objectContaining({ customerId: 'new-cust', name: 'Khach hang moi', actorId }),
        }),
      );
    });
  });

  describe('update - tenant scoping + cap nhat tung phan', () => {
    it('nem NotFoundException neu khach hang khong ton tai/thuoc to chuc khac', async () => {
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const service = new CustomersService({} as any, customerRepoMock as any, {} as any, {} as any);

      await expect(service.update(organizationId, customerId, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(customerRepoMock.findOne).toHaveBeenCalledWith({ where: { id: customerId, organizationId } });
    });

    it('chi cap nhat cac truong duoc cung cap trong dto, giu nguyen cac truong con lai', async () => {
      const existing = {
        id: customerId,
        organizationId,
        name: 'Cu',
        email: 'old@x.com',
        phone: '000',
        company: 'Cong ty A',
        notes: 'Ghi chu cu',
      };
      const customerRepoMock = {
        findOne: jest.fn().mockResolvedValue(existing),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      };
      const service = new CustomersService({} as any, customerRepoMock as any, {} as any, {} as any);

      const result = await service.update(organizationId, customerId, { name: 'Moi' });

      expect(result).toMatchObject({
        name: 'Moi',
        email: 'old@x.com',
        phone: '000',
        company: 'Cong ty A',
        notes: 'Ghi chu cu',
      });
    });

    it('cap nhat ownerUserId (doi nguoi phu trach) khi dto co truyen truong nay', async () => {
      const newOwnerId = 'user-2';
      const existing = { id: customerId, organizationId, name: 'A', ownerUserId: actorId };
      const customerRepoMock = {
        findOne: jest.fn().mockResolvedValue(existing),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      };
      const service = new CustomersService({} as any, customerRepoMock as any, {} as any, {} as any);

      const result = await service.update(organizationId, customerId, { ownerUserId: newOwnerId });

      expect(result).toMatchObject({ ownerUserId: newOwnerId });
      expect(customerRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: newOwnerId }),
      );
    });

    it('giu nguyen ownerUserId neu dto khong truyen truong nay', async () => {
      const existing = { id: customerId, organizationId, name: 'A', ownerUserId: actorId };
      const customerRepoMock = {
        findOne: jest.fn().mockResolvedValue(existing),
        save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      };
      const service = new CustomersService({} as any, customerRepoMock as any, {} as any, {} as any);

      const result = await service.update(organizationId, customerId, { name: 'Moi' });

      expect(result).toMatchObject({ ownerUserId: actorId });
    });
  });

  describe('remove - cascade xoa Deal (FK onDelete CASCADE) + phat outbox event cho ca Customer lan tung Deal bi cascade', () => {
    it('nem NotFoundException khi khach hang khong ton tai/thuoc to chuc khac, KHONG mo transaction (tenant scoping)', async () => {
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(null) };
      const dataSourceMock = { transaction: jest.fn() };
      const service = new CustomersService(dataSourceMock as any, customerRepoMock as any, {} as any, {} as any);

      await expect(service.remove(organizationId, actorId, customerId)).rejects.toThrow(NotFoundException);
      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('xoa khach hang + phat dung 1 CUSTOMER_DELETED va 1 DEAL_DELETED cho MOI deal bi cascade xoa cung khach hang', async () => {
      const customer = { id: customerId, organizationId };
      const orphanedDeals = [{ id: 'deal-1' }, { id: 'deal-2' }];
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(customer),
        find: jest.fn().mockResolvedValue(orphanedDeals),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(customer) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new CustomersService(
        dataSourceMock as any,
        customerRepoMock as any,
        {} as any,
        outboxServiceMock as any,
      );

      await service.remove(organizationId, actorId, customerId);

      expect(managerMock.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          where: { id: customerId, organizationId },
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(managerMock.remove).toHaveBeenCalledTimes(1);
      // 1 CUSTOMER_DELETED + 2 DEAL_DELETED (1 event / Deal cascade-xoa cung Customer nay).
      expect(outboxServiceMock.record).toHaveBeenCalledTimes(3);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.CUSTOMER_DELETED,
          payload: expect.objectContaining({ customerId, actorId }),
        }),
      );
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.DEAL_DELETED,
          payload: expect.objectContaining({ dealId: 'deal-1', customerId, actorId }),
        }),
      );
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({
          eventType: EVENT_TYPES.DEAL_DELETED,
          payload: expect.objectContaining({ dealId: 'deal-2', customerId, actorId }),
        }),
      );
    });

    it('khong phat DEAL_DELETED nao neu khach hang khong co deal nao (danh sach orphanedDealIds rong)', async () => {
      const customer = { id: customerId, organizationId };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(customer),
        find: jest.fn().mockResolvedValue([]),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(customer) };
      const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

      const service = new CustomersService(
        dataSourceMock as any,
        customerRepoMock as any,
        {} as any,
        outboxServiceMock as any,
      );

      await service.remove(organizationId, actorId, customerId);

      expect(outboxServiceMock.record).toHaveBeenCalledTimes(1);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        managerMock,
        expect.objectContaining({ eventType: EVENT_TYPES.CUSTOMER_DELETED }),
      );
    });

    it('khong xoa/khong phat event nao neu row da bi xoa boi request dong thoi khac giua pre-check va luc khoa (idempotent)', async () => {
      const customer = { id: customerId, organizationId };
      const managerMock = {
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn(),
        remove: jest.fn(),
      };
      const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(customer) };
      const outboxServiceMock = { record: jest.fn() };

      const service = new CustomersService(
        dataSourceMock as any,
        customerRepoMock as any,
        {} as any,
        outboxServiceMock as any,
      );

      await expect(service.remove(organizationId, actorId, customerId)).resolves.toBeUndefined();

      expect(managerMock.remove).not.toHaveBeenCalled();
      expect(outboxServiceMock.record).not.toHaveBeenCalled();
    });
  });

  // 26/10/2026: Manager chi thay/sua khach hang do chinh minh hoac thanh vien phong ban phu trach.
  describe('pham vi phong ban cua Manager', () => {
    const departmentId = 'dept-1';
    const dimUserRepo = { find: jest.fn().mockResolvedValue([{ userId: 'member-1' }]) };
    const dataSourceMock = { getRepository: jest.fn().mockReturnValue(dimUserRepo) };

    it('findAll: ownerUserId thuoc {chinh minh + thanh vien phong ban}', async () => {
      const customerRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]) };
      const service = new CustomersService(dataSourceMock as any, customerRepoMock as any, {} as any, {} as any);

      await service.findAll(organizationId, { page: 1, limit: 20 } as any, actorId, managerLikePermissions, departmentId);

      expect(dimUserRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId, departmentId } }));
      expect(customerRepoMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId, ownerUserId: In([actorId, 'member-1']) } }),
      );
    });

    it('update: khach hang ngoai pham vi phong ban -> NotFoundException, khong save', async () => {
      const customerRepoMock = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
      const service = new CustomersService(dataSourceMock as any, customerRepoMock as any, {} as any, {} as any);

      await expect(
        service.update(organizationId, customerId, { name: 'X' }, { userId: actorId, permissions: managerLikePermissions, departmentId }),
      ).rejects.toThrow(NotFoundException);
      expect(customerRepoMock.save).not.toHaveBeenCalled();
    });
  });
});
