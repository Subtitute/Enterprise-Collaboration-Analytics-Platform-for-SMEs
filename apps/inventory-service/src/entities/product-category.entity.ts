import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Product } from './product.entity';

/** Danh muc san pham (vd "Laptop", "Linh kien PC", "Man hinh") - Technical_Spec.md muc 22. */
@Entity('product_categories')
export class ProductCategory extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
