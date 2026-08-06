import { Column, Entity, Index, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/**
 * Cham cong (check-in/out) - Technical_Spec.md muc 17, Wireframe.md muc 13. 1 ban ghi/nguoi
 * dung/ngay lam viec (theo lich GMT+7 - xem attendance-date.util.ts), rang buoc bang
 * @Unique ben duoi (phong thu tang lop cung voi kiem tra o AttendanceService.checkIn()).
 *
 * QUAN TRONG: `workDate`/cac cot chuoi nullable BAT BUOC khai bao `type` tuong minh - phat hien
 * qua loi khoi dong that su o CustomerEntity (CRM-lite, xem Technical_Spec.md muc 16): union
 * TypeScript `string | null` bi reflect-metadata erase thanh `Object`, khien TypeORM nem
 * DataTypeNotSupportedError luc khoi dong neu thieu `type`.
 */
@Entity('attendances')
@Unique(['organizationId', 'userId', 'workDate'])
export class Attendance extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Ngay lam viec theo lich GMT+7, dang 'YYYY-MM-DD' - xem attendance-date.util.ts. */
  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'check_in_at', type: 'timestamptz' })
  checkInAt: Date;

  @Column({ name: 'check_in_photo_object_key', type: 'varchar' })
  checkInPhotoObjectKey: string;

  @Column({ name: 'check_out_at', type: 'timestamptz', nullable: true })
  checkOutAt?: Date | null;

  @Column({ name: 'check_out_photo_object_key', type: 'varchar', nullable: true })
  checkOutPhotoObjectKey?: string | null;
}
