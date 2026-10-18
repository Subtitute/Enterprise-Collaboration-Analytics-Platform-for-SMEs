import { ERROR_CODES, PERMISSIONS, StockMovementType } from '@app/common-dto';
import { CustomerPurchasesService } from './customer-purchases.service';

describe('CustomerPurchasesService', () => {
  const organizationId = 'org-1';
  const actorId = 'employee-1';
  const customerId = 'cust-1';
  const productId = 'prod-1';
  const warehouseId = 'wh-1';
  const purchaseId = 'purchase-1';

  const employeePermissions = [PERMISSIONS.CUSTOMER_PURCHASE_VIEW, PERMISSIONS.CUSTOMER_PURCHASE_CREATE, PERMISSIONS.CUSTOMER_PURCHASE_UPDATE];
  const managerPermissions = [...employeePermissions, PERMISSIONS.CUSTOMER_PURCHASE_DELETE];

  function createService(opts: {
    purchaseRepoMock?: Partial<Record<string, jest.Mock>>;
    productRepoMock?: Partial<Record<string, jest.Mock>>;
    warehouseRepoMock?: Partial<Record<string, jest.Mock>>;
    stockServiceMock?: Partial<Record<string, jest.Mock>>;
  } = {}) {
    const managerMock = {
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      create: jest.fn((_entityClass: unknown, data: unknown) => data),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    const purchaseRepoMock: Record<string, jest.Mock> = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      ...opts.purchaseRepoMock,
    };
    const productRepoMock = { findOne: jest.fn().mockResolvedValue({ id: productId, organizationId, categoryId: 'cat-1', unitPrice: 1000 }), ...opts.productRepoMock };
    const warehouseRepoMock = { findOne: jest.fn().mockResolvedValue({ id: warehouseId, organizationId }), ...opts.warehouseRepoMock };
    const stockServiceMock = { recordMovementInTransaction: jest.fn().mockResolvedValue(undefined), ...opts.stockServiceMock };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

    const service = new CustomerPurchasesService(
      dataSourceMock as any,
      purchaseRepoMock as any,
      productRepoMock as any,
      warehouseRepoMock as any,
      stockServiceMock as any,
      outboxServiceMock as any,
    );
    return { service, dataSourceMock, managerMock, purchaseRepoMock, productRepoMock, warehouseRepoMock, stockServiceMock, outboxServiceMock };
  }

  describe('create', () => {
    it('tao giao dich KHONG kem warehouseId -> KHONG goi StockService (chi ghi nhan phan tich)', async () => {
      const { service, stockServiceMock, outboxServiceMock } = createService();
      const dto = { customerId, productId, quantity: 2, purchasedAt: '2026-10-15' };

      const result = await service.create(organizationId, actorId, dto as any);

      expect(stockServiceMock.recordMovementInTransaction).not.toHaveBeenCalled();
      expect(result.unitPriceAtPurchase).toBe(1000); // snapshot tu Product.unitPrice
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'customer_purchase.created' }),
      );
    });

    it('tao giao dich KEM warehouseId -> goi StockService voi OUT, quantityDelta am', async () => {
      const { service, stockServiceMock } = createService();
      const dto = { customerId, productId, warehouseId, quantity: 3, purchasedAt: '2026-10-15' };

      await service.create(organizationId, actorId, dto as any);

      expect(stockServiceMock.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: StockMovementType.OUT, quantityDelta: -3, warehouseId, productId }),
      );
    });

    it('dung unitPrice tuy chinh neu co truyen (khong dung gia Product hien tai)', async () => {
      const { service } = createService();
      const dto = { customerId, productId, quantity: 1, unitPrice: 500, purchasedAt: '2026-10-15' };

      const result = await service.create(organizationId, actorId, dto as any);

      expect(result.unitPriceAtPurchase).toBe(500);
    });

    it('tu choi khi khong tim thay san pham', async () => {
      const { service } = createService({ productRepoMock: { findOne: jest.fn().mockResolvedValue(null) } });
      const dto = { customerId, productId, quantity: 1, purchasedAt: '2026-10-15' };

      await expect(service.create(organizationId, actorId, dto as any)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.PRODUCT_NOT_FOUND }),
      });
    });
  });

  describe('findAll - pham vi xem', () => {
    it('Employee (khong co CUSTOMER_PURCHASE_DELETE) chi xem giao dich CHINH MINH ghi nhan', async () => {
      const { service, purchaseRepoMock } = createService();

      await service.findAll(organizationId, {} as any, actorId, employeePermissions);

      const callArg = purchaseRepoMock.findAndCount.mock.calls[0][0];
      expect(callArg.where.actorUserId).toBe(actorId);
    });

    it('Manager (co CUSTOMER_PURCHASE_DELETE) xem TOAN BO, khong loc actorUserId', async () => {
      const { service, purchaseRepoMock } = createService();

      await service.findAll(organizationId, {} as any, 'manager-1', managerPermissions);

      const callArg = purchaseRepoMock.findAndCount.mock.calls[0][0];
      expect(callArg.where.actorUserId).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('xoa giao dich KHONG kem warehouseId -> KHONG goi StockService', async () => {
      const { service, stockServiceMock } = createService({
        purchaseRepoMock: { findOne: jest.fn().mockResolvedValue({ id: purchaseId, organizationId, productId, warehouseId: null, quantity: 2 }) },
      });

      await service.remove(organizationId, actorId, purchaseId);

      expect(stockServiceMock.recordMovementInTransaction).not.toHaveBeenCalled();
    });

    it('xoa giao dich KEM warehouseId -> HOAN TAC ton kho (ADJUSTMENT +quantity)', async () => {
      const { service, stockServiceMock, managerMock } = createService({
        purchaseRepoMock: { findOne: jest.fn().mockResolvedValue({ id: purchaseId, organizationId, productId, warehouseId, quantity: 4 }) },
      });

      await service.remove(organizationId, actorId, purchaseId);

      expect(stockServiceMock.recordMovementInTransaction).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: StockMovementType.ADJUSTMENT, quantityDelta: 4, warehouseId, productId }),
      );
      expect(managerMock.delete).toHaveBeenCalledWith(expect.anything(), { id: purchaseId, organizationId });
    });
  });

  describe('update', () => {
    it('chi cho sua note/purchasedAt, khong anh huong quantity/unitPrice', async () => {
      const existing = { id: purchaseId, organizationId, actorUserId: actorId, quantity: 2, unitPriceAtPurchase: 1000, purchasedAt: '2026-10-01', note: null };
      const { service, purchaseRepoMock } = createService({
        purchaseRepoMock: { findOne: jest.fn().mockResolvedValue(existing), save: jest.fn((e: unknown) => Promise.resolve(e)) },
      });

      const result = await service.update(organizationId, purchaseId, { note: 'Da giao hang' } as any, actorId, employeePermissions);

      expect(result.note).toBe('Da giao hang');
      expect(result.quantity).toBe(2);
      expect(purchaseRepoMock.save).toHaveBeenCalled();
    });
  });
});
