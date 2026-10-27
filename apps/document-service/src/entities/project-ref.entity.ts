import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * 26/10/2026: read-model du an (tai lieu theo pham vi du an) - ban sao TOI THIEU cua Project ben
 * Project-Task Service, chi du de quyet dinh quyen xem tai lieu: du an thuoc to chuc nao, ai la
 * nguoi phu trach. Document Service KHONG doc DB cua service khac; bang nay duoc nap bang anh chup
 * luc khoi dong (GET /internal/project-memberships) va cap nhat qua su kien Kafka - xem
 * project-scope/project-scope.service.ts. Khong co FK toi folders: thu muc van giu `projectId` ke
 * ca khi du an bi xoa (chi con Org Admin/nguoi duoc chia se tuong minh xem duoc).
 */
@Entity('project_refs')
export class ProjectRef {
  @PrimaryColumn({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'lead_user_id', type: 'uuid', nullable: true })
  leadUserId: string | null;

  // 26/10/2026: nguoi tao du an - cung la "thuoc du an" (cung dinh nghia voi Project-Task Service).
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;
}
