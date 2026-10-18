import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { ERROR_CODES, PaginatedResponse, paginate } from '@app/common-dto';
import { Warehouse } from '../entities/warehouse.entity';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseQueryDto } from './dto/warehouse-query.dto';

/** Kho kem tong so luong ton kho (gop tat ca san pham) - cho danh sach. */
export interface WarehouseListItem extends Warehouse {
  totalStockQuantity: number;
}

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(WarehouseStock) private readonly stockRepo: Repository<WarehouseStock>,
  ) {}

  async findAll(organizationId: string, query: WarehouseQueryDto): Promise<PaginatedResponse<WarehouseListItem>> {
    const where: FindOptionsWhere<Warehouse> = { organizationId };
    if (query.search) where.name = ILike(`%${query.search}%`);

    const [data, total] = await this.warehouseRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    const totals = await this.computeStockTotals(data.map((w) => w.id));
    const enriched: WarehouseListItem[] = data.map((warehouse) => ({
      ...warehouse,
      totalStockQuantity: totals.get(warehouse.id) ?? 0,
    }));

    return paginate(enriched, total, query.page, query.limit);
  }

  async findById(organizationId: string, id: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.findOne({ where: { id, organizationId } });
    if (!warehouse) {
      throw new NotFoundException({ message: 'Khong tim thay kho', errorCode: ERROR_CODES.WAREHOUSE_NOT_FOUND });
    }
    return warehouse;
  }

  async create(organizationId: string, dto: CreateWarehouseDto): Promise<Warehouse> {
    const warehouse = this.warehouseRepo.create({ organizationId, name: dto.name, address: dto.address ?? null });
    return this.warehouseRepo.save(warehouse);
  }

  async update(organizationId: string, id: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    const warehouse = await this.findById(organizationId, id);
    if (dto.name !== undefined) warehouse.name = dto.name;
    if (dto.address !== undefined) warehouse.address = dto.address;
    return this.warehouseRepo.save(warehouse);
  }

  /**
   * 15/10/2026: khong cho xoa 1 kho CON TON KHO (quantity > 0 o bat ky san pham nao) - phai xuat
   * het hang (StockMovement type OUT) truoc khi xoa kho, tranh "lam bien mat" ton kho ma khong co
   * bang chung xuat kho tuong ung. Kho KHONG con ton kho (moi WarehouseStock = 0 hoac chua co san
   * pham nao) duoc xoa binh thuong, cascade xoa WarehouseStock/StockMovement (xem 2 entity do).
   */
  async remove(organizationId: string, id: string): Promise<void> {
    await this.findById(organizationId, id);
    const stockWithQuantity = await this.stockRepo.findOne({ where: { warehouseId: id, organizationId }, order: { quantity: 'DESC' } });
    if (stockWithQuantity && stockWithQuantity.quantity > 0) {
      throw new ConflictException({
        message: 'Khong the xoa kho con ton kho, vui long xuat het hang truoc',
        errorCode: ERROR_CODES.WAREHOUSE_HAS_STOCK,
      });
    }
    await this.warehouseRepo.delete({ id, organizationId });
  }

  private async computeStockTotals(warehouseIds: string[]): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    if (warehouseIds.length === 0) return totals;
    for (const id of warehouseIds) totals.set(id, 0);

    const rows = await this.stockRepo
      .createQueryBuilder('stock')
      .select('stock.warehouseId', 'warehouseId')
      .addSelect('COALESCE(SUM(stock.quantity), 0)', 'sum')
      .where('stock.warehouseId IN (:...warehouseIds)', { warehouseIds })
      .groupBy('stock.warehouseId')
      .getRawMany<{ warehouseId: string; sum: string }>();

    for (const row of rows) totals.set(row.warehouseId, parseInt(row.sum, 10));
    return totals;
  }
}
