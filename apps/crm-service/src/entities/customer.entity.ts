import { Column, Entity, Index, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Deal } from './deal.entity';

/** Khach hang - Technical_Spec.md muc 16, Wireframe.md muc 12. */
@Entity('customers')
export class Customer extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  name: string;

  // 05/08/2026 (fix loi khoi dong that): PHAI khai bao type: 'varchar' tuong minh - design:type
  // TypeScript cua union `string | null` bi erase thanh `Object` qua reflect-metadata, khien
  // TypeORM nem DataTypeNotSupportedError ("Data type Object... is not supported by postgres")
  // ngay luc khoi dong service neu thieu `type`. Mirror dung Project.description (project.entity.ts,
  // apps/project-task-service) - entity nao trong repo co cot nullable string deu khai bao type
  // tuong minh, khong entity nao dua vao suy luan tu TS type cho truong hop nay.
  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  @Column({ type: 'varchar', nullable: true })
  company?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  @OneToMany(() => Deal, (deal) => deal.customer)
  deals: Deal[];
}
