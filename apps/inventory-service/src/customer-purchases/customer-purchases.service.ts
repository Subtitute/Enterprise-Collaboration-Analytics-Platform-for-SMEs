import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import {
  CustomerPurchaseCreatedPayload,
  CustomerPurchaseDeletedPayload,
  ERROR_CODES,
  EVENT_TYPES,
  PERMISSIONS,
  PaginatedResponse,
  StockMovementType,
  paginate,
} from '@app/common-dto';
import { CustomerPurchase } from '../entities/customer-purchase.entity';
import { Product } from '../entities/product.entity';
import { Warehouse } from '../entities/warehouse.entity';
import { OutboxService } from '../outbox/outbox.service';
import { StockService } from '../stock/stock.service';
import { CreateCustomerPurchaseDto } from './dto/create-customer-purchase.dto';
import { UpdateCustomerPurchaseDto } from './dto/update-customer-purchase.dto';
import { CustomerPurchaseQueryDto } from './dto/customer-purchase-query.dto';

const PRODUCER = 'inventory-service';

/**
 * "Gan mat hang cho khach hang" - nguon du lieu CHINH cho phan tich xu huong thi truong
 * (Technical_Spec.md muc 22). `customerId` KHONG duoc xac thuc ton tai thuc su o day - CRM-lite
 * Service giu Customer trong database RIENG (microservice khong goi HTTP noi bo xuyen service,
 * xem Technical_Spec.md muc 4), mirror dung gioi han da chap nhan cua Deal.customerId
 * (apps/crm-service) - Frontend chon khach hang tu danh sach CRM co san nen UUID luon hop le trong
 * thuc te, rui ro nhap sai ID qua API truc tiep (ngoai UI) duoc chap nhan o quy mo do an nay.
 */
