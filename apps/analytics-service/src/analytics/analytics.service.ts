import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { resolveDocumentActivityInterval, resolveTaskTrendConfig } from './utils/range.util';

export interface AnalyticsSummary {
  totalTasksCreated: number;
  totalTasksCompleted: number;
  completionRate: number;
  newDocumentsThisWeek: number;
  activeUsersLast7Days: number;
}

export interface TaskTrendPoint {
  date: string;
  tasksCreated: number;
  tasksCompleted: number;
}

export interface TaskStatusBreakdown {
  TODO: number;
  DOING: number;
  DONE: number;
}

export interface DocumentActivityPoint {
  date: string;
  filesUploaded: number;
  filesShared: number;
}

/**
 * projectId la UUID tho, KHONG resolve ten du an o day - Analytics Service khong duoc phep
 * truy cap DB cua Project-Task Service (database-per-service, Technical_Spec.md muc 1, muc 5).
 * Frontend tu ghep noi projectId -> ten bang cach goi rieng GET /projects cua Project-Task Service.
 */
export interface ProjectProgress {
  projectId: string;
  tasksCreated: number;
  tasksCompleted: number;
  completionRate: number;
}

/** actorId la UUID tho cung ly do nhu tren - frontend tu resolve ten nguoi dung. */
export interface RecentActivityItem {
  eventId: string;
  time: string;
  eventType: string;
  producer: string;
  actorId: string | null;
  payload: Record<string, unknown>;
}

