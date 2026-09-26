"""24/09/2026: engine/session SQLAlchemy + bootstrap schema idempotent - mirror tinh than
apps/analytics-service/src/database/schema-bootstrap.ts (CREATE TABLE/INDEX IF NOT EXISTS, an
toan goi lai nhieu lan, khong dung migration runner rieng).

Bang o day la ban sao (read-model) rieng cua CHINH ml-service, xay tu Kafka - KHONG bao gio doc
truc tiep Postgres cua service khac (database-per-service, Technical_Spec.md muc 1/5)."""

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import DATABASE_URL

logger = logging.getLogger("ml-service.db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

_SCHEMA_STATEMENTS = [
    # dim_user - ban sao "phong ban HIEN TAI cua tung user" (nguon: iam.events USER_REGISTERED/
    # USER_DEPARTMENT_CHANGED) - mirror dung dim_user cua analytics-service.
    """
    CREATE TABLE IF NOT EXISTS dim_user (
        user_id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        department_id UUID
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_dim_user_org ON dim_user (organization_id)",
    # dim_department_manager - ban sao "nguoi phu trach HIEN TAI cua tung phong ban" (nguon:
    # iam.events DEPARTMENT_MANAGER_CHANGED) - phuc vu pham vi hien thi cho Manager (chi xem
    # duoc phong ban minh phu trach, mirror AnalyticsService.getDrillDown()/getRecentActivity()).
    """
    CREATE TABLE IF NOT EXISTS dim_department_manager (
        department_id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        manager_id UUID
    )
    """,
    # fact_task_events - ban sao tho cac su kien task (nguon: project-task.events) - CHI cac cot
    # can cho tinh feature (completion rate/qua han), khong can day du nhu fact_task_events cua
    # analytics-service (vd khong can from_status).
    """
    CREATE TABLE IF NOT EXISTS fact_task_events (
        event_id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        event_type TEXT NOT NULL,
        time TIMESTAMPTZ NOT NULL,
        task_id UUID,
        project_id UUID,
        assignee_id UUID,
        to_status TEXT,
        due_date TIMESTAMPTZ
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_fact_task_events_org ON fact_task_events (organization_id)",
    "CREATE INDEX IF NOT EXISTS idx_fact_task_events_assignee ON fact_task_events (assignee_id)",
    # fact_attendance - ban sao tho su kien cham cong (nguon: hrm.events ATTENDANCE_CHECKED_IN) -
    # chi can biet "user X co check-in ngay Y" de tinh ty le cham cong xap xi (xem features.py).
    """
    CREATE TABLE IF NOT EXISTS fact_attendance (
        event_id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        time TIMESTAMPTZ NOT NULL,
        user_id UUID,
        work_date DATE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_fact_attendance_org ON fact_attendance (organization_id)",
]


def bootstrap_schema() -> None:
    with engine.begin() as conn:
        for statement in _SCHEMA_STATEMENTS:
            conn.execute(text(statement))
    logger.info("Da kiem tra/tao xong schema ml-service (dim_user, dim_department_manager, fact_task_events, fact_attendance).")
