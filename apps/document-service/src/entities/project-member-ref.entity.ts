import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * 26/10/2026: read-model thanh vien du an (ProjectMember ben Project-Task Service) - xem
 * project-ref.entity.ts. Khoa chinh (projectId, userId) nen them lai 1 thanh vien da co la no-op,
 * dung voi su kien co the bi phat trung (outbox, Technical_Spec.md muc 4.1).
 */
@Entity('project_member_refs')
export class ProjectMemberRef {
  @PrimaryColumn({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Index()
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;
}
