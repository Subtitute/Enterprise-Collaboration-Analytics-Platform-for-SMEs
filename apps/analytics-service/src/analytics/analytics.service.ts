import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 25/08/2026: fix ra soat bao mat - kiem tra `departmentId` co THUC SU thuoc to chuc cua nguoi
   * goi hay khong, dung cho AiInsightsService (xem giai thich day du tai do). Analytics Service
   * khong so huu bang `Department` rieng (chi co `dim_user.department_id`, ban sao denormalize
   * dong bo qua Kafka - xem schema-bootstrap.ts) nen "phong ban hop le" o day nghia la "co it nhat
   * 1 user cua DUNG to chuc nay dang thuoc phong ban do" - dung DUNG cach dim_user da duoc dung de
   * loc KPI theo phong ban o cac ham ben duoi (computeSummary()/getTaskStatusBreakdown()/
   * getProjectProgress()), khong phat minh nguon du lieu moi.
   */
  async departmentExists(organizationId: string, departmentId: string): Promise<boolean> {
    const rows = await this.dataSource.query<{ exists: boolean }[]>(
      `SELECT EXISTS(SELECT 1 FROM dim_user WHERE organization_id = $1 AND department_id = $2) AS exists`,
      [organizationId, departmentId],
    );
    return rows[0]?.exists ?? false;
  }

  /**
   * GET /analytics/summary?range=7d|30d|quarter - KPI card tren Dashboard (Wireframe.md muc 3,
   * muc 7 - "Khoang thoi gian"). Cache Redis TTL ngan, key theo ca `range` de tranh tra nham
   * KPI da cache cua 1 khoang thoi gian khac.
   *
   * 22/07/2026: bao ca doc va ghi cache trong try/catch rieng - cache CHI la 1 buoc toi uu hoa
   * (giam tai TimescaleDB khi Dashboard polling), KHONG duoc phep bien thanh 1 dependency cung
   * bat buoc. Truoc fix nay, Redis down/timeout (vd RedisService.onModuleInit mat ket noi) se
   * lam `getJson`/`setJson` nem loi KHONG duoc bat, khien ca endpoint GET /analytics/summary
   * tra ve 500 du TimescaleDB (nguon du lieu that) van hoat dong binh thuong.
   */
  // 28/07/2026: them tham so `departmentId` tuy chon (KPI theo phong ban, threaded tu
  // AnalyticsController.getSummary()) - PHAI dua vao cacheKey (khi co gia tri) de tranh 1 request
  // co loc phong ban tra nham ket qua da cache cua request KHONG loc (hoac loc phong ban KHAC) -
  // xem computeSummary() ben duoi ve cach ap dung filter nay vao SQL. Giu nguyen dinh dang
  // cacheKey CU khi khong co departmentId (khong pha vo cache hien co cua cac request khong loc).
  async getSummary(organizationId: string, range: string, departmentId?: string): Promise<AnalyticsSummary> {
    const cacheKey = departmentId
      ? `analytics:summary:${organizationId}:${range}:dept:${departmentId}`
      : `analytics:summary:${organizationId}:${range}`;

    let cached: AnalyticsSummary | null = null;
    try {
      cached = await this.redisService.getJson<AnalyticsSummary>(cacheKey);
    } catch (err) {
      this.logger.warn(
        `Doc cache Redis that bai (key=${cacheKey}) - coi nhu cache miss va tinh lai tu TimescaleDB: ${(err as Error).message}`,
      );
    }
    if (cached) return cached;

    const summary = await this.computeSummary(organizationId, range, departmentId);

    try {
      await this.redisService.setJson(cacheKey, summary, SUMMARY_CACHE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(
        `Ghi cache Redis that bai (key=${cacheKey}) - bo qua, van tra ve ket qua da tinh cho request nay: ${(err as Error).message}`,
      );
    }

    return summary;
  }

  /**
   * Dung lai `resolveTaskTrendConfig()` (utils/range.util.ts) de gioi han sinceInterval - chi
   * lay `sinceInterval`, bo qua `table` vi cac truy van o day quet truc tiep hypertable tho
   * (fact_task_events/fact_document_events/fact_user_activity), khong dung continuous
   * aggregate nhu getTaskTrend().
   */
  private async computeSummary(
    organizationId: string,
    range: string,
    departmentId?: string,
  ): Promise<AnalyticsSummary> {
    const { sinceInterval } = resolveTaskTrendConfig(range);

    // 28/07/2026: loc cohort created_tasks theo phong ban (tuy chon) - CHI ap dung cho truy van
    // dem task (taskParams/departmentFilter ben duoi), KHONG ap dung cho 2 truy van con lai
    // (newDocumentsThisWeek/activeUsersLast7Days) vi 2 KPI do khong gan voi khai niem "assignee
    // cua task" - dim_user chi lookup duoc phong ban qua fact_task_events.assignee_id, khong co
    // nghia voi document/hoat dong nguoi dung noi chung (ngoai pham vi tinh nang nay).
    //
    // Ghi chu ve ngu nghia (QUAN TRONG, co tinh, KHONG phai bug): 1 task co the co NHIEU nguoi
    // duoc gan (nhieu event task.assigned, moi lan gan cho 1 assignee) thuoc NHIEU phong ban khac
    // nhau - task do se duoc dem VAO CA MOI phong ban lien quan khi truy van RIENG tung phong
    // ban (vi hieu suat/cong suc cua task duoc quy cho tat ca nguoi da tham gia). Vi vay tong KPI
    // cua tung phong ban CONG LAI co the LON HON KPI toan to chuc (khong loc departmentId) doi
    // voi cac task co nhieu assignee thuoc nhieu phong ban - day la thiet ke co chu dich, khong
    // phai loi tinh trung.
    const taskParams: unknown[] = [organizationId, sinceInterval];
    let departmentFilter = '';
    if (departmentId) {
      taskParams.push(departmentId);
      departmentFilter = `
          AND t.task_id IN (
            SELECT DISTINCT fte.task_id
            FROM fact_task_events fte
            JOIN dim_user du ON du.user_id = fte.assignee_id
            WHERE fte.event_type = 'task.assigned' AND du.department_id = $${taskParams.length}
          )`;
    }

    // 25/07/2026 (Fix 1 - Major, audit): thay 2 count(DISTINCT task_id) FILTER doc lap (1 loc
    // theo event_type='task.created', 1 loc theo event_type='task.status_changed AND
    // to_status=DONE') tren CUNG 1 tap hang da loc theo `t.time >= now() - interval` bang 1
    // cohort DUY NHAT - dung LAI HET pattern created_tasks/latest_status cua
    // getTaskStatusBreakdown()/getProjectProgress() o duoi. Truoc fix nay, 1 task duoc TAO
    // TRUOC khoang thoi gian nhung duoc "mo lai" (DONE -> DOING, logic status-transition cua
    // chinh service nay cho phep) roi hoan thanh LAI BEN TRONG khoang se co event
    // task.status_changed (to_status=DONE) NAM TRONG khoang nhung KHONG co event task.created
    // nao nam trong khoang -> bi dem vao total_tasks_completed ma KHONG dem vao
    // total_tasks_created, khien completionRate co the VUOT QUA 100% va lech voi
    // getTaskStatusBreakdown()/getProjectProgress() (2 endpoint nay tinh dung tu truoc vi da
    // dung cohort). Nay total_tasks_created = kich thuoc cohort (so task_id duoc TAO trong
    // khoang, sau khi loai task/project xoa cung), total_tasks_completed = so thanh vien CUA
    // CHINH cohort do co trang thai HIEN TAI (latest_status, KHONG gioi han theo khoang thoi
    // gian) la DONE - la tap con cua cohort nen ve mat toan hoc KHONG THE lon hon
    // total_tasks_created, dam bao completionRate <= 100% va nhat quan voi 2 endpoint kia cho
    // cung 1 `range`.
    const [taskRow] = await this.dataSource.query(
      `
      WITH created_tasks AS (
        SELECT DISTINCT task_id
        FROM fact_task_events t
        WHERE t.organization_id = $1
          AND t.event_type = 'task.created'
          AND t.task_id IS NOT NULL
          AND t.time >= now() - $2::interval
          ${departmentFilter}
          AND NOT EXISTS (
            SELECT 1 FROM fact_task_events d
            WHERE d.task_id = t.task_id AND d.event_type = 'task.deleted'
          )
          AND NOT EXISTS (
            SELECT 1 FROM fact_task_events pd
            WHERE pd.project_id = t.project_id AND pd.event_type = 'project.deleted'
          )
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
        count(*)::int                                                          AS total_tasks_created,
        count(*) FILTER (WHERE COALESCE(ls.to_status, 'TODO') = 'DONE')::int   AS total_tasks_completed
      FROM created_tasks ct
      LEFT JOIN latest_status ls ON ls.task_id = ct.task_id
      `,
      taskParams,
    );

    const [docRow] = await this.dataSource.query(
      `
      SELECT count(*) AS new_documents
      FROM fact_document_events
      WHERE organization_id = $1
        AND event_type = 'document.uploaded'
        AND time >= now() - $2::interval
      `,
      [organizationId, sinceInterval],
    );

    const [activeUsersRow] = await this.dataSource.query(
      `
      SELECT count(DISTINCT actor_id) AS active_users
      FROM fact_user_activity
      WHERE organization_id = $1
        AND time >= now() - $2::interval
        AND actor_id IS NOT NULL
      `,
      [organizationId, sinceInterval],
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
   *
   * 22/07/2026 (gioi han da biet - KHONG the fix o muc query nhu computeSummary()/
   * getTaskStatusBreakdown()/getProjectProgress()): endpoint nay CHUA loai tru task/project
   * da bi xoa cung (event `task.deleted`/`project.deleted`, Technical_Spec.md muc 3.3, doi
   * 21/07/2026). 2 continuous aggregate `daily_task_summary`/`weekly_project_progress`
   * (infra/timescale-init/001-init.sql) da GOP SAN `tasks_created`/`tasks_completed` thanh
   * so dem theo (bucket, organization_id, project_id) tai thoi diem materialize - khong con
   * giu task_id o muc hang de co the NOT EXISTS loai tru tung task_id bi xoa nhu cac truy van
   * quet fact_task_events tho. Chi loai tru duoc o muc project_id (aggregate co con cot nay)
   * nhung lam vay se cho ket qua KHONG NHAT QUAN voi getTaskStatusBreakdown()/
   * getProjectProgress() (loai tru ca task_id lan project_id) - vi du 1 task bi xoa rieng le
   * (project van con) van se bi dem trong bieu do xu huong nay nhung KHONG con duoc dem trong
   * task-status-breakdown/project-progress. Vi vay co tinh de nguyen, KHONG ap dung fix mot
   * phan. Muon fix dung can sua lai dinh nghia continuous aggregate de giu them task_id (hoac
   * tach 1 hypertable rieng khong gop san) - la 1 DB migration, ngoai pham vi cua fix nay (yeu
   * cau cua nhiem vu: khong sua infra/timescale-init/*.sql vi khong the re-apply cho DB dev
   * dang chay). Endpoint con gap: GET /analytics/task-trend?range=7d|30d|quarter.
   *
   * 28/07/2026 (gioi han da biet MOI - cung nguyen nhan goc voi gioi han 22/07/2026 o tren):
   * endpoint nay CUNG KHONG THE nhan tham so `departmentId` nhu computeSummary()/
   * getTaskStatusBreakdown()/getProjectProgress() da co. Loc theo phong ban can JOIN
   * fact_task_events.assignee_id -> dim_user.department_id O MUC TUNG HANG (task.assigned), nhung
   * `daily_task_summary`/`weekly_project_progress` da GOP SAN thanh so dem theo (bucket,
   * organization_id, project_id) - khong con giu task_id/assignee_id o muc hang sau khi
   * materialize nen khong the JOIN dim_user tai day. Cung ly do cau truc, khong phai thieu sot
   * rieng cho tinh nang nay - xem huong fix dung (sua dinh nghia continuous aggregate) o ghi chu
   * 22/07/2026 phia tren.
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
   * GET /analytics/task-status-breakdown?projectId=&range=7d|30d|quarter&departmentId= - trang
   * thai HIEN TAI cua cac task duoc TAO trong khoang thoi gian da chon (Wireframe.md muc 3, muc 7
   * - "Khoang thoi gian"), suy ra tu event log (khong co bang "current state" rieng). Logic:
   *  1. `created_tasks`: moi task_id tung co event `task.created` trong khoang `range`
   *     (thuoc to chuc/du an loc).
   *  2. `latest_status`: trang thai `to_status` MOI NHAT cua tung task_id, lay tu event
   *     `task.status_changed` (DISTINCT ON ... ORDER BY task_id, time DESC) - KHONG gioi han
   *     theo `range` vi trang thai hien tai co the duoc cap nhat sau thoi diem tao.
   *  3. LEFT JOIN 2 tap tren: task chua tung doi trang thai (khong co trong latest_status)
   *     mac dinh la 'TODO' (trang thai khoi tao khi task duoc tao).
   *
   * 28/07/2026: them tham so `departmentId` tuy chon (KPI theo phong ban) - loc created_tasks
   * chi con nhung task co IT NHAT 1 lan `task.assigned` cho user thuoc dung phong ban (JOIN
   * dim_user qua fact_task_events.assignee_id). Ghi chu ngu nghia (co tinh, xem giai thich day
   * du tai computeSummary()): 1 task co nhieu assignee thuoc nhieu phong ban se duoc dem o CA
   * MOI phong ban lien quan khi truy van rieng le - tong cac phong ban co the > tong toan to chuc.
   */
  async getTaskStatusBreakdown(
    organizationId: string,
    range: string,
    projectId?: string,
    departmentId?: string,
  ): Promise<TaskStatusBreakdown> {
    const { sinceInterval } = resolveTaskTrendConfig(range);
    const params: unknown[] = [organizationId, sinceInterval];
    let projectFilter = '';
    if (projectId) {
      params.push(projectId);
      projectFilter = `AND project_id = $${params.length}`;
    }
    let departmentFilter = '';
    if (departmentId) {
      params.push(departmentId);
      departmentFilter = `
          AND t.task_id IN (
            SELECT DISTINCT fte.task_id
            FROM fact_task_events fte
            JOIN dim_user du ON du.user_id = fte.assignee_id
            WHERE fte.event_type = 'task.assigned' AND du.department_id = $${params.length}
          )`;
    }

    // 22/07/2026: created_tasks them 2 dieu kien NOT EXISTS de loai tru task da bi xoa cung
    // (`task.deleted`) va task thuoc project da bi xoa cung (`project.deleted`) - cung ly do
    // nhu computeSummary() o tren (Technical_Spec.md muc 3.3, doi 21/07/2026). Can alias `t`
    // cho fact_task_events de tu-tham-chieu (self-correlate) trong subquery NOT EXISTS.
    const rows: { status: string; count: string | number }[] = await this.dataSource.query(
      `
      WITH created_tasks AS (
        SELECT DISTINCT task_id
        FROM fact_task_events t
        WHERE organization_id = $1
          AND event_type = 'task.created'
          AND task_id IS NOT NULL
          AND time >= now() - $2::interval
          ${projectFilter}
          ${departmentFilter}
          AND NOT EXISTS (
            SELECT 1 FROM fact_task_events d
            WHERE d.task_id = t.task_id AND d.event_type = 'task.deleted'
          )
          AND NOT EXISTS (
            SELECT 1 FROM fact_task_events pd
            WHERE pd.project_id = t.project_id AND pd.event_type = 'project.deleted'
          )
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
   * GET /analytics/project-progress?range=7d|30d|quarter&departmentId= - % hoan thanh tung du an
   * (tinh tren cac task duoc TAO trong khoang thoi gian da chon - Wireframe.md muc 3, muc 7 -
   * "Khoang thoi gian"), dung LAI logic suy ra trang thai hien tai giong getTaskStatusBreakdown()
   * nhung group theo project_id thay vi tong hop chung. CHI tra ve projectId (UUID tho) - khong
   * resolve ten du an (xem ghi chu tren interface ProjectProgress).
   *
   * 28/07/2026: them tham so `departmentId` tuy chon (KPI theo phong ban) - cung 1 filter
   * created_tasks nhu computeSummary()/getTaskStatusBreakdown() (JOIN dim_user qua
   * fact_task_events.assignee_id). Ghi chu ngu nghia "1 task nhieu assignee -> dem o nhieu phong
   * ban" ap dung y het - xem giai thich day du tai computeSummary().
   */
  async getProjectProgress(organizationId: string, range: string, departmentId?: string): Promise<ProjectProgress[]> {
    const { sinceInterval } = resolveTaskTrendConfig(range);
    const params: unknown[] = [organizationId, sinceInterval];
    let departmentFilter = '';
    if (departmentId) {
      params.push(departmentId);
      departmentFilter = `
          AND t.task_id IN (
            SELECT DISTINCT fte.task_id
            FROM fact_task_events fte
            JOIN dim_user du ON du.user_id = fte.assignee_id
            WHERE fte.event_type = 'task.assigned' AND du.department_id = $${params.length}
          )`;
    }
    // 22/07/2026: created_tasks them 2 dieu kien NOT EXISTS de loai tru task da bi xoa cung
    // (`task.deleted`) va project da bi xoa cung (`project.deleted`) khoi tinh % hoan thanh -
    // cung ly do nhu computeSummary()/getTaskStatusBreakdown() o tren (Technical_Spec.md muc
    // 3.3, doi 21/07/2026).
    const rows = await this.dataSource.query(
      `
      WITH created_tasks AS (
        SELECT DISTINCT task_id, project_id
        FROM fact_task_events t
        WHERE organization_id = $1
          AND event_type = 'task.created'
          AND task_id IS NOT NULL
          AND project_id IS NOT NULL
          AND time >= now() - $2::interval
          ${departmentFilter}
          AND NOT EXISTS (
            SELECT 1 FROM fact_task_events d
            WHERE d.task_id = t.task_id AND d.event_type = 'task.deleted'
          )
          AND NOT EXISTS (
            SELECT 1 FROM fact_task_events pd
            WHERE pd.project_id = t.project_id AND pd.event_type = 'project.deleted'
          )
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
      params,
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
