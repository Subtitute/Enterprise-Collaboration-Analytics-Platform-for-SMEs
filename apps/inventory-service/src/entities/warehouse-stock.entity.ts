import { Check, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Product } from './product.entity';
import { Warehouse } from './warehouse.entity';

/**
 * Ton kho HIEN TAI cua 1 san pham trong 1 kho - day la gia tri DAN XUAT (derived), KHONG BAO GIO
 * duoc ghi/sua truc tiep qua API: thay doi DUY NHAT bang cach tao 1 StockMovement, trong CUNG 1
 * transaction, duoi khoa `pessimistic_write` (mirror DealsService.updateStage()/
 * TasksService.updateStatus() - xem StockService.recordMovement()). `@Check('"quantity" >= 0')` la
 * lop phong thu THU HAI o tang Postgres (logic nghiep vu da validate truoc o tang service) - dam
 * bao KHONG BAO GIO co the ton kho am du co loi o bat ky tang nao phia tren.
 */
@Entity('warehouse_stocks')
@Unique(['warehouseId', 'productId'])
@Check('"quantity" >= 0')
export class WarehouseStock extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

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

  @Column({ type: 'int', default: 0 })
  quantity: number;
}
