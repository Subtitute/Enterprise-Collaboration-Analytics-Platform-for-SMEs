import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { ERROR_CODES, PaginatedResponse, StockMovementType, paginate } from '@app/common-dto';
import { Product } from '../entities/product.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { Warehouse } from '../entities/warehouse.entity';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockQueryDto } from './dto/stock-query.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';

/**
 * Logic ton kho - Technical_Spec.md muc 22. WarehouseStock.quantity la gia tri DAN XUAT, CHI duoc
 * thay doi qua recordMovementInTransaction() (khoa `pessimistic_write` + re-check TRONG transaction,
 * mirror CHINH XAC DealsService.updateStage()/TasksService.updateStatus() - chong race condition
 * khi 2 request ghi bien dong DONG THOI cho CUNG 1 cap (warehouse, product) co the day ton kho am).
 */
@Injectable()
export class StockService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(WarehouseStock) private readonly stockRepo: Repository<WarehouseStock>,
    @InjectRepository(StockMovement) private readonly movementRepo: Repository<StockMovement>,
  ) {}

  async findStock(organizationId: string, query: StockQueryDto): Promise<PaginatedResponse<WarehouseStock>> {
    const where: FindOptionsWhere<WarehouseStock> = { organizationId };
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;

    const [data, total] = await this.stockRepo.findAndCount({
      where,
      relations: ['warehouse', 'product'],
      order: { updatedAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  async findMovements(organizationId: string, query: StockMovementQueryDto): Promise<PaginatedResponse<StockMovement>> {
    const where: FindOptionsWhere<StockMovement> = { organizationId };
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.productId) where.productId = query.productId;

    const [data, total] = await this.movementRepo.findAndCount({
      where,
      relations: ['warehouse', 'product'],
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginate(data, total, query.page, query.limit);
  }

  /** Dung cho endpoint POST /stock-movements - tu mo transaction rieng. */
  async createMovement(organizationId: string, actorId: string, dto: CreateStockMovementDto): Promise<StockMovement> {
    this.assertDirectionValid(dto.type, dto.quantityDelta);

    const warehouse = await this.warehouseRepo.findOne({ where: { id: dto.warehouseId, organizationId } });
    if (!warehouse) {
      throw new NotFoundException({ message: 'Khong tim thay kho', errorCode: ERROR_CODES.WAREHOUSE_NOT_FOUND });
    }
    const product = await this.productRepo.findOne({ where: { id: dto.productId, organizationId } });
    if (!product) {
      throw new NotFoundException({ message: 'Khong tim thay san pham', errorCode: ERROR_CODES.PRODUCT_NOT_FOUND });
    }

    return this.dataSource.transaction((manager) =>
      this.recordMovementInTransaction(manager, {
        organizationId,
        actorId,
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        type: dto.type,
        quantityDelta: dto.quantityDelta,
        note: dto.note ?? null,
      }),
    );
  }

  /**
   * Loi CORE - dung chung boi createMovement() (endpoint POST /stock-movements) VA
   * CustomerPurchasesService.create() (khi giao dich co dinh kem warehouseId, tru kho atomic CUNG
   * transaction voi viec tao CustomerPurchase - xem CustomerPurchasesService). Nguoi goi BAT BUOC
   * da mo transaction tu truoc va truyen `manager` cua transaction do vao day (khong tu mo transaction
   * rieng - mirror pattern `runner` cua FactWriterService, apps/analytics-service).
   *
   * Dam bao mot ton kho (warehouse, product) CHUA TUNG co bien dong nao van duoc xu ly dung (upsert
   * ngam voi quantity=0 qua INSERT ... ON CONFLICT DO NOTHING TRUOC KHI khoa+doc - khong the SELECT
   * ... FOR UPDATE tren 1 hang chua ton tai).
   */
  async recordMovementInTransaction(
    manager: EntityManager,
    params: {
      organizationId: string;
      actorId: string;
      warehouseId: string;
      productId: string;
      type: StockMovementType;
      quantityDelta: number;
      note?: string | null;
    },
  ): Promise<StockMovement> {
    this.assertDirectionValid(params.type, params.quantityDelta);

    await manager.query(
      `INSERT INTO warehouse_stocks (organization_id, warehouse_id, product_id, quantity, created_at, updated_at)
       VALUES ($1, $2, $3, 0, now(), now())
       ON CONFLICT (warehouse_id, product_id) DO NOTHING`,
      [params.organizationId, params.warehouseId, params.productId],
    );

    const stock = await manager.findOne(WarehouseStock, {
      where: { warehouseId: params.warehouseId, productId: params.productId, organizationId: params.organizationId },
      lock: { mode: 'pessimistic_write' },
    });
    // Luon ton tai sau buoc INSERT ... ON CONFLICT DO NOTHING o tren - khong bao gio null thuc te,
    // kiem tra chi de TypeScript hai long voi kieu tra ve cua findOne().
    if (!stock) {
      throw new NotFoundException({ message: 'Khong tim thay ton kho', errorCode: ERROR_CODES.WAREHOUSE_NOT_FOUND });
    }

    const newQuantity = stock.quantity + params.quantityDelta;
    if (newQuantity < 0) {
      throw new ConflictException({
        message: `Khong du ton kho de xuat ${Math.abs(params.quantityDelta)} don vi (hien co ${stock.quantity})`,
        errorCode: ERROR_CODES.STOCK_INSUFFICIENT,
      });
    }
    stock.quantity = newQuantity;
    await manager.save(stock);

    const movement = manager.create(StockMovement, {
      organizationId: params.organizationId,
      warehouseId: params.warehouseId,
      productId: params.productId,
      type: params.type,
      quantityDelta: params.quantityDelta,
      note: params.note ?? null,
      actorUserId: params.actorId,
    });
    return manager.save(movement);
  }

  /**
   * IN phai duong (nhap kho), OUT phai am (xuat kho) - ADJUSTMENT cho phep ca 2 dau (dieu chinh
   * kiem ke). Xem StockMovementType (@app/common-dto) de biet day du ly do.
   */
  private assertDirectionValid(type: StockMovementType, quantityDelta: number): void {
    if (type === StockMovementType.IN && quantityDelta <= 0) {
      throw new BadRequestException({
        message: 'Nhap kho (IN) phai co quantityDelta duong',
        errorCode: ERROR_CODES.STOCK_MOVEMENT_INVALID_DIRECTION,
      });
    }
    if (type === StockMovementType.OUT && quantityDelta >= 0) {
      throw new BadRequestException({
        message: 'Xuat kho (OUT) phai co quantityDelta am',
        errorCode: ERROR_CODES.STOCK_MOVEMENT_INVALID_DIRECTION,
      });
    }
  }
}
