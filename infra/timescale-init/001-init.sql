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
  PRIMARY KEY (time, event_id)
);
SELECT create_hypertable('fact_task_events', by_range('time'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_fact_task_events_org ON fact_task_events (organization_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_fact_task_events_project ON fact_task_events (project_id, time DESC);

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
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_task_summary
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time)                                                                AS bucket,
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
  time_bucket('1 week', time)                                                                AS bucket,
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
  time_bucket('1 day', time)                                                                AS bucket,
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
