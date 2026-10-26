import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';

export interface ProjectMembershipSnapshotItem {
  projectId: string;
  organizationId: string;
  leadUserId: string | null;
  // 26/10/2026: nguoi tao du an cung "thuoc du an" (lead/thanh vien/nguoi tao) - Document Service can de cap quyen tai lieu.
  createdByUserId: string | null;
  memberUserIds: string[];
}

export interface ProjectMembershipSnapshot {
  takenAt: string;
  projects: ProjectMembershipSnapshotItem[];
}

/**
 * 26/10/2026: anh chup TOAN BO du an + nguoi phu trach + thanh vien (moi to chuc) cho Document
 * Service backfill read-model "tai lieu theo pham vi du an" luc khoi dong - du lieu thanh vien co
 * tu truoc ngay nay chua tung phat su kien PROJECT_MEMBER_ADDED nao. 2 truy van, chi cac cot can
 * dung; quy mo do an (vai chuc du an) nen tra 1 lan, khong phan trang.
 */
@Injectable()
export class ProjectMembershipSnapshotService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async snapshot(): Promise<ProjectMembershipSnapshot> {
    const takenAt = new Date().toISOString();
    const [projects, members] = await Promise.all([
      this.dataSource.getRepository(Project).find({ select: { id: true, organizationId: true, leadUserId: true, createdByUserId: true } }),
      this.dataSource.getRepository(ProjectMember).find({ select: { projectId: true, userId: true } }),
    ]);
    const membersByProject = new Map<string, string[]>();
    for (const member of members) {
      const list = membersByProject.get(member.projectId) ?? [];
      list.push(member.userId);
      membersByProject.set(member.projectId, list);
    }
    return {
      takenAt,
      projects: projects.map((project) => ({
        projectId: project.id,
        organizationId: project.organizationId,
        leadUserId: project.leadUserId ?? null,
        createdByUserId: project.createdByUserId ?? null,
        memberUserIds: membersByProject.get(project.id) ?? [],
      })),
    };
  }
}
