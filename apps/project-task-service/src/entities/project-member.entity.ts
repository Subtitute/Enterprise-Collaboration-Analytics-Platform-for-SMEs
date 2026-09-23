import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Project } from './project.entity';

/**
 * 22/09/2026: Thanh vien du an, doc lap voi TaskAssignee - Manager can them 1 nguoi vao du an TRUOC
 * KHI giao viec cu the cho ho (vd chuan bi nhan su cho du an moi chua co Task nao). Truoc ban them
 * nay, "thanh vien du an" chi duoc SUY TU TaskAssignee (xem ProjectsService.getVisibleProjectIds())
 * va frontend (ProjectMembersModal.tsx) gia lap rieng tinh nang "them/xoa thanh vien" hoan toan bang
 * localStorage - khong luu server-side, khong dong bo giua cac trinh duyet/thiet bi. Bang nay la
 * nguon that server-side cho quan he do. Mirror dung pattern TaskAssignee (task-assignee.entity.ts):
 * unique (projectId, userId) de idempotent khi them lai 1 nguoi da la thanh vien; khong co cot
 * "addedAt" rieng - dung lai AppBaseEntity.createdAt.
 */
@Entity('project_members')
@Unique(['projectId', 'userId'])
export class ProjectMember extends AppBaseEntity {
  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  // User song o database rieng cua IAM Service - microservice khong dung FK xuyen service/DB.
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Nguoi thuc hien thao tac them thanh vien nay - cung ly do khong FK nhu userId o tren.
  @Column({ name: 'added_by_user_id', type: 'uuid' })
  addedByUserId: string;
}
