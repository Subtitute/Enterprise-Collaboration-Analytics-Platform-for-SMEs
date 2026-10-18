import { ERROR_CODES } from '@app/common-dto';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const organizationId = 'org-1';
  const actorId = 'user-1';
  const productId = 'prod-1';
  const categoryId = 'cat-1';

  function createService(opts: {
    productRepoMock?: Partial<Record<string, jest.Mock>>;
    categoryRepoMock?: Partial<Record<string, jest.Mock>>;
    purchaseRepoMock?: Partial<Record<string, jest.Mock>>;
    minioServiceMock?: Partial<Record<string, jest.Mock>>;
    managerMock?: Partial<Record<string, jest.Mock>>;
  } = {}) {
    const managerMock = {
      create: jest.fn((_entityClass: unknown, data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue(undefined),
      ...opts.managerMock,
    };
    const dataSourceMock = { transaction: jest.fn((cb: any) => cb(managerMock)) };
    const productRepoMock = {
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      ...opts.productRepoMock,
    };
    const categoryRepoMock = {
      findOne: jest.fn().mockResolvedValue({ id: categoryId, organizationId, name: 'Laptop' }),
      ...opts.categoryRepoMock,
    };
    const purchaseRepoMock = { count: jest.fn().mockResolvedValue(0), ...opts.purchaseRepoMock };
    const minioServiceMock = {
      putObject: jest.fn().mockResolvedValue(undefined),
      removeObject: jest.fn().mockResolvedValue(undefined),
      presignedGetObject: jest.fn().mockResolvedValue('https://minio.local/presigned'),
      ...opts.minioServiceMock,
    };
    const outboxServiceMock = { record: jest.fn().mockResolvedValue(undefined) };

    const service = new ProductsService(
      dataSourceMock as any,
      productRepoMock as any,
      categoryRepoMock as any,
      purchaseRepoMock as any,
      minioServiceMock as any,
      outboxServiceMock as any,
    );
    return { service, dataSourceMock, managerMock, productRepoMock, categoryRepoMock, purchaseRepoMock, minioServiceMock, outboxServiceMock };
  }

  describe('create', () => {
    it('tao san pham thanh cong, ghi outbox event PRODUCT_CREATED', async () => {
      const { service, outboxServiceMock } = createService();
      const dto = { categoryId, name: 'Laptop Dell XPS 13', sku: 'DELL-XPS13', unitPrice: 25000000 };

      const result = await service.create(organizationId, actorId, dto as any);

      expect(result.name).toBe('Laptop Dell XPS 13');
      expect(result.createdByUserId).toBe(actorId);
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'product.created' }),
      );
    });

    it('tu choi khi khong tim thay danh muc', async () => {
      const { service } = createService({ categoryRepoMock: { findOne: jest.fn().mockResolvedValue(null) } });
      const dto = { categoryId, name: 'x', sku: 'SKU-1' };

      await expect(service.create(organizationId, actorId, dto as any)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.PRODUCT_CATEGORY_NOT_FOUND }),
      });
    });

    it('tu choi khi SKU da ton tai trong cung to chuc (409)', async () => {
      const { service } = createService({
        productRepoMock: { findOne: jest.fn().mockResolvedValue({ id: 'other-prod', sku: 'DUP-SKU' }) },
      });
      const dto = { categoryId, name: 'x', sku: 'DUP-SKU' };

      await expect(service.create(organizationId, actorId, dto as any)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.PRODUCT_SKU_DUPLICATE }),
      });
    });
  });

  describe('remove', () => {
    it('tu choi xoa san pham da co lich su giao dich (409)', async () => {
      const { service } = createService({
        productRepoMock: { findOne: jest.fn().mockResolvedValue({ id: productId, organizationId, imageObjectKey: null }) },
        purchaseRepoMock: { count: jest.fn().mockResolvedValue(2) },
      });

      await expect(service.remove(organizationId, actorId, productId)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.PRODUCT_HAS_PURCHASE_HISTORY }),
      });
    });

    it('xoa thanh cong + xoa anh MinIO khi khong con giao dich nao', async () => {
      const { service, minioServiceMock, outboxServiceMock } = createService({
        productRepoMock: {
          findOne: jest.fn().mockResolvedValue({ id: productId, organizationId, imageObjectKey: 'org-1/prod-1/x.webp' }),
        },
        purchaseRepoMock: { count: jest.fn().mockResolvedValue(0) },
      });

      await service.remove(organizationId, actorId, productId);

      expect(minioServiceMock.removeObject).toHaveBeenCalledWith('org-1/prod-1/x.webp');
      expect(outboxServiceMock.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ eventType: 'product.deleted' }),
      );
    });
  });

  describe('setImage', () => {
    it('thay anh moi va xoa anh CU sau khi luu thanh cong', async () => {
      const { service, minioServiceMock, productRepoMock } = createService({
        productRepoMock: {
          findOne: jest.fn().mockResolvedValue({ id: productId, organizationId, imageObjectKey: 'old-key.webp' }),
          save: jest.fn((entity: unknown) => Promise.resolve(entity)),
        },
      });
      const file = {
        mimetype: 'image/webp',
        size: 1024,
        buffer: Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      } as Express.Multer.File;

      const result = await service.setImage(organizationId, productId, file);

      expect(minioServiceMock.putObject).toHaveBeenCalled();
      expect(result.imageObjectKey).not.toBe('old-key.webp');
      expect(minioServiceMock.removeObject).toHaveBeenCalledWith('old-key.webp');
      expect(productRepoMock.save).toHaveBeenCalled();
    });

    it('tu choi anh co noi dung khong khop mimetype khai bao', async () => {
      const { service } = createService({
        productRepoMock: { findOne: jest.fn().mockResolvedValue({ id: productId, organizationId, imageObjectKey: null }) },
      });
      const file = {
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // that ra la JPEG
      } as Express.Multer.File;

      await expect(service.setImage(organizationId, productId, file)).rejects.toThrow();
    });
  });
});
