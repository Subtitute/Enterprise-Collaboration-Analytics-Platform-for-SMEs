import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ProjectStatus } from '@app/common-dto';
import { AppBaseEntity } from '../common/base.entity';
import { Task } from './task.entity';

// 26/08/2026 (fix code review, loi MAJOR - Fix 3): enum do uu tien du an. Khai bao CUC BO trong
// service nay (KHONG dua vao packages/common-dto/enums nhu ProjectStatus/TaskStatus) vi pham vi
// sua doi lan nay gioi han trong apps/project-task-service + apps/web, khong dung toi common-dto -
// hien chi Project dung enum nay, chua co service nao khac can dung chung.
export enum ProjectPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/** Du an - Technical_Spec.md muc 3.3, muc 5. */
@Entity('projects')
export class Project extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // 22/07/2026 (fix code review, loi MINOR - Fix 8): cot moi. Truoc do frontend (NewProjectModal.tsx)
  // da thu gui `dueDate` khi tao du an va doc `project.dueDate` de hien badge han hoan thanh
  // (ProjectCard.tsx/ProjectDetailPage.tsx), nhung entity khong co cot nay -> ValidationPipe
  // (whitelist: true) am tham strip field nay khoi body truoc khi cham toi service, badge luon rong.
  // synchronize: true (app.module.ts) nen cot nay tu tao khi service restart, khong can migration thu cong.
  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate?: Date | null;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  // 26/08/2026 (fix code review, loi MAJOR - Fix 3): 2 cot moi. Truoc ban sua nay "do uu tien" va
  // "nguoi phu trach" chi duoc luu trong localStorage['ec_projects_metadata'] cua TUNG TRINH DUYET
  // (NewProjectModal.tsx/EditProjectModal.tsx/ProjectCard.tsx/ProjectDetailPage.tsx) - nguoi dung
  // khac (hoac cung nguoi dung o may/trinh duyet khac) khong bao gio thay duoc gia tri nay, mat tac
  // dung "cong tac" cua nen tang. Chuyen thanh cot that trong DB de moi client deu doc/ghi CUNG 1
  // nguon du lieu qua API. synchronize: true (app.module.ts) nen 2 cot nay tu tao khi service
  // restart, khong can migration thu cong.
  @Column({ type: 'enum', enum: ProjectPriority, default: ProjectPriority.MEDIUM })
  priority: ProjectPriority;

  // Nguoi phu trach: id nguoi dung song o database rieng cua IAM Service - de null (chua gan) khi
  // tao du an ma khong chon nguoi phu trach; khong dung FK xuyen service/DB (cung ly do voi
  // createdByUserId ben duoi).
  @Column({ name: 'lead_user_id', type: 'uuid', nullable: true })
  leadUserId?: string | null;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];
}
