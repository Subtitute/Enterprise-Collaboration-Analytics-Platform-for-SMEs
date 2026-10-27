import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { DomainEvent, EVENT_TYPES } from '@app/common-dto';
import { ProjectRef } from '../entities/project-ref.entity';
import { ProjectMemberRef } from '../entities/project-member-ref.entity';

/** Hinh dang anh chup GET /internal/project-memberships cua Project-Task Service. */
export interface ProjectMembershipSnapshot {
  takenAt: string;
  // 26/10/2026: them createdByUserId (nguoi tao = "thuoc du an"); optional de doc duoc anh chup cua ban cu.
  projects: { projectId: string; organizationId: string; leadUserId: string | null; createdByUserId?: string | null; memberUserIds: string[] }[];
}

const INSERT_BATCH_SIZE = 500;

function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Loi du lieu vinh vien tu Postgres (sai kieu/vi pham rang buoc) - thu lai cung khong thanh cong. */
export function isPermanentDataError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error.driverError as { code?: string } | undefined)?.code ?? '';
  return code.startsWith('22') || code.startsWith('23');
}

/**
 * 26/10/2026: ghi read-model "tai lieu theo pham vi du an" (project_refs, project_member_refs,
 * user_department_refs). Moi su kien la 1 thay doi idempotent (ON CONFLICT / DELETE theo khoa), ap
 * dung dung thu tu partition Kafka (key = organizationId) nen phat trung hoac doc lai tu dau topic
 * deu hoi tu ve trang thai dung. SQL tho tham so hoa - moi thao tac 1 cau lenh.
 */
@Injectable()
export class ProjectScopeService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Tra ve true neu su kien thuoc read-model nay va da duoc ap dung. */
  async applyEvent(event: DomainEvent): Promise<boolean> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const organizationId = event.organizationId;
    const projectId = stringField(payload, 'projectId');
    const userId = stringField(payload, 'userId');

    switch (event.eventType) {
      case EVENT_TYPES.PROJECT_CREATED:
        if (!projectId) return false;
        // Su kien truoc 26/10/2026 khong co leadUserId -> chi tao dong, khong ghi de lead da biet.
        // 26/10/2026: them nguoi tao (createdByUserId; su kien cu chi co actorId - cung chinh la nguoi tao).
        await this.dataSource.query(
          `INSERT INTO project_refs (project_id, organization_id, lead_user_id, created_by_user_id) VALUES ($1, $2, $3, $4)
           ON CONFLICT (project_id) DO UPDATE SET
             lead_user_id = CASE WHEN $5::boolean THEN EXCLUDED.lead_user_id ELSE project_refs.lead_user_id END,
             created_by_user_id = COALESCE(EXCLUDED.created_by_user_id, project_refs.created_by_user_id)`,
          [
            projectId,
            organizationId,
            stringField(payload, 'leadUserId'),
            stringField(payload, 'createdByUserId') ?? stringField(payload, 'actorId'),
            'leadUserId' in payload,
          ],
        );
        return true;
      case EVENT_TYPES.PROJECT_LEAD_CHANGED:
        if (!projectId) return false;
        return this.upsertLead(projectId, organizationId, stringField(payload, 'leadUserId'));
      case EVENT_TYPES.PROJECT_MEMBER_ADDED:
        if (!projectId || !userId) return false;
        // 1 cau: dam bao co dong du an (su kien thanh vien co the toi truoc anh chup) roi them thanh vien.
        await this.dataSource.query(
          `WITH p AS (INSERT INTO project_refs (project_id, organization_id, lead_user_id) VALUES ($1, $3, NULL)
                      ON CONFLICT (project_id) DO NOTHING)
           INSERT INTO project_member_refs (project_id, user_id, organization_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [projectId, userId, organizationId],
        );
        return true;
      case EVENT_TYPES.PROJECT_MEMBER_REMOVED:
        if (!projectId || !userId) return false;
        await this.dataSource.query('DELETE FROM project_member_refs WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
        return true;
      case EVENT_TYPES.PROJECT_DELETED:
        if (!projectId) return false;
        // Thu muc van giu projectId (khong tu thanh "toan cong ty") - chi con Org Admin/chia se tuong minh xem duoc.
        await this.dataSource.query(
          'WITH m AS (DELETE FROM project_member_refs WHERE project_id = $1) DELETE FROM project_refs WHERE project_id = $1',
          [projectId],
        );
        return true;
      case EVENT_TYPES.USER_REGISTERED:
      case EVENT_TYPES.USER_DEPARTMENT_CHANGED:
        if (!userId) return false;
        await this.dataSource.query(
          `INSERT INTO user_department_refs (user_id, organization_id, department_id) VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE SET organization_id = EXCLUDED.organization_id, department_id = EXCLUDED.department_id`,
          [userId, organizationId, stringField(payload, 'departmentId')],
        );
        return true;
      case EVENT_TYPES.USER_DELETED:
        if (!userId) return false;
        await this.dataSource.query('DELETE FROM user_department_refs WHERE user_id = $1', [userId]);
        return true;
      default:
        return false;
    }
  }

  private async upsertLead(projectId: string, organizationId: string, leadUserId: string | null): Promise<boolean> {
    await this.dataSource.query(
      `INSERT INTO project_refs (project_id, organization_id, lead_user_id) VALUES ($1, $2, $3)
       ON CONFLICT (project_id) DO UPDATE SET lead_user_id = EXCLUDED.lead_user_id`,
      [projectId, organizationId, leadUserId],
    );
    return true;
  }

  /**
   * Thay TOAN BO du an + thanh vien bang anh chup (1 transaction). Chi goi TRUOC khi consumer Kafka
   * chay (ProjectScopeSyncService) - su kien phat sau anh chup duoc consumer doc lai sau do nen
   * khong co cua so "anh chup cu ghi de thay doi moi hon".
   */
  async replaceProjectSnapshot(snapshot: ProjectMembershipSnapshot): Promise<void> {
    const refs: ProjectRef[] = snapshot.projects.map((p) => ({
      projectId: p.projectId,
      organizationId: p.organizationId,
      leadUserId: p.leadUserId ?? null,
      createdByUserId: p.createdByUserId ?? null,
    }));
    const members: ProjectMemberRef[] = snapshot.projects.flatMap((p) =>
      p.memberUserIds.map((userId) => ({ projectId: p.projectId, userId, organizationId: p.organizationId })),
    );
    await this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM project_member_refs');
      await manager.query('DELETE FROM project_refs');
      for (let i = 0; i < refs.length; i += INSERT_BATCH_SIZE) {
        await manager.insert(ProjectRef, refs.slice(i, i + INSERT_BATCH_SIZE));
      }
      for (let i = 0; i < members.length; i += INSERT_BATCH_SIZE) {
        await manager.insert(ProjectMemberRef, members.slice(i, i + INSERT_BATCH_SIZE));
      }
    });
  }
}
