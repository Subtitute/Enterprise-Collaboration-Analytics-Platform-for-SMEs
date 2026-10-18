import { ERROR_CODES, StockMovementType } from '@app/common-dto';
import { StockService } from './stock.service';

describe('StockService', () => {
  const organizationId = 'org-1';
  const actorId = 'user-1';
  const warehouseId = 'wh-1';
  const productId = 'prod-1';

  function createService(opts: {
    warehouseRepoMock?: Partial<Record<string, jest.Mock>>;
    productRepoMock?: Partial<Record<string, jest.Mock>>;
    stockRepoMock?: Partial<Record<string, jest.Mock>>;
    movementRepoMock?: Partial<Record<string, jest.Mock>>;
    dataSourceMock?: Partial<Record<string, jest.Mock>>;
  } = {}) {
    const warehouseRepoMock = { findOne: jest.fn().mockResolvedValue({ id: warehouseId, organizationId }), ...opts.warehouseRepoMock };
    const productRepoMock = { findOne: jest.fn().mockResolvedValue({ id: productId, organizationId }), ...opts.productRepoMock };
    const stockRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]), ...opts.stockRepoMock };
    const movementRepoMock = { findAndCount: jest.fn().mockResolvedValue([[], 0]), ...opts.movementRepoMock };
    const dataSourceMock = { transaction: jest.fn((cb: any) => cb(fakeManager())), ...opts.dataSourceMock };

    function fakeManager() {
      return {
        query: jest.fn().mockResolvedValue(undefined),
        findOne: jest.fn().mockResolvedValue({ warehouseId, productId, organizationId, quantity: 10 }),
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        create: jest.fn((_entityClass: unknown, data: unknown) => data),
      };
    }

    const service = new StockService(dataSourceMock as any, warehouseRepoMock as any, productRepoMock as any, stockRepoMock as any, movementRepoMock as any);
    return { service, warehouseRepoMock, productRepoMock, stockRepoMock, movementRepoMock, dataSourceMock };
  }

  function fakeManager(initialQuantity: number) {
    return {
      query: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ warehouseId, productId, organizationId, quantity: initialQuantity }),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      create: jest.fn((_entityClass: unknown, data: unknown) => data),
    };
  }

  describe('recordMovementInTransaction - huong di chuyen', () => {
    it('IN voi quantityDelta am -> tu choi (400)', async () => {
      const { service } = createService();
      const manager = fakeManager(0);

      await expect(
        service.recordMovementInTransaction(manager as any, {
          organizationId,
          actorId,
          warehouseId,
          productId,
          type: StockMovementType.IN,
          quantityDelta: -5,
        }),
      ).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.STOCK_MOVEMENT_INVALID_DIRECTION }) });
    });

    it('OUT voi quantityDelta duong -> tu choi (400)', async () => {
      const { service } = createService();
      const manager = fakeManager(10);

      await expect(
        service.recordMovementInTransaction(manager as any, {
          organizationId,
          actorId,
          warehouseId,
          productId,
          type: StockMovementType.OUT,
          quantityDelta: 5,
        }),
      ).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.STOCK_MOVEMENT_INVALID_DIRECTION }) });
    });

    it('ADJUSTMENT cho phep ca am lan duong', async () => {
      const { service } = createService();
      const manager1 = fakeManager(10);
      const manager2 = fakeManager(10);

      await expect(
        service.recordMovementInTransaction(manager1 as any, {
          organizationId, actorId, warehouseId, productId, type: StockMovementType.ADJUSTMENT, quantityDelta: -3,
        }),
      ).resolves.toBeDefined();
      await expect(
        service.recordMovementInTransaction(manager2 as any, {
          organizationId, actorId, warehouseId, productId, type: StockMovementType.ADJUSTMENT, quantityDelta: 3,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('recordMovementInTransaction - tinh ton kho', () => {
    it('nhap kho (IN) cong dung vao ton kho hien co', async () => {
      const { service } = createService();
      const manager = fakeManager(10);

      await service.recordMovementInTransaction(manager as any, {
        organizationId, actorId, warehouseId, productId, type: StockMovementType.IN, quantityDelta: 5,
      });

      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 15 }));
    });

    it('xuat kho (OUT) vuot qua ton kho hien co -> tu choi 409 STOCK_INSUFFICIENT, KHONG ghi ban ghi nao', async () => {
      const { service } = createService();
      const manager = fakeManager(3);

      await expect(
        service.recordMovementInTransaction(manager as any, {
          organizationId, actorId, warehouseId, productId, type: StockMovementType.OUT, quantityDelta: -5,
        }),
      ).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.STOCK_INSUFFICIENT }) });
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('xuat kho (OUT) dung het ton kho hien co -> ton kho ve 0, cho phep (bien, khong phai am)', async () => {
      const { service } = createService();
      const manager = fakeManager(5);

      await service.recordMovementInTransaction(manager as any, {
        organizationId, actorId, warehouseId, productId, type: StockMovementType.OUT, quantityDelta: -5,
      });

      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 0 }));
    });

    it('ton kho (warehouse, product) CHUA TUNG co bien dong van duoc upsert ngam o quantity=0 truoc khi khoa+doc', async () => {
      const { service } = createService();
      const manager = fakeManager(0);

      await service.recordMovementInTransaction(manager as any, {
        organizationId, actorId, warehouseId, productId, type: StockMovementType.IN, quantityDelta: 10,
      });

      expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (warehouse_id, product_id) DO NOTHING'), [
        organizationId, warehouseId, productId,
      ]);
      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ quantity: 10 }));
    });
  });

  describe('createMovement', () => {
    it('tu choi khi khong tim thay kho', async () => {
      const { service } = createService({ warehouseRepoMock: { findOne: jest.fn().mockResolvedValue(null) } });

      await expect(
        service.createMovement(organizationId, actorId, {
          warehouseId, productId, type: StockMovementType.IN, quantityDelta: 10,
        } as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.WAREHOUSE_NOT_FOUND }) });
    });

    it('tu choi khi khong tim thay san pham', async () => {
      const { service } = createService({ productRepoMock: { findOne: jest.fn().mockResolvedValue(null) } });

      await expect(
        service.createMovement(organizationId, actorId, {
          warehouseId, productId, type: StockMovementType.IN, quantityDelta: 10,
        } as any),
      ).rejects.toMatchObject({ response: expect.objectContaining({ errorCode: ERROR_CODES.PRODUCT_NOT_FOUND }) });
    });
  });
});