@Injectable()
export class CustomerPurchasesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(CustomerPurchase) private readonly purchaseRepo: Repository<CustomerPurchase>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
    private readonly stockService: StockService,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * 15/10/2026: gioi han pham vi xem theo actorUserId (nguoi DA GHI NHAN giao dich) cho nguoi
   * KHONG co CUSTOMER_PURCHASE_DELETE (Employee) - mirror CHINH XAC CustomersService.findAll()
   * (CRM-lite, gate theo CUSTOMER_CREATE). GIOI HAN DA BIET: khong phai "khach hang minh phu
   * trach" (nhu Customer.ownerUserId) vi inventory-service KHONG the tra cuu quyen so huu Customer
   * xuyen service (Customer thuoc database rieng cua CRM-lite, khong co ha tang goi HTTP noi bo
   * giua cac service trong repo nay) - scope gan nhat co the lam DUNG kien truc la "giao dich TOI
   * da tu tay ghi nhan", chap nhan duoc o quy mo do an nay.
   */
  async findAll(
    organizationId: string,
    query: CustomerPurchaseQueryDto,
    callerId: string,
    callerPermissions: string[],
  ): Promise<PaginatedResponse<CustomerPurchase>> {
    const where: FindOptionsWhere<CustomerPurchase> = { organizationId };
    if (query.customerId) where.customerId = query.customerId;
    if (query.productId) where.productId = query.productId;
    if (!callerPermissions.includes(PERMISSIONS.CUSTOMER_PURCHASE_DELETE)) where.actorUserId = callerId;

    const [data, total] = await this.purchaseRepo.findAndCount({
      where,
      relations: ['product'],
      order: { purchasedAt: 'DESC', createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  async findById(organizationId: string, id: string, callerId: string, callerPermissions: string[]): Promise<CustomerPurchase> {
    const where: FindOptionsWhere<CustomerPurchase> = { id, organizationId };
    if (!callerPermissions.includes(PERMISSIONS.CUSTOMER_PURCHASE_DELETE)) where.actorUserId = callerId;

    const purchase = await this.purchaseRepo.findOne({ where, relations: ['product'] });
    if (!purchase) {
      throw new NotFoundException({ message: 'Khong tim thay giao dich', errorCode: ERROR_CODES.CUSTOMER_PURCHASE_NOT_FOUND });
    }
    return purchase;
  }

  async create(organizationId: string, actorId: string, dto: CreateCustomerPurchaseDto): Promise<CustomerPurchase> {
    const product = await this.productRepo.findOne({ where: { id: dto.productId, organizationId } });
    if (!product) {
      throw new NotFoundException({ message: 'Khong tim thay san pham', errorCode: ERROR_CODES.PRODUCT_NOT_FOUND });
    }
    if (dto.warehouseId) {
      const warehouse = await this.warehouseRepo.findOne({ where: { id: dto.warehouseId, organizationId } });
      if (!warehouse) {
        throw new NotFoundException({ message: 'Khong tim thay kho', errorCode: ERROR_CODES.WAREHOUSE_NOT_FOUND });
      }
    }
    const unitPrice = dto.unitPrice ?? product.unitPrice;

    return this.dataSource.transaction(async (manager) => {
      // Tru kho ATOMIC trong CUNG transaction voi viec tao giao dich - neu khong du ton kho,
      // ca giao dich THAT BAI cung nhau (khong co giao dich "mo coi" khong khop ton kho thuc te).
      if (dto.warehouseId) {
        await this.stockService.recordMovementInTransaction(manager, {
          organizationId,
          actorId,
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          type: StockMovementType.OUT,
          quantityDelta: -dto.quantity,
          note: `Ban hang cho khach hang (giao dich ${dto.purchasedAt})`,
        });
      }

      const purchase = await manager.save(
        manager.create(CustomerPurchase, {
          organizationId,
          customerId: dto.customerId,
          productId: dto.productId,
          warehouseId: dto.warehouseId ?? null,
          quantity: dto.quantity,
          unitPriceAtPurchase: unitPrice,
          purchasedAt: dto.purchasedAt,
          note: dto.note ?? null,
          actorUserId: actorId,
        }),
      );

      const payload: CustomerPurchaseCreatedPayload = {
        purchaseId: purchase.id,
        customerId: purchase.customerId,
        productId: purchase.productId,
        categoryId: product.categoryId,
        quantity: purchase.quantity,
        unitPrice: purchase.unitPriceAtPurchase,
        purchasedAt: purchase.purchasedAt,
        actorId,
      };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.CUSTOMER_PURCHASE_CREATED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });

      return purchase;
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomerPurchaseDto,
    callerId: string,
    callerPermissions: string[],
  ): Promise<CustomerPurchase> {
    const purchase = await this.findById(organizationId, id, callerId, callerPermissions);
    if (dto.purchasedAt !== undefined) purchase.purchasedAt = dto.purchasedAt;
    if (dto.note !== undefined) purchase.note = dto.note;
    return this.purchaseRepo.save(purchase);
  }

  /**
   * Xoa giao dich - neu da tung tru kho (warehouseId co gia tri), HOAN TAC dung so luong da tru
   * (ADJUSTMENT +quantity, CUNG transaction voi viec xoa) truoc khi xoa ban ghi, tranh "that thoat"
   * ton kho ma khong co bang chung nhap/dieu chinh tuong ung - day la phan "chat che" quan trong
   * nhat cua luong xoa.
   */
  async remove(organizationId: string, actorId: string, id: string): Promise<void> {
    const purchase = await this.purchaseRepo.findOne({ where: { id, organizationId } });
    if (!purchase) {
      throw new NotFoundException({ message: 'Khong tim thay giao dich', errorCode: ERROR_CODES.CUSTOMER_PURCHASE_NOT_FOUND });
    }

    await this.dataSource.transaction(async (manager) => {
      if (purchase.warehouseId) {
        await this.stockService.recordMovementInTransaction(manager, {
          organizationId,
          actorId,
          warehouseId: purchase.warehouseId,
          productId: purchase.productId,
          type: StockMovementType.ADJUSTMENT,
          quantityDelta: purchase.quantity,
          note: `Hoan tac ton kho do xoa giao dich #${purchase.id}`,
        });
      }
      await manager.delete(CustomerPurchase, { id, organizationId });

      const payload: CustomerPurchaseDeletedPayload = { purchaseId: id, productId: purchase.productId, actorId };
      await this.outboxService.record(manager, {
        eventType: EVENT_TYPES.CUSTOMER_PURCHASE_DELETED,
        organizationId,
        producer: PRODUCER,
        payload: payload as unknown as Record<string, unknown>,
      });
    });
  }
}
