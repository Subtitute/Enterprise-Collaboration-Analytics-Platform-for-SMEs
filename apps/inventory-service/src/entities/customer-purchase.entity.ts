import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { numericTransformer } from '../common/numeric.transformer';
import { Product } from './product.entity';

/**
 * Giao dich "gan mat hang cho khach hang" - nguon du lieu CHINH cho phan tich xu huong thi truong
 * (Technical_Spec.md muc 22): Analytics Service tieu thu qua su kien CUSTOMER_PURCHASE_CREATED ->
 * ghi vao hypertable fact_product_sales.
 *
 * `customerId` thuoc database RIENG cua CRM-lite Service - microservice khong dung FK xuyen
 * service/DB (mirror Deal.customerId/Customer.ownerUserId).
 *
 * `productId` FK `onDelete: 'RESTRICT'` (chu dong) - KHONG cho xoa 1 san pham DA CO lich su giao
 * dich, bao toan tinh toan ven du lieu phan tich xu huong qua khu (ProductsService.remove() kiem
 * tra truoc o tang service de tra loi 409 ro rang thay vi de Postgres nem FK violation tho).
 *
 * `warehouseId` TUY CHON - co gia tri nghia la giao dich nay THAT SU tru kho (xem
 * StockService.recordMovement() duoc goi tu CustomerPurchasesService.create()), de trong nghia la
 * chi ghi nhan ban hang cho muc dich phan tich (vd nhap lich su truoc khi dung he thong kho, hoac
 * hang lay tu nguon ngoai pham vi theo doi).
 */
@Entity('customer_purchases')
export class CustomerPurchase extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @Index()
  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'warehouse_id', type: 'uuid', nullable: true })
  warehouseId?: string | null;

  @Column({ type: 'int' })
  quantity: number;

  // Snapshot gia TAI THOI DIEM giao dich - KHONG doc lai Product.unitPrice hien tai (co the da thay
  // doi sau do), dam bao bao cao lich su/phan tich xu huong luon chinh xac theo thoi gian.
  @Column({ name: 'unit_price_at_purchase', type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  unitPriceAtPurchase: number;

  // 'YYYY-MM-DD' - ngay giao dich (khong can do chinh xac gio/phut), mirror Attendance.workDate.
  @Column({ name: 'purchased_at', type: 'date' })
  purchasedAt: string;

  @Column({ type: 'text', nullable: true })
  note?: string | null;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;
}
