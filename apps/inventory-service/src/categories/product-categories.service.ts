import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { ERROR_CODES, PaginatedResponse, paginate } from '@app/common-dto';
import { Product } from '../entities/product.entity';
import { ProductCategory } from '../entities/product-category.entity';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { ProductCategoryQueryDto } from './dto/product-category-query.dto';

/** Danh muc kem so san pham dang thuoc ve no, cho danh sach (mirror CustomerListItem.openDealCount). */
export interface ProductCategoryListItem extends ProductCategory {
  productCount: number;
}

@Injectable()
export class ProductCategoriesService {
  constructor(
    @InjectRepository(ProductCategory) private readonly categoryRepo: Repository<ProductCategory>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  async findAll(organizationId: string, query: ProductCategoryQueryDto): Promise<PaginatedResponse<ProductCategoryListItem>> {
    const where: FindOptionsWhere<ProductCategory> = { organizationId };
    if (query.search) where.name = ILike(`%${query.search}%`);

    const [data, total] = await this.categoryRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const counts = await this.computeProductCounts(data.map((c) => c.id));
    const enriched: ProductCategoryListItem[] = data.map((category) => ({
      ...category,
      productCount: counts.get(category.id) ?? 0,
    }));

    return paginate(enriched, total, query.page, query.limit);
  }

  async findById(organizationId: string, id: string): Promise<ProductCategory> {
    const category = await this.categoryRepo.findOne({ where: { id, organizationId } });
    if (!category) {
      throw new NotFoundException({ message: 'Khong tim thay danh muc san pham', errorCode: ERROR_CODES.PRODUCT_CATEGORY_NOT_FOUND });
    }
    return category;
  }

  async create(organizationId: string, dto: CreateProductCategoryDto): Promise<ProductCategory> {
    const category = this.categoryRepo.create({
      organizationId,
      name: dto.name,
      description: dto.description ?? null,
    });
    return this.categoryRepo.save(category);
  }

  async update(organizationId: string, id: string, dto: UpdateProductCategoryDto): Promise<ProductCategory> {
    const category = await this.findById(organizationId, id);
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.description !== undefined) category.description = dto.description;
    return this.categoryRepo.save(category);
  }

  /**
   * 15/10/2026: khong cho xoa 1 danh muc con san pham thuoc ve no - kiem tra TRUOC o tang service
   * de tra ve 409 ro rang (thong bao tieng Viet, danh sach bao nhieu san pham) thay vi de Postgres
   * nem FK violation tho (Product.categoryId co onDelete: 'RESTRICT' lam lop phong thu THU HAI).
   */
  async remove(organizationId: string, id: string): Promise<void> {
    await this.findById(organizationId, id);
    const productCount = await this.productRepo.count({ where: { categoryId: id, organizationId } });
    if (productCount > 0) {
      throw new ConflictException({
        message: `Khong the xoa danh muc dang co ${productCount} san pham, vui long chuyen hoac xoa san pham truoc`,
        errorCode: ERROR_CODES.PRODUCT_CATEGORY_HAS_PRODUCTS,
      });
    }
    await this.categoryRepo.delete({ id, organizationId });
  }

  private async computeProductCounts(categoryIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (categoryIds.length === 0) return counts;
    for (const id of categoryIds) counts.set(id, 0);

    const rows = await this.productRepo
      .createQueryBuilder('product')
      .select('product.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .where('product.categoryId IN (:...categoryIds)', { categoryIds })
      .groupBy('product.categoryId')
      .getRawMany<{ categoryId: string; count: string }>();

    for (const row of rows) counts.set(row.categoryId, parseInt(row.count, 10));
    return counts;
  }
}
