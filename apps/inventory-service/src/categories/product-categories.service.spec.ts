import { ERROR_CODES } from '@app/common-dto';
import { ProductCategoriesService } from './product-categories.service';

/** Mirror pattern cua apps/crm-service/src/customers/customers.service.spec.ts (mock thu cong Repository). */
describe('ProductCategoriesService', () => {
  const organizationId = 'org-1';
  const categoryId = 'cat-1';

  function createService(opts: {
    categoryRepoMock?: Partial<Record<string, jest.Mock>>;
    productRepoMock?: Partial<Record<string, jest.Mock>>;
  } = {}) {
    const categoryRepoMock = {
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn((data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue(undefined),
      ...opts.categoryRepoMock,
    };
    const productRepoMock = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
      ...opts.productRepoMock,
    };
    const service = new ProductCategoriesService(categoryRepoMock as any, productRepoMock as any);
    return { service, categoryRepoMock, productRepoMock };
  }

  describe('create', () => {
    it('tao danh muc moi thanh cong', async () => {
      const { service } = createService();
      const result = await service.create(organizationId, { name: 'Laptop', description: 'May tinh xach tay' });

      expect(result.organizationId).toBe(organizationId);
      expect(result.name).toBe('Laptop');
    });
  });

  describe('findById', () => {
    it('bao NotFoundException khi khong tim thay', async () => {
      const { service } = createService({ categoryRepoMock: { findOne: jest.fn().mockResolvedValue(null) } });

      await expect(service.findById(organizationId, categoryId)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.PRODUCT_CATEGORY_NOT_FOUND }),
      });
    });
  });

  describe('remove', () => {
    it('tu choi xoa khi danh muc con san pham (409)', async () => {
      const { service } = createService({
        categoryRepoMock: { findOne: jest.fn().mockResolvedValue({ id: categoryId, organizationId, name: 'Laptop' }) },
        productRepoMock: { count: jest.fn().mockResolvedValue(3) },
      });

      await expect(service.remove(organizationId, categoryId)).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: ERROR_CODES.PRODUCT_CATEGORY_HAS_PRODUCTS }),
      });
    });

    it('xoa thanh cong khi danh muc khong con san pham nao', async () => {
      const { service, categoryRepoMock } = createService({
        categoryRepoMock: { findOne: jest.fn().mockResolvedValue({ id: categoryId, organizationId, name: 'Laptop' }) },
        productRepoMock: { count: jest.fn().mockResolvedValue(0) },
      });

      await service.remove(organizationId, categoryId);

      expect(categoryRepoMock.delete).toHaveBeenCalledWith({ id: categoryId, organizationId });
    });
  });

  describe('update', () => {
    it('chi cap nhat truong duoc truyen', async () => {
      const existing = { id: categoryId, organizationId, name: 'Laptop', description: 'Cu' };
      const { service } = createService({ categoryRepoMock: { findOne: jest.fn().mockResolvedValue(existing) } });

      const result = await service.update(organizationId, categoryId, { description: 'Moi' });

      expect(result.name).toBe('Laptop');
      expect(result.description).toBe('Moi');
    });
  });
});
