import { ERROR_CODES } from '@app/common-dto';
import { WarehousesService } from './warehouses.service';

describe('WarehousesService', () => {
  const organizationId = 'org-1';
  const warehouseId = 'wh-1';

  function createService(opts: {
    warehouseRepoMock?: Partial<Record<string, jest.Mock>>;
    stockRepoMock?: Partial<Record<string, jest.Mock>>;
  } = {}) {
    const warehouseRepoMock = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue(undefined),
      ...opts.warehouseRepoMock,
    };
    const stockRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
      ...opts.stockRepoMock,
    };
    const service = new WarehousesService(warehouseRepoMock as any, stockRepoMock as any);
    return { service, warehouseRepoMock, stockRepoMock };
  }

  describe('remove', () => {
    it('tu choi xoa kho con ton kho (409)', async () => {
      const { service } = createService({
        warehouseRepoMock: { findOne: jest.fn().mockResolvedValue({ id: warehouseId, organizationId, name: 'Kho A' }) },
        stockRepoMock: { findOne: jest.fn().mockResolvedValue({ warehouseId, quantity: 5 }) },
      });

      await expect(service.remove(organizationId, warehouseId)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.WAREHOUSE_HAS_STOCK }),
      });
    });

    it('xoa thanh cong khi khong con ton kho (quantity cao nhat = 0)', async () => {
      const { service, warehouseRepoMock } = createService({
        warehouseRepoMock: { findOne: jest.fn().mockResolvedValue({ id: warehouseId, organizationId, name: 'Kho A' }) },
        stockRepoMock: { findOne: jest.fn().mockResolvedValue({ warehouseId, quantity: 0 }) },
      });

      await service.remove(organizationId, warehouseId);

      expect(warehouseRepoMock.delete).toHaveBeenCalledWith({ id: warehouseId, organizationId });
    });

    it('xoa thanh cong khi kho chua co san pham nao', async () => {
      const { service, warehouseRepoMock } = createService({
        warehouseRepoMock: { findOne: jest.fn().mockResolvedValue({ id: warehouseId, organizationId, name: 'Kho A' }) },
        stockRepoMock: { findOne: jest.fn().mockResolvedValue(null) },
      });

      await service.remove(organizationId, warehouseId);

      expect(warehouseRepoMock.delete).toHaveBeenCalledWith({ id: warehouseId, organizationId });
    });
  });

  describe('findById', () => {
    it('bao NotFoundException khi khong tim thay', async () => {
      const { service } = createService({ warehouseRepoMock: { findOne: jest.fn().mockResolvedValue(null) } });

      await expect(service.findById(organizationId, warehouseId)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.WAREHOUSE_NOT_FOUND }),
      });
    });
  });
});
