import { Column, Entity, Index } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/** Kho hang (vd "Kho Hà Nội", "Kho Hồ Chí Minh") - Technical_Spec.md muc 22. */
@Entity('warehouses')
export class Warehouse extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  address?: string | null;
}
