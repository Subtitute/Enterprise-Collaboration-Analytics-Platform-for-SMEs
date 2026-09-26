-- 2026-07-18: Khoi tao schema TimescaleDB cho Analytics Service.
-- Theo Technical_Spec.md muc 3.6 va muc 5 (fact tables + continuous aggregates).
-- Script nay duoc TimescaleDB image tu dong chay 1 lan khi container khoi tao lan dau
-- (co che docker-entrypoint-initdb.d, ke thua tu image postgres).

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- Fact table: su kien Task/Project (nguon: project-task.events)
-- ============================================================
CREATE TABLE IF NOT EXISTS fact_task_events (
  time             TIMESTAMPTZ      NOT NULL,
  event_id         UUID             NOT NULL,
  organization_id  UUID             NOT NULL,
  event_type       TEXT             NOT NULL,
  project_id       UUID,
  task_id          UUID,
  from_status      TEXT,
  to_status        TEXT,
  actor_id         UUID,
  -- 28/07/2026: nguoi duoc GAN (assignee) cho task - chi co gia tri o event `task.assigned`
  -- (TaskAssignedPayload.assigneeId), NULL o cac event khac (vd task.created/task.status_changed
  -- khong co truong nay). KHAC voi actor_id (nguoi THUC HIEN hanh dong). Phuc vu KPI theo phong
  -- ban: JOIN voi dim_user ben duoi de biet 1 task duoc gan cho user thuoc phong ban nao.
  assignee_id      UUID,
  -- 24/09/2026: han hoan thanh (Task.dueDate) TAI THOI DIEM TAO task - chi co gia tri o event
  -- `task.created` (TaskCreatedPayload.dueDate), NULL o cac event khac. Phuc vu drill-down "task
  -- qua han" (AnalyticsService.getDrillDown()). GIOI HAN DA BIET: khong cap nhat neu doi han sau
  -- qua PATCH /tasks/:id (PATCH khong phat event rieng cho thay doi field thuong).
  due_date         TIMESTAMPTZ,
  PRIMARY KEY (time, event_id)
);
SELECT create_hypertable('fact_task_events', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_fact_task_events_org ON fact_task_events (organization_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_fact_task_events_project ON fact_task_events (project_id, time DESC);

-- ============================================================
-- 28/07/2026: Bang lookup: phong ban HIEN TAI cua tung user (nguon: iam.events, event
-- USER_REGISTERED/USER_DEPARTMENT_CHANGED - xem packages/common-dto/src/events/event-types.ts).
-- KHONG phai hypertable (khong co chieu thoi gian, khong goi create_hypertable) - day la bang
-- "dimension" thuan, chi giu TRANG THAI HIEN TAI (khong phai lich su) nen 1 dong/user, cap nhat
-- bang UPSERT (xem FactWriterService.upsertUserDepartment()). Phuc vu KPI theo phong ban:
-- AnalyticsService.computeSummary()/getTaskStatusBreakdown()/getProjectProgress() JOIN
-- fact_task_events.assignee_id -> dim_user.user_id -> dim_user.department_id.
--
-- QUAN TRONG: script nay CHI chay 1 lan luc container TimescaleDB khoi tao TREN VOLUME MOI (xem
-- ghi chu dau file) nen KHONG tu ap dung cho database dev/staging DANG CHAY san co du lieu.
-- apps/analytics-service/src/database/schema-bootstrap.ts chay LAI dung DDL nay (CREATE TABLE/
-- INDEX IF NOT EXISTS, an toan idempotent) ngay luc ung dung khoi dong de tu "cham" schema nay
-- vao database dang chay ma khong can 1 buoc migration thu cong - giu 2 noi nay LUON dong bo khi
-- sua doi.
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_user (
  user_id          UUID             PRIMARY KEY,
  organization_id  UUID             NOT NULL,
  department_id    UUID,
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dim_user_org ON dim_user (organization_id);

-- ============================================================
-- 23/09/2026: Bang lookup: nguoi phu trach HIEN TAI cua tung phong ban (nguon: iam.events, event
-- DEPARTMENT_MANAGER_CHANGED - xem packages/common-dto/src/events/event-types.ts). Phuc vu scoping
-- "Manager chi thay Hoat dong gan day cua phong ban minh phu trach" (AnalyticsService.getRecentActivity()).
-- Giu dong bo voi apps/analytics-service/src/database/schema-bootstrap.ts (xem ghi chu dau file).
-- ============================================================
CREATE TABLE IF NOT EXISTS dim_department_manager (
  department_id    UUID             PRIMARY KEY,
  organization_id  UUID             NOT NULL,
  manager_id       UUID,
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
  last_event_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_dim_department_manager_org_manager ON dim_department_manager (organization_id, manager_id);

-- ============================================================
-- Fact table: su kien Document (nguon: document.events)
-- ============================================================
CREATE TABLE IF NOT EXISTS fact_document_events (
  time             TIMESTAMPTZ      NOT NULL,
  event_id         UUID             NOT NULL,
  organization_id  UUID             NOT NULL,
  event_type       TEXT             NOT NULL,
  file_id          UUID,
  folder_id        UUID,
  actor_id         UUID,
  PRIMARY KEY (time, event_id)
);
SELECT create_hypertable('fact_document_events', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_fact_document_events_org ON fact_document_events (organization_id, time DESC);

-- ============================================================
-- Fact table: hoat dong nguoi dung tong quat (moi event tu ca 3 topic)
-- Phuc vu "Hoat dong gan day (real-time)" tren Dashboard (Wireframe.md muc 3)
-- ============================================================
CREATE TABLE IF NOT EXISTS fact_user_activity (
  time             TIMESTAMPTZ      NOT NULL,
  event_id         UUID             NOT NULL,
  organization_id  UUID             NOT NULL,
  event_type       TEXT             NOT NULL,
  producer         TEXT             NOT NULL,
  actor_id         UUID,
  payload          JSONB,
  PRIMARY KEY (time, event_id)
);
SELECT create_hypertable('fact_user_activity', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_fact_user_activity_org ON fact_user_activity (organization_id, time DESC);

-- ============================================================
-- Continuous aggregate: tong hop task theo ngay (daily_task_summary)
-- Theo Technical_Spec.md muc 3.6 va muc 4.4
--
-- 25/08/2026: fix code review Major (phat hien qua dot ra soat toan du an lan 3) - `time_bucket()`
-- KHONG truyen tham so timezone se gop nhom theo NGAY UTC, mau thuan quy uoc GMT+7 xuyen suot du
-- an (vd apps/hrm-service/src/attendance/attendance-date.util.ts, apps/web/src/lib/utils.ts).
-- Hoat dong xay ra 00:00-06:59 gio VN (17:00-23:59 UTC hom truoc) bi gan NHAM sang ngay hom truoc
-- tren bieu do xu huong Dashboard. Tham so timezone thu 3 (ho tro on dinh tu TimescaleDB 2.9+,
-- image dung o day la latest-pg16) buoc bucket gop theo ngay/tuan GMT+7 truoc khi quy doi lai UTC
-- de luu tru. CHI ap dung cho ban cai dat MOI (xem ghi chu dau file - script nay khong tu chay lai
-- tren volume da co du lieu); moi truong dev/staging dang chay san can DROP + tao lai 3
-- materialized view nay thu cong (khong co migration runner - xem schema-bootstrap.ts).
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_task_summary
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time, 'Asia/Ho_Chi_Minh')                                             AS bucket,
  organization_id,
  project_id,
  count(*) FILTER (WHERE event_type = 'task.created')                                        AS tasks_created,
  count(*) FILTER (WHERE event_type = 'task.status_changed' AND to_status = 'DONE')           AS tasks_completed,
  count(*) FILTER (WHERE event_type = 'task.assigned')                                        AS tasks_assigned
FROM fact_task_events
GROUP BY bucket, organization_id, project_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('daily_task_summary',
  start_offset => INTERVAL '3 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- ============================================================
-- Continuous aggregate: tien do du an theo tuan (weekly_project_progress)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS weekly_project_progress
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 week', time, 'Asia/Ho_Chi_Minh')                                            AS bucket,
  organization_id,
  project_id,
  count(*) FILTER (WHERE event_type = 'task.created')                                        AS tasks_created,
  count(*) FILTER (WHERE event_type = 'task.status_changed' AND to_status = 'DONE')           AS tasks_completed
FROM fact_task_events
GROUP BY bucket, organization_id, project_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('weekly_project_progress',
  start_offset => INTERVAL '3 weeks',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- ============================================================
-- Continuous aggregate: hoat dong tai lieu theo ngay (daily_document_activity)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_document_activity
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time, 'Asia/Ho_Chi_Minh')                                             AS bucket,
  organization_id,
  count(*) FILTER (WHERE event_type = 'document.uploaded')                                   AS files_uploaded,
  count(*) FILTER (WHERE event_type = 'document.shared')                                      AS files_shared
FROM fact_document_events
GROUP BY bucket, organization_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('daily_document_activity',
  start_offset => INTERVAL '3 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