const SUMMARY_CACHE_TTL_SECONDS = 8;

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /** GET /analytics/summary - KPI card tren Dashboard (Wireframe.md muc 3). Cache Redis TTL ngan. */
  async getSummary(organizationId: string): Promise<AnalyticsSummary> {
    const cacheKey = `analytics:summary:${organizationId}`;
    const cached = await this.redisService.getJson<AnalyticsSummary>(cacheKey);
    if (cached) return cached;

    const summary = await this.computeSummary(organizationId);
    await this.redisService.setJson(cacheKey, summary, SUMMARY_CACHE_TTL_SECONDS);
    return summary;
  }

  private async computeSummary(organizationId: string): Promise<AnalyticsSummary> {
    const [taskRow] = await this.dataSource.query(
      `
      SELECT
        count(DISTINCT task_id) FILTER (WHERE event_type = 'task.created')                                AS total_tasks_created,
        count(DISTINCT task_id) FILTER (WHERE event_type = 'task.status_changed' AND to_status = 'DONE')   AS total_tasks_completed
      FROM fact_task_events
      WHERE organization_id = $1
      `,
      [organizationId],
    );

    const [docRow] = await this.dataSource.query(
      `
      SELECT count(*) AS new_documents
      FROM fact_document_events
      WHERE organization_id = $1
        AND event_type = 'document.uploaded'
        AND time >= now() - interval '7 days'
      `,
      [organizationId],
    );

    const [activeUsersRow] = await this.dataSource.query(
      `
      SELECT count(DISTINCT actor_id) AS active_users
      FROM fact_user_activity
      WHERE organization_id = $1
        AND time >= now() - interval '7 days'
        AND actor_id IS NOT NULL
      `,
      [organizationId],
    );

    const totalTasksCreated = toNumber(taskRow?.total_tasks_created);
    const totalTasksCompleted = toNumber(taskRow?.total_tasks_completed);
    const completionRate =
      totalTasksCreated > 0 ? Math.round((totalTasksCompleted / totalTasksCreated) * 100) : 0;

    return {
      totalTasksCreated,
      totalTasksCompleted,
      completionRate,
      newDocumentsThisWeek: toNumber(docRow?.new_documents),
      activeUsersLast7Days: toNumber(activeUsersRow?.active_users),
    };
  }

  /**
   * GET /analytics/task-trend?range=7d|30d|quarter - dung continuous aggregate, KHONG quet
   * hypertable tho, dam bao truy van nhanh du du lieu lich su lon (Technical_Spec.md muc 3.6).
   *
   * Ghi chu an toan SQL: `table` chi co the la 1 trong 2 chuoi co dinh lay tu whitelist
   * TASK_TREND_CONFIG (khong bao gio la gia tri tho tu query-param cua client) nen noi chuoi
   * truc tiep vao SQL o day khong tao ra injection - ten bang khong the tham so hoa trong Postgres.
   */
  async getTaskTrend(organizationId: string, range: string): Promise<TaskTrendPoint[]> {
    const { table, sinceInterval } = resolveTaskTrendConfig(range);

    const rows = await this.dataSource.query(
      `
      SELECT
        bucket,
        SUM(tasks_created)   AS tasks_created,
        SUM(tasks_completed) AS tasks_completed
      FROM ${table}
      WHERE organization_id = $1
        AND bucket >= now() - $2::interval
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      [organizationId, sinceInterval],
    );

    return rows.map((row: Record<string, unknown>) => ({
      date: new Date(row.bucket as string).toISOString(),
      tasksCreated: toNumber(row.tasks_created),
      tasksCompleted: toNumber(row.tasks_completed),
    }));
  }

  /**
   * GET /analytics/task-status-breakdown?projectId= - trang thai HIEN TAI cua task, suy ra tu
   * event log (khong co bang "current state" rieng). Logic:
   *  1. `created_tasks`: moi task_id tung co event `task.created` (thuoc to chuc/du an loc).
   *  2. `latest_status`: trang thai `to_status` MOI NHAT cua tung task_id, lay tu event
   *     `task.status_changed` (DISTINCT ON ... ORDER BY task_id, time DESC).
   *  3. LEFT JOIN 2 tap tren: task chua tung doi trang thai (khong co trong latest_status)
   *     mac dinh la 'TODO' (trang thai khoi tao khi task duoc tao).
   */
  async getTaskStatusBreakdown(
    organizationId: string,
    projectId?: string,
  ): Promise<TaskStatusBreakdown> {
    const params: unknown[] = [organizationId];
    let projectFilter = '';
    if (projectId) {
      params.push(projectId);
      projectFilter = `AND project_id = $${params.length}`;
    }

    const rows: { status: string; count: string | number }[] = await this.dataSource.query(
      `
      WITH created_tasks AS (
        SELECT DISTINCT task_id
        FROM fact_task_events
        WHERE organization_id = $1
          AND event_type = 'task.created'
          AND task_id IS NOT NULL
          ${projectFilter}
      ),
      latest_status AS (
        SELECT DISTINCT ON (task_id) task_id, to_status
        FROM fact_task_events
        WHERE organization_id = $1
          AND event_type = 'task.status_changed'
          AND task_id IS NOT NULL
        ORDER BY task_id, time DESC
      )
      SELECT COALESCE(ls.to_status, 'TODO') AS status, count(*)::int AS count
      FROM created_tasks ct
      LEFT JOIN latest_status ls ON ls.task_id = ct.task_id
      GROUP BY COALESCE(ls.to_status, 'TODO')
      `,
      params,
    );

    const breakdown: TaskStatusBreakdown = { TODO: 0, DOING: 0, DONE: 0 };
    for (const row of rows) {
      if (row.status === 'TODO' || row.status === 'DOING' || row.status === 'DONE') {
        breakdown[row.status] = toNumber(row.count);
      }
    }
    return breakdown;
  }

  /** GET /analytics/document-activity?range=7d|30d - doc truc tiep continuous aggregate. */
  async getDocumentActivity(organizationId: string, range: string): Promise<DocumentActivityPoint[]> {
    const sinceInterval = resolveDocumentActivityInterval(range);

    const rows = await this.dataSource.query(
      `
      SELECT bucket, files_uploaded, files_shared
      FROM daily_document_activity
      WHERE organization_id = $1
        AND bucket >= now() - $2::interval
      ORDER BY bucket ASC
      `,
      [organizationId, sinceInterval],
    );

    return rows.map((row: Record<string, unknown>) => ({
      date: new Date(row.bucket as string).toISOString(),
      filesUploaded: toNumber(row.files_uploaded),
      filesShared: toNumber(row.files_shared),
    }));
  }

  /**
   * GET /analytics/project-progress - % hoan thanh tung du an, dung LAI logic suy ra trang thai
   * hien tai giong getTaskStatusBreakdown() nhung group theo project_id thay vi tong hop chung.
   * CHI tra ve projectId (UUID tho) - khong resolve ten du an (xem ghi chu tren interface ProjectProgress).
   */
  async getProjectProgress(organizationId: string): Promise<ProjectProgress[]> {
    const rows = await this.dataSource.query(
      `
      WITH created_tasks AS (
        SELECT DISTINCT task_id, project_id
        FROM fact_task_events
        WHERE organization_id = $1
          AND event_type = 'task.created'
          AND task_id IS NOT NULL
          AND project_id IS NOT NULL
      ),
      latest_status AS (
        SELECT DISTINCT ON (task_id) task_id, to_status
        FROM fact_task_events
        WHERE organization_id = $1
          AND event_type = 'task.status_changed'
          AND task_id IS NOT NULL
        ORDER BY task_id, time DESC
      )
      SELECT
        ct.project_id,
        count(*)::int AS tasks_created,
        count(*) FILTER (WHERE COALESCE(ls.to_status, 'TODO') = 'DONE')::int AS tasks_completed
      FROM created_tasks ct
      LEFT JOIN latest_status ls ON ls.task_id = ct.task_id
      GROUP BY ct.project_id
      ORDER BY ct.project_id
      `,
      [organizationId],
    );

    return rows.map((row: Record<string, unknown>) => {
      const tasksCreated = toNumber(row.tasks_created);
      const tasksCompleted = toNumber(row.tasks_completed);
      return {
        projectId: row.project_id as string,
        tasksCreated,
        tasksCompleted,
        completionRate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0,
      };
    });
  }

  /** GET /analytics/recent-activity - feed su kien tho gan nhat, khac Notification ca nhan (Wireframe.md muc 3). */
  async getRecentActivity(organizationId: string): Promise<RecentActivityItem[]> {
    const rows = await this.dataSource.query(
      `
      SELECT event_id, time, event_type, producer, actor_id, payload
      FROM fact_user_activity
      WHERE organization_id = $1
      ORDER BY time DESC
      LIMIT 20
      `,
      [organizationId],
    );

    return rows.map((row: Record<string, unknown>) => ({
      eventId: row.event_id as string,
      time: new Date(row.time as string).toISOString(),
      eventType: row.event_type as string,
      producer: row.producer as string,
      actorId: (row.actor_id as string | null) ?? null,
      payload: (row.payload as Record<string, unknown>) ?? {},
    }));
  }
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
