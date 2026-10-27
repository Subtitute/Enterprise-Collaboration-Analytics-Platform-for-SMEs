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
    # 24/10/2026: face_enrollments - KHAC 4 bang tren (khong phai ban sao/read-model tu Kafka) -
    # day la du lieu THAT su thuoc ve ml-service, khong service nao khac so huu "vector dac trung
    # khuon mat da dang ky cua user nay". 1 ban ghi/user (dang ky lai = ghi de embedding cu, xem
    # app/face.py). `embedding` la mang 512 so thuc (ArcFace) - KHONG dung pgvector o day vi chi
    # so sanh 1-vs-1 (verify), khong can tim kiem gan nhat tren nhieu vector.
    """
    CREATE TABLE IF NOT EXISTS face_enrollments (
        user_id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        embedding DOUBLE PRECISION[] NOT NULL,
        enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_face_enrollments_org ON face_enrollments (organization_id)",
    # 26/10/2026: kho anh nhan dien + dong y (Technical_Spec.md muc 27.4) - them cot vao bang cu
    # (idempotent), ban ghi dang ky truoc ngay nay khong co anh goc (photo_object_key NULL).
    "ALTER TABLE face_enrollments ADD COLUMN IF NOT EXISTS photo_object_key TEXT NULL",
    "ALTER TABLE face_enrollments ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'SELF_CAMERA'",
    "ALTER TABLE face_enrollments ADD COLUMN IF NOT EXISTS enrolled_by UUID NULL",
    "ALTER TABLE face_enrollments ADD COLUMN IF NOT EXISTS model_version TEXT NOT NULL DEFAULT 'yunet-2023mar+arcface-r100'",
    "UPDATE face_enrollments SET enrolled_by = user_id WHERE enrolled_by IS NULL",
    # Ban CHO xac nhan tach bang rieng: verify KHONG BAO GIO doc bang nay.
    """
    CREATE TABLE IF NOT EXISTS face_pending_enrollments (
        user_id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        embedding DOUBLE PRECISION[] NOT NULL,
        photo_object_key TEXT NOT NULL,
        source TEXT NOT NULL,
        actor_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_face_pending_org ON face_pending_enrollments (organization_id)",
    # Dong y: chi ghi them; trang thai hien tai = ban ghi moi nhat cua user.
    """
    CREATE TABLE IF NOT EXISTS face_consents (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        user_id UUID NOT NULL,
        action TEXT NOT NULL,
        consent_text_version TEXT NULL,
        source TEXT NOT NULL,
        actor_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_face_consents_user ON face_consents (organization_id, user_id, created_at DESC)",
    # Nhat ky: KHONG chua embedding/anh; giu 1 nam (xoa trong job hang gio, app/face_store.py).
    """
    CREATE TABLE IF NOT EXISTS face_enrollment_events (
        id UUID PRIMARY KEY,
        organization_id UUID NOT NULL,
        actor_id UUID NOT NULL,
        target_user_id UUID NOT NULL,
        action TEXT NOT NULL,
        source TEXT NULL,
        correlation_id TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_face_events_org ON face_enrollment_events (organization_id, created_at)",
    # NULL = chua biet muc vai tro -> moi kiem tra pham vi Manager tu choi (fail-closed).
    "ALTER TABLE dim_user ADD COLUMN IF NOT EXISTS role_level TEXT NULL",
    # 26/10/2026: tai khoan dang bi vo hieu hoa (iam.user.deactivated/reactivated + resync luc iam khoi
    # dong) - chan tai anh ho cho tai khoan da vo hieu hoa (Technical_Spec.md muc 27.8).
    "ALTER TABLE dim_user ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
]


def bootstrap_schema() -> None:
    with engine.begin() as conn:
        for statement in _SCHEMA_STATEMENTS:
            conn.execute(text(statement))
    logger.info(
        "Da kiem tra/tao xong schema ml-service (dim_user, dim_department_manager, "
        "fact_task_events, fact_attendance, face_enrollments, face_pending_enrollments, face_consents, "
        "face_enrollment_events)."
    )
