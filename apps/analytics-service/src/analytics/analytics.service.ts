import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ERROR_CODES, PERMISSIONS } from '@app/common-dto';
import { RedisService } from '../redis/redis.service';
import { resolveDocumentActivityInterval, resolveProductSalesTrendInterval, resolveTaskTrendConfig } from './utils/range.util';

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

/** 15/10/2026: xu huong ban hang theo ngay (Inventory Service, Technical_Spec.md muc 22). */
export interface ProductSalesTrendPoint {
  date: string;
  unitsSold: number;
  revenue: number;
}

/**
 * San pham ban chay nhat trong khoang thoi gian - productId/categoryId la UUID tho, KHONG resolve
 * ten san pham/danh muc o day (database-per-service, cung ly do voi ProjectProgress.projectId).
 * Frontend tu ghep noi qua GET /products cua Inventory Service.
 */
export interface TopProduct {
  productId: string;
  categoryId: string;
  unitsSold: number;
  revenue: number;
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

/**
 * 23/09/2026: pham vi hien thi cua getRecentActivity() - tra ve kem `data` de frontend hien thi
 * ro rang dang xem pham vi nao (yeu cau nguoi dung). Mirror NotificationVisibilityScope ben
 * Notification Service (khong dung chung 1 type qua common-dto - 2 tinh nang doc lap, chi tinh
 * co giong nhau).
 */
export type RecentActivityVisibilityScope = 'organization' | 'department' | 'self';

/**
 * 24/09/2026: pham vi cho GET /analytics/drill-down - CHI department|project (khac InsightScope
 * cua AiInsightsService co them 'organization', vi drill-down luon can 1 scopeId cu the de tra loi
 * "vi sao" cho 1 phong ban/du an - khong co y nghia drill-down cho toan to chuc).
 */
export type DrillDownScope = 'department' | 'project';

export interface DrillDownResult {
  scope: DrillDownScope;
  scopeId: string;
  totalTasks: number;
  notDoneTasks: number;
  overdueTasks: number;
  /** null neu khong co task nao (trong pham vi) dang o trang thai chua xong co nguoi duoc gan. */
  topAssignee: { userId: string; notDoneTaskCount: number } | null;
}

const SUMMARY_CACHE_TTL_SECONDS = 8;

/** 26/10/2026: ngu canh nguoi goi cho pham vi phong ban (userId/permissions/departmentId tu JWT). */
export interface AnalyticsCaller {
  userId: string;
  permissions: string[];
  departmentId: string | null;
}

/**
 * 26/10/2026: menh de SQL "task co it nhat 1 lan giao viec (task.assigned) cho user thuoc phong ban"
 * - dung chung cho moi KPI theo phong ban (truoc day lap lai nguyen van o 4 ham). `param` la vi tri
 * tham so ($n) chua departmentId.
 */
function departmentTaskFilter(param: number): string {
  return `
          AND t.task_id IN (
            SELECT DISTINCT fte.task_id
            FROM fact_task_events fte
            JOIN dim_user du ON du.user_id = fte.assignee_id
            WHERE fte.event_type = 'task.assigned' AND du.department_id = $${param}
          )`;
}

/** 26/10/2026: menh de SQL "actor_id thuoc phong ban" cho KPI tai lieu/nguoi hoat dong/ban hang theo phong ban. */
function departmentActorFilter(param: number): string {
  return `AND actor_id IN (SELECT user_id FROM dim_user WHERE department_id = $${param})`;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 26/10/2026: pham vi phong ban cua nguoi goi cho MOI endpoint KPI/dashboard - Manager KHONG con
   * xem duoc so lieu toan to chuc hay cua phong ban khac (truoc day truyen departmentId bat ky cung
   * duoc). Org Admin (USER_MANAGE): giu nguyen (tuy chon loc 1 phong ban bat ky, mac dinh toan to
   * chuc). Nguoi khac (Manager): chi phong ban cua minh (JWT) hoac phong ban minh phu trach
   * (dim_department_manager) - khong truyen departmentId thi mac dinh phong ban cua minh; truyen
   * phong ban ngoai pham vi -> 403 DEPARTMENT_SCOPE_FORBIDDEN; khong co phong ban nao -> 403
   * DEPARTMENT_SCOPE_MISSING. Tra ve departmentId de loc (undefined = toan to chuc).
   */
  async resolveDepartmentScope(
    organizationId: string,
    caller: AnalyticsCaller,
    requestedDepartmentId?: string,
  ): Promise<string | undefined> {
    if ((caller.permissions ?? []).includes(PERMISSIONS.USER_MANAGE)) return requestedDepartmentId;
    const allowed = await this.listScopeDepartmentIds(organizationId, caller);
    if (allowed.length === 0) {
      throw new ForbiddenException({
        message: 'Ban chua duoc gan phong ban nen khong xem duoc so lieu phan tich',
        errorCode: ERROR_CODES.DEPARTMENT_SCOPE_MISSING,
      });
    }
    if (!requestedDepartmentId) return allowed[0];
    if (!allowed.includes(requestedDepartmentId)) {
      throw new ForbiddenException({
        message: 'Ban chi xem duoc so lieu cua phong ban minh',
        errorCode: ERROR_CODES.DEPARTMENT_SCOPE_FORBIDDEN,
      });
    }
    return requestedDepartmentId;
  }

  /** 26/10/2026: phong ban cua chinh nguoi goi (JWT) + cac phong ban ho dang phu trach (dim_department_manager), JWT dung truoc. */
  async listScopeDepartmentIds(organizationId: string, caller: AnalyticsCaller): Promise<string[]> {
    const managed = await this.listDepartmentIdsManagedBy(organizationId, caller.userId);
    return Array.from(new Set([caller.departmentId, ...managed].filter((id): id is string => Boolean(id))));
  }

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

    // 26/10/2026: khi loc phong ban, 2 KPI tai lieu moi/thanh vien hoat dong cung chi tinh nguoi
    // thuc hien (actor_id) thuoc phong ban - truoc day 2 so nay LUON la cua toan to chuc ke ca khi
    // loc phong ban, lam Manager (nay bi ep loc theo phong ban minh) thay so lieu cua phong ban khac.
    const actorParams: unknown[] = departmentId ? [organizationId, sinceInterval, departmentId] : [organizationId, sinceInterval];
    const actorFilter = departmentId ? departmentActorFilter(3) : '';

    const [docRow] = await this.dataSource.query(
      `
      SELECT count(*) AS new_documents
      FROM fact_document_events
      WHERE organization_id = $1
        AND event_type = 'document.uploaded'
        AND time >= now() - $2::interval
        ${actorFilter}
      `,
      actorParams,
    );

    const [activeUsersRow] = await this.dataSource.query(
      `
      SELECT count(DISTINCT actor_id) AS active_users
      FROM fact_user_activity
      WHERE organization_id = $1
        AND time >= now() - $2::interval
        AND actor_id IS NOT NULL
        ${actorFilter}
      `,
      actorParams,
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
  // 26/10/2026: them `departmentId` tuy chon - khac gioi han 28/07/2026 o tren, nay CO the loc theo
  // phong ban bang cach quet THANG hypertable fact_task_events (co task_id/assignee_id o muc hang)
  // thay vi continuous aggregate - cung bucket ngay/tuan GMT+7 nhu 2 aggregate. Chi nhanh nay (Manager
  // bi ep loc theo phong ban minh, hoac Org Admin chu dong loc) tra chi phi quet bang tho; nhanh khong
  // loc giu nguyen aggregate. Quy mo do an (vai nghin su kien) khong dang ke.
  async getTaskTrend(organizationId: string, range: string, departmentId?: string): Promise<TaskTrendPoint[]> {
    const { table, sinceInterval } = resolveTaskTrendConfig(range);

    if (departmentId) {
      const bucketWidth = table === 'weekly_project_progress' ? '1 week' : '1 day';
      const deptRows = await this.dataSource.query(
        `
        SELECT
          time_bucket($3::interval, t.time, 'Asia/Ho_Chi_Minh')                                  AS bucket,
          count(*) FILTER (WHERE t.event_type = 'task.created')                                   AS tasks_created,
          count(*) FILTER (WHERE t.event_type = 'task.status_changed' AND t.to_status = 'DONE')   AS tasks_completed
        FROM fact_task_events t
        WHERE t.organization_id = $1
          AND t.time >= now() - $2::interval
          ${departmentTaskFilter(4)}
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [organizationId, sinceInterval, bucketWidth, departmentId],
      );
      return deptRows.map((row: Record<string, unknown>) => ({
        date: new Date(row.bucket as string).toISOString(),
        tasksCreated: toNumber(row.tasks_created),
        tasksCompleted: toNumber(row.tasks_completed),
      }));
    }

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
  // 26/10/2026: `departmentId` tuy chon - chi dem tai lieu do nguoi thuoc phong ban tai len/chia se,
  // quet thang fact_document_events (aggregate khong giu actor_id), bucket ngay GMT+7 nhu aggregate.
  async getDocumentActivity(organizationId: string, range: string, departmentId?: string): Promise<DocumentActivityPoint[]> {
    const sinceInterval = resolveDocumentActivityInterval(range);

    if (departmentId) {
      const deptRows = await this.dataSource.query(
        `
        SELECT
          time_bucket('1 day', time, 'Asia/Ho_Chi_Minh')                          AS bucket,
          count(*) FILTER (WHERE event_type = 'document.uploaded')                AS files_uploaded,
          count(*) FILTER (WHERE event_type = 'document.shared')                  AS files_shared
        FROM fact_document_events
        WHERE organization_id = $1
          AND time >= now() - $2::interval
          ${departmentActorFilter(3)}
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [organizationId, sinceInterval, departmentId],
      );
      return deptRows.map((row: Record<string, unknown>) => ({
        date: new Date(row.bucket as string).toISOString(),
        filesUploaded: toNumber(row.files_uploaded),
        filesShared: toNumber(row.files_shared),
      }));
    }

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
   * 15/10/2026: GET /analytics/product-sales-trend?range=7d|30d - xu huong ban hang theo ngay,
   * gop TOAN BO danh muc/san pham (Inventory Service, Technical_Spec.md muc 22) - mirror CHINH
   * XAC getDocumentActivity() o tren, doc tu continuous aggregate daily_product_sales_summary.
   */
  // 26/10/2026: `departmentId` tuy chon - chi giao dich do nguoi thuoc phong ban ghi nhan (actor_id),
  // quet thang fact_product_sales (aggregate khong giu actor_id).
  async getProductSalesTrend(organizationId: string, range: string, departmentId?: string): Promise<ProductSalesTrendPoint[]> {
    const sinceInterval = resolveProductSalesTrendInterval(range);

    if (departmentId) {
      const deptRows = await this.dataSource.query(
        `
        SELECT
          time_bucket('1 day', time, 'Asia/Ho_Chi_Minh')   AS bucket,
          SUM(quantity)                                     AS units_sold,
          SUM(quantity * unit_price)                        AS revenue
        FROM fact_product_sales
        WHERE organization_id = $1
          AND event_type = 'customer_purchase.created'
          AND time >= now() - $2::interval
          ${departmentActorFilter(3)}
        GROUP BY bucket
        ORDER BY bucket ASC
        `,
        [organizationId, sinceInterval, departmentId],
      );
      return deptRows.map((row: Record<string, unknown>) => ({
        date: new Date(row.bucket as string).toISOString(),
        unitsSold: toNumber(row.units_sold),
        revenue: toNumber(row.revenue),
      }));
    }

    const rows = await this.dataSource.query(
      `
      SELECT
        bucket,
        SUM(units_sold)              AS units_sold,
        SUM(revenue)                 AS revenue
      FROM daily_product_sales_summary
      WHERE organization_id = $1
        AND bucket >= now() - $2::interval
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      [organizationId, sinceInterval],
    );

    return rows.map((row: Record<string, unknown>) => ({
      date: new Date(row.bucket as string).toISOString(),
      unitsSold: toNumber(row.units_sold),
      revenue: toNumber(row.revenue),
    }));
  }

  /**
   * 15/10/2026: GET /analytics/top-products?range=7d|30d&limit=5 - san pham ban chay nhat (theo
   * doanh thu) trong khoang thoi gian - cung mot phan "phan tich xu huong thi truong" voi
   * getProductSalesTrend() o tren nhung tra loi cau hoi "CAI GI dang ban chay" thay vi "xu huong
   * THEO THOI GIAN nhu the nao". `limit` tuy chon, mac dinh 5, tran toi da 20 (chan lam dung truy
   * van - mirror tinh than @Max() cua PaginationQueryDto, khong can them 1 DTO rieng chi cho 1
   * tham so).
   */
  // 26/10/2026: `departmentId` tuy chon - cung cach loc voi getProductSalesTrend() o tren.
  async getTopProducts(organizationId: string, range: string, limit = 5, departmentId?: string): Promise<TopProduct[]> {
    const sinceInterval = resolveProductSalesTrendInterval(range);
    const cappedLimit = Math.min(Math.max(1, limit), 20);

    const rows = departmentId
      ? await this.dataSource.query(
          `
          SELECT
            product_id,
            category_id,
            SUM(quantity)              AS units_sold,
            SUM(quantity * unit_price) AS revenue
          FROM fact_product_sales
          WHERE organization_id = $1
            AND event_type = 'customer_purchase.created'
            AND time >= now() - $2::interval
            ${departmentActorFilter(4)}
          GROUP BY product_id, category_id
          ORDER BY revenue DESC
          LIMIT $3
          `,
          [organizationId, sinceInterval, cappedLimit, departmentId],
        )
      : await this.dataSource.query(
          `
      SELECT
        product_id,
        category_id,
        SUM(units_sold) AS units_sold,
        SUM(revenue)    AS revenue
      FROM daily_product_sales_summary
      WHERE organization_id = $1
        AND bucket >= now() - $2::interval
      GROUP BY product_id, category_id
      ORDER BY revenue DESC
      LIMIT $3
      `,
          [organizationId, sinceInterval, cappedLimit],
        );

    return rows.map((row: Record<string, unknown>) => ({
      productId: row.product_id as string,
      categoryId: row.category_id as string,
      unitsSold: toNumber(row.units_sold),
      revenue: toNumber(row.revenue),
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

  /**
   * 22/09/2026: danh sach departmentId dang co it nhat 1 user cua to chuc nay - dung boi
   * AiInsightsService de quet KPI cua NHIEU phong ban cung luc (xem buildCandidates()), mirror
   * dung nguon du lieu voi departmentExists() o tren (dim_user, ban sao denormalize dong bo qua
   * Kafka - khong co bang Department rieng trong Analytics Service).
   */
  async listActiveDepartmentIds(organizationId: string): Promise<string[]> {
    const rows = await this.dataSource.query<{ department_id: string }[]>(
      `SELECT DISTINCT department_id FROM dim_user WHERE organization_id = $1 AND department_id IS NOT NULL`,
      [organizationId],
    );
    return rows.map((row) => row.department_id);
  }

  /**
   * 23/09/2026: danh sach departmentId ma `managerId` nay dang la nguoi phu trach - dung boi
   * getRecentActivity() de xac dinh pham vi hien thi cua 1 Manager (xem chu thich tai do). Nguon
   * dim_department_manager (ban sao denormalize dong bo qua Kafka - xem DEPARTMENT_MANAGER_CHANGED,
   * schema-bootstrap.ts), mirror dung cau truc voi listActiveDepartmentIds() o tren.
   */
  async listDepartmentIdsManagedBy(organizationId: string, managerId: string): Promise<string[]> {
    const rows = await this.dataSource.query<{ department_id: string }[]>(
      `SELECT department_id FROM dim_department_manager WHERE organization_id = $1 AND manager_id = $2`,
      [organizationId, managerId],
    );
    return rows.map((row) => row.department_id);
  }

  /**
   * GET /analytics/recent-activity - feed su kien tho gan nhat, khac Notification ca nhan
   * (Wireframe.md muc 3).
   *
   * 23/09/2026: pham vi hien thi THEO CAP DO (yeu cau nguoi dung - can RO RANG, mirror dung tinh
   * than NotificationsService.resolveVisibleUserIds() ben Notification Service):
   *  - Org Admin (co PERMISSIONS.USER_MANAGE) -> toan bo to chuc (hanh vi cu, khong doi).
   *  - Manager dang phu trach >=1 phong ban -> CHI hoat dong ma actor_id thuoc (cac) phong ban ho
   *    phu trach (qua dim_user.department_id) + hoat dong cua CHINH HO.
   *  - Con lai (Employee, hoac Manager khong phu trach phong ban nao) -> CHI hoat dong cua chinh
   *    minh.
   */
  // 26/10/2026: them `callerDepartmentId` (JWT) - "phong ban cua Manager" nay gom CA phong ban minh
  // thuoc ve LAN phong ban minh phu trach (listScopeDepartmentIds()), thong nhat voi moi KPI khac.
  async getRecentActivity(
    organizationId: string,
    callerId: string,
    callerPermissions: string[],
    callerDepartmentId: string | null = null,
  ): Promise<{ data: RecentActivityItem[]; scope: RecentActivityVisibilityScope }> {
    let actorFilterSql = '';
    const params: unknown[] = [organizationId];
    let scope: RecentActivityVisibilityScope = 'organization';

    if (!callerPermissions.includes(PERMISSIONS.USER_MANAGE)) {
      const managedDepartmentIds = await this.listScopeDepartmentIds(organizationId, {
        userId: callerId,
        permissions: callerPermissions,
        departmentId: callerDepartmentId,
      });
      if (managedDepartmentIds.length > 0) {
        params.push(callerId, managedDepartmentIds);
        actorFilterSql = `
          AND (
            actor_id = $2
            OR actor_id IN (SELECT user_id FROM dim_user WHERE department_id = ANY($3::uuid[]))
          )`;
        scope = 'department';
      } else {
        params.push(callerId);
        actorFilterSql = `AND actor_id = $2`;
        scope = 'self';
      }
    }

    const rows = await this.dataSource.query(
      `
      SELECT event_id, time, event_type, producer, actor_id, payload
      FROM fact_user_activity
      WHERE organization_id = $1
        -- 24/09/2026: loai bo hang KHONG CO actor_id - nguon DUY NHAT tao ra hang nhu vay la
        -- UserDepartmentSyncService (resync tu dong MOI LAN iam-service khoi dong, khong phai do 1
        -- nguoi vua thao tac - xem chu thich actorId tren UserDepartmentChangedPayload). Hang nay
        -- van duoc ghi vao fact_user_activity (giu nguyen idempotency/audit trail) nhung KHONG nen
        -- hien thi trong "Hoat dong gan day" - khong co "ai" de gan cho dong chu ngu, frontend chi
        -- con cach fallback ve "Mot thanh vien" (xem RecentActivityFeed.tsx). Loc tai day (khong
        -- phai luc ghi) de MOI truy van doc (REST + so dem) deu nhat quan.
        AND actor_id IS NOT NULL
      ${actorFilterSql}
      ORDER BY time DESC
      LIMIT 20
      `,
      params,
    );

    const data = rows.map((row: Record<string, unknown>) => ({
      eventId: row.event_id as string,
      time: new Date(row.time as string).toISOString(),
      eventType: row.event_type as string,
      producer: row.producer as string,
      actorId: (row.actor_id as string | null) ?? null,
      payload: (row.payload as Record<string, unknown>) ?? {},
    }));
    return { data, scope };
  }

  /**
   * GET /analytics/drill-down?scope=department|project&scopeId=X&range=Y - Layer 2 Diagnostic:
   * tra loi "vi sao" cho 1 phong ban/du an cu the (phau: Tong task -> Chua xong -> Qua han -> Tap
   * trung o 1 nguoi) - bam vao 1 thanh trong AiInsightsChart.tsx (chinh scope/scopeId cua
   * StructuredInsight.evidence, xem ai-insights.service.ts) se goi endpoint nay.
   *
   * Pham vi truy cap (mirror getRecentActivity() o tren, KHONG de lo du lieu ngoai pham vi nguoi
   * goi):
   *  - Org Admin (co PERMISSIONS.USER_MANAGE) -> xem duoc moi scope/scopeId.
   *  - scope=department -> CHI Manager dang phu trach DUNG phong ban do (qua
   *    listDepartmentIdsManagedBy()) moi duoc xem; con lai bi tu choi.
   *  - scope=project -> GIOI HAN CO CHU DICH cho doi nay: Analytics Service khong co bang thanh
   *    vien du an rieng (database-per-service - Project-Task Service moi biet ai thuoc du an nao),
   *    nen KHONG the xac dinh "Manager/Employee nay co thuoc du an X khong" ma khong goi HTTP
   *    xuyen service (vi pham quy uoc Kafka-only). Vi vay drill-down theo du an TAM THOI chi danh
   *    cho Org Admin - ghi trong Technical_Spec.md nhu 1 gioi han da biet cua dot nay.
   *
   * GIOI HAN DA BIET (mirror ghi chu TaskCreatedPayload.dueDate): overdueTasks/due_date phan anh
   * han hoan thanh TAI THOI DIEM TAO task, chua dong bo neu doi han sau qua PATCH /tasks/:id.
   *
   * 26/10/2026: (1) "phong ban cua Manager" gom ca phong ban minh thuoc ve (JWT, `callerDepartmentId`)
   * lan phong ban phu trach - thong nhat voi resolveDepartmentScope(); (2) scope=project NAY mo cho
   * Manager nhung CHI dem task co nguoi duoc giao thuoc phong ban cua Manager (khong lo task cua phong
   * ban khac trong cung du an) - van khong can bang thanh vien du an rieng. Org Admin khong doi.
   */
  async getDrillDown(
    organizationId: string,
    scope: DrillDownScope,
    scopeId: string,
    range: string,
    callerId: string,
    callerPermissions: string[],
    callerDepartmentId: string | null = null,
  ): Promise<DrillDownResult> {
    let callerDepartmentIds: string[] | null = null;
    if (!callerPermissions.includes(PERMISSIONS.USER_MANAGE)) {
      callerDepartmentIds = await this.listScopeDepartmentIds(organizationId, {
        userId: callerId,
        permissions: callerPermissions,
        departmentId: callerDepartmentId,
      });
      const forbidden =
        scope === 'department' ? !callerDepartmentIds.includes(scopeId) : callerDepartmentIds.length === 0;
      if (forbidden) {
        throw new ForbiddenException({
          message: 'Ban chi xem duoc chi tiet drill-down trong pham vi phong ban cua minh',
          errorCode: ERROR_CODES.DRILL_DOWN_SCOPE_FORBIDDEN,
        });
      }
    }

    const { sinceInterval } = resolveTaskTrendConfig(range);
    const params: unknown[] = [organizationId, sinceInterval, scopeId];
    let scopeFilter =
      scope === 'department'
        ? `AND t.task_id IN (
             SELECT DISTINCT fte.task_id
             FROM fact_task_events fte
             JOIN dim_user du ON du.user_id = fte.assignee_id
             WHERE fte.event_type = 'task.assigned' AND du.department_id = $3
           )`
        : `AND t.project_id = $3`;
    if (scope === 'project' && callerDepartmentIds) {
      params.push(callerDepartmentIds);
      scopeFilter += `
           AND t.task_id IN (
             SELECT DISTINCT fte.task_id
             FROM fact_task_events fte
             JOIN dim_user du ON du.user_id = fte.assignee_id
             WHERE fte.event_type = 'task.assigned' AND du.department_id = ANY($4::uuid[])
           )`;
    }

    const [countsRow] = await this.dataSource.query(
      `
      WITH created_tasks AS (
        SELECT DISTINCT task_id, due_date
        FROM fact_task_events t
        WHERE t.organization_id = $1
          AND t.event_type = 'task.created'
          AND t.task_id IS NOT NULL
          AND t.time >= now() - $2::interval
          ${scopeFilter}
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
        count(*)::int                                                                                        AS total_tasks,
        count(*) FILTER (WHERE COALESCE(ls.to_status, 'TODO') != 'DONE')::int                                 AS not_done_tasks,
        count(*) FILTER (
          WHERE ct.due_date IS NOT NULL AND ct.due_date < now() AND COALESCE(ls.to_status, 'TODO') != 'DONE'
        )::int                                                                                                AS overdue_tasks
      FROM created_tasks ct
      LEFT JOIN latest_status ls ON ls.task_id = ct.task_id
      `,
      params,
    );

    const [topAssigneeRow] = await this.dataSource.query(
      `
      WITH created_tasks AS (
        SELECT DISTINCT task_id
        FROM fact_task_events t
        WHERE t.organization_id = $1
          AND t.event_type = 'task.created'
          AND t.task_id IS NOT NULL
          AND t.time >= now() - $2::interval
          ${scopeFilter}
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
      ),
      latest_assignee AS (
        SELECT DISTINCT ON (task_id) task_id, assignee_id
        FROM fact_task_events
        WHERE organization_id = $1
          AND event_type = 'task.assigned'
          AND task_id IS NOT NULL
        ORDER BY task_id, time DESC
      )
      SELECT la.assignee_id, count(*)::int AS not_done_count
      FROM created_tasks ct
      JOIN latest_assignee la ON la.task_id = ct.task_id
      LEFT JOIN latest_status ls ON ls.task_id = ct.task_id
      WHERE COALESCE(ls.to_status, 'TODO') != 'DONE' AND la.assignee_id IS NOT NULL
      GROUP BY la.assignee_id
      ORDER BY not_done_count DESC
      LIMIT 1
      `,
      params,
    );

    return {
      scope,
      scopeId,
      totalTasks: toNumber(countsRow?.total_tasks),
      notDoneTasks: toNumber(countsRow?.not_done_tasks),
      overdueTasks: toNumber(countsRow?.overdue_tasks),
      topAssignee: topAssigneeRow
        ? { userId: topAssigneeRow.assignee_id as string, notDoneTaskCount: toNumber(topAssigneeRow.not_done_count) }
        : null,
    };
  }
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
