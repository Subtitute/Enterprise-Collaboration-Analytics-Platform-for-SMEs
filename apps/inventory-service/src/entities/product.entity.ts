import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { numericTransformer } from '../common/numeric.transformer';
import { ProductCategory } from './product-category.entity';

/**
 * Mat hang trong danh muc san pham - Technical_Spec.md muc 22. `sku` duy nhat TRONG PHAM VI 1 TO
 * CHUC (khong phai toan he thong - 2 to chuc khac nhau co the trung ma SKU theo quy uoc rieng cua
 * ho, mirror cach du an nay luon scope "duy nhat" theo organizationId, xem Unique() ben duoi).
 *
 * `categoryId` FK `onDelete: 'RESTRICT'` (chu dong, khong phai mac dinh) - KHONG cho xoa 1 danh
 * muc con san pham thuoc ve no (ProductCategoriesService.remove() se nhan loi FK ngay tu Postgres
 * neu khong kiem tra truoc o tang service) - dam bao danh muc san pham khong bao gio "mo coi".
 */
@Entity('products')
@Unique(['organizationId', 'sku'])
export class Product extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Index()
  @Column({ name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => ProductCategory, (category) => category.products, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory;

  @Column()
  name: string;

  @Column()
  sku: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'unit_price', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  unitPrice: number;

  /** Object key trong bucket MinIO rieng cua service nay (xem minio/minio.service.ts) - null = chua co anh. */
  @Column({ name: 'image_object_key', type: 'varchar', nullable: true })
  imageObjectKey?: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;
}
