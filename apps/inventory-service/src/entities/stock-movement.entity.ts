import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { StockMovementType } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';

/**
 * Lich su bien dong kho (nhap/xuat/dieu chinh) - NGUON SU THAT DUY NHAT cho ton kho.
 * WarehouseStock.quantity la gia tri DAN XUAT tu tong cac quantityDelta cua chinh (warehouseId,
 * productId) do - xem chu thich WarehouseStock va StockService.recordMovement(). `quantityDelta`
 * co dau (am/duong), dau quyet dinh tru/cong truc tiep vao ton kho - xem StockMovementType
 * (@app/common-dto) de biet rang buoc dau theo tung `type`.
 */
@Entity('stock_movements')
export class StockMovement extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Index()
  @Column({ name: 'warehouse_id' })
  warehouseId: string;

  @ManyToOne(() => Warehouse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse: Warehouse;

  @Index()
  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'enum', enum: StockMovementType })
  type: StockMovementType;

  @Column({ name: 'quantity_delta', type: 'int' })
  quantityDelta: number;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;
}
