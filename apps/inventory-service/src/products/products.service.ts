import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { ERROR_CODES, EVENT_TYPES, PaginatedResponse, ProductCreatedPayload, ProductDeletedPayload, paginate } from '@app/common-dto';
import { CustomerPurchase } from '../entities/customer-purchase.entity';
import { Product } from '../entities/product.entity';
import { ProductCategory } from '../entities/product-category.entity';
import { MinioService } from '../minio/minio.service';
import { OutboxService } from '../outbox/outbox.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { verifyProductImageContentMatchesMimeType } from './product-image-mime-types';

const PRODUCER = 'inventory-service';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** San pham kem URL anh (presigned, 15 phut) cho hien thi - mirror cach Document Service cap URL tai file. */
export interface ProductWithImageUrl extends Product {
  imageUrl: string | null;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductCategory) private readonly categoryRepo: Repository<ProductCategory>,
    @InjectRepository(CustomerPurchase) private readonly purchaseRepo: Repository<CustomerPurchase>,
    private readonly minioService: MinioService,
    private readonly outboxService: OutboxService,
  ) {}

  async findAll(organizationId: string, query: ProductQueryDto): Promise<PaginatedResponse<ProductWithImageUrl>> {
    const where: FindOptionsWhere<Product> = { organizationId };
    if (query.search) where.name = ILike(`%${query.search}%`);
    if (query.categoryId) where.categoryId = query.categoryId;

    const [data, total] = await this.productRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const enriched = await this.withImageUrls(data);
    return paginate(enriched, total, query.page, query.limit);
  }

  async findById(organizationId: string, id: string): Promise<ProductWithImageUrl> {
    const product = await this.productRepo.findOne({ where: { id, organizationId } });
    if (!product) {
      throw new NotFoundException({ message: 'Khong tim thay san pham', errorCode: ERROR_CODES.PRODUCT_NOT_FOUND });
    }
    const [enriched] = await this.withImageUrls([product]);
    return enriched;
  }

  async create(organizationId: string, actorId: string, dto: CreateProductDto): Promise<Product> {
    const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId, organizationId } });
    if (!category) {
      throw new NotFoundException({ message: 'Khong tim thay danh muc san pham', errorCode: ERROR_CODES.PRODUCT_CATEGORY_NOT_FOUND });
    }
    await this.assertSkuAvailable(organizationId, dto.sku);

    return this.dataSource.transaction(async (manager) => {
      const product = await manager.save(
        manager.create(Product, {
          organizationId,
          categoryId: dto.categoryId,
          name: dto.name,
          sku: dto.sku,
          description: dto.description ?? null,
          unitPrice: dto.unitPrice ?? 0,
          createdByUserId: actorId,
        }),
      );

      const payload: ProductCreatedPayload = { productId: product.id, categoryId: product.categoryId, name: product.name, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.PRODUCT_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return product;
    });
  }

  async update(organizationId: string, id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id, organizationId } });
    if (!product) {
      throw new NotFoundException({ message: 'Khong tim thay san pham', errorCode: ERROR_CODES.PRODUCT_NOT_FOUND });
    }

    if (dto.categoryId !== undefined && dto.categoryId !== product.categoryId) {
      const category = await this.categoryRepo.findOne({ where: { id: dto.categoryId, organizationId } });
      if (!category) {
        throw new NotFoundException({ message: 'Khong tim thay danh muc san pham', errorCode: ERROR_CODES.PRODUCT_CATEGORY_NOT_FOUND });
      }
      product.categoryId = dto.categoryId;
    }
    if (dto.sku !== undefined && dto.sku !== product.sku) {
      await this.assertSkuAvailable(organizationId, dto.sku);
      product.sku = dto.sku;
    }
    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.unitPrice !== undefined) product.unitPrice = dto.unitPrice;

    return this.productRepo.save(product);
  }

  /**
   * 15/10/2026: khong cho xoa 1 san pham DA CO lich su giao dich - kiem tra TRUOC o tang service
   * de tra ve 409 ro rang (CustomerPurchase.productId co onDelete: 'RESTRICT' lam lop phong thu
   * THU HAI, xem chu thich tai entity). WarehouseStock/StockMovement duoc phep cascade xoa (khong
   * co y nghia lich su ngoai pham vi kho - xem chu thich tai 2 entity do).
   */
  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id, organizationId } });
    if (!product) {
      throw new NotFoundException({ message: 'Khong tim thay san pham', errorCode: ERROR_CODES.PRODUCT_NOT_FOUND });
    }
    const purchaseCount = await this.purchaseRepo.count({ where: { productId: id, organizationId } });
    if (purchaseCount > 0) {
      throw new ConflictException({
        message: `Khong the xoa san pham da co ${purchaseCount} giao dich voi khach hang`,
        errorCode: ERROR_CODES.PRODUCT_HAS_PURCHASE_HISTORY,
      });
    }

    await this.dataSource.transaction(async (manager) => {
      if (product.imageObjectKey) {
        await this.minioService.removeObject(product.imageObjectKey);
      }
      await manager.delete(Product, { id, organizationId });

      const payload: ProductDeletedPayload = { productId: id, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.PRODUCT_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });
  }

  /** Tai/thay anh san pham - xoa anh CU (neu co) sau khi anh MOI da luu thanh cong, tranh "mo coi" object neu that bai giua chung. */
  async setImage(organizationId: string, id: string, file: Express.Multer.File): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id, organizationId } });
    if (!product) {
      throw new NotFoundException({ message: 'Khong tim thay san pham', errorCode: ERROR_CODES.PRODUCT_NOT_FOUND });
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException({ message: `Anh vuot qua dung luong toi da ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB` });
    }
    verifyProductImageContentMatchesMimeType(file);

    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const objectKey = `${organizationId}/${id}/${Date.now()}.${ext}`;
    await this.minioService.putObject(objectKey, file.buffer, file.size, file.mimetype);

    const previousKey = product.imageObjectKey;
    product.imageObjectKey = objectKey;
    const saved = await this.productRepo.save(product);

    if (previousKey) {
      await this.minioService.removeObject(previousKey).catch(() => undefined);
    }
    return saved;
  }

  async removeImage(organizationId: string, id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id, organizationId } });
    if (!product) {
      throw new NotFoundException({ message: 'Khong tim thay san pham', errorCode: ERROR_CODES.PRODUCT_NOT_FOUND });
    }
    if (product.imageObjectKey) {
      await this.minioService.removeObject(product.imageObjectKey);
      product.imageObjectKey = null;
      return this.productRepo.save(product);
    }
    return product;
  }

  private async assertSkuAvailable(organizationId: string, sku: string): Promise<void> {
    const existing = await this.productRepo.findOne({ where: { organizationId, sku } });
    if (existing) {
      throw new ConflictException({ message: `SKU "${sku}" da duoc su dung boi san pham khac`, errorCode: ERROR_CODES.PRODUCT_SKU_DUPLICATE });
    }
  }

  private async withImageUrls(products: Product[]): Promise<ProductWithImageUrl[]> {
    return Promise.all(
      products.map(async (product) => ({
        ...product,
        imageUrl: product.imageObjectKey ? await this.minioService.presignedGetObject(product.imageObjectKey) : null,
      })),
    );
  }
}
