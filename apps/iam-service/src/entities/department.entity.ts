import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity('departments')
export class Department extends AppBaseEntity {
  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization, (org) => org.departments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column()
  name: string;

  // 17/09/2026: Nguoi phu trach phong ban (Truong bo phan) - truoc day FE (DepartmentsPage.tsx)
  // chi DOAN bang cach quet danh sach user trong phong ban, tim nguoi co ROLE NAME chua
  // "lead"/"manager"/"admin", khong co du lieu that dung sau nen co the doan sai (vd chon nham 1
  // Org Admin khong lien quan toi phong ban do). Them cot that de FE doc/ghi qua API thay vi doan.
  // Mirror dung pattern Project.leadUserId (apps/project-task-service/src/entities/project.entity.ts):
  // plain UUID column, KHONG dung @ManyToOne/@JoinColumn day du - du User cung song trong DB cua
  // chinh IAM Service nay (khac voi Project.leadUserId phai tro sang User o service khac), nhung
  // Department hien chua co bat ky quan he nao toi User ngoai chieu nguoc `users: User[]` ben
  // duoi, them 1 relation moi chi de hien 1 id la khong can thiet (nguyen tac toi gian -
  // Doc/ClaudeRule.md muc 8). synchronize: true (app.module.ts) nen cot nay tu tao khi service
  // restart, khong can migration thu cong.
  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId?: string | null;

  @OneToMany(() => User, (user) => user.department)
  users: User[];
}
