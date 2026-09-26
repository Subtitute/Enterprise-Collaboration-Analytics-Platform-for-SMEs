"""24/09/2026: tong hop feature theo TUNG NHAN VIEN tu chinh fact table cua ml-service (khong
doc DB service khac) - dau vao cho IsolationForest (app/anomaly.py).

GIOI HAN DA BIET (ghi trong Technical_Spec.md): `attendanceRate` la XAP XI - so ngay CO check-in
(bat ke checkout) chia cho so ngay lich cua khoang `range` (KHONG loai cuoi tuan/ngay le, vi
ml-service khong co du lieu Lich cong ty rieng - se lam gia tri xap xi HOI thap hon thuc te doi
voi nhan vien lam viec deu). `overdueTasks` phan anh dueDate tai thoi diem TAO task (mirror dung
gioi han cua AnalyticsService.getDrillDown() - xem TaskCreatedPayload.dueDate).
"""

from dataclasses import dataclass

from sqlalchemy import text

# range -> (khoang SQL cho "now() - interval", so ngay lich xap xi cho mau so attendanceRate).
_RANGE_CONFIG = {
    "7d": ("7 days", 7),
    "30d": ("30 days", 30),
    "quarter": ("3 months", 90),
}


@dataclass
class EmployeeFeatures:
    user_id: str
    total_tasks: int
    completion_rate: float  # 0-100
    overdue_tasks: int
    attendance_rate: float  # 0-100


def resolve_range(range_key: str) -> tuple[str, int]:
    config = _RANGE_CONFIG.get(range_key)
    if not config:
        raise ValueError(f"Khoang thoi gian khong hop le: '{range_key}' (chi chap nhan 7d, 30d, quarter)")
    return config


def compute_employee_features(
    session,
    organization_id: str,
    range_key: str,
    department_ids: list[str] | None,
) -> list[EmployeeFeatures]:
    since_interval, calendar_days = resolve_range(range_key)

    scope_filter = ""
    params: dict = {"org_id": organization_id, "since_interval": since_interval}
    if department_ids is not None:
        # 24/09/2026: PHAI ep kieu ::uuid[] tuong minh - psycopg2 bind 1 list Python thanh mang
        # Postgres KHONG tu suy ra kieu phan tu la uuid (mac dinh suy ra text/unknown), gay loi
        # THAT SU luc chay "operator does not exist: uuid = text" (phat hien qua
        # tests/test_features_integration.py, khong phai suy doan).
        scope_filter = "AND du.department_id = ANY(CAST(:department_ids AS uuid[]))"
        params["department_ids"] = department_ids

    # 24/09/2026: cohort = nhan vien thuoc pham vi (toan to chuc hoac cac phong ban Manager phu
    # trach) - moi nhan vien 1 dong ke ca khong co task/cham cong nao (COALESCE ve 0) de
    # IsolationForest thay duoc "khong hoat dong gi" cung la 1 tin hieu bat thuong tiem nang.
    employees = session.execute(
        text(
            f"""
            SELECT du.user_id
            FROM dim_user du
            WHERE du.organization_id = :org_id
            {scope_filter}
            """
        ),
        params,
    ).fetchall()

    results: list[EmployeeFeatures] = []
    for (user_id,) in employees:
        task_row = session.execute(
            text(
                """
                WITH assigned_tasks AS (
                    SELECT DISTINCT task_id
                    FROM fact_task_events
                    WHERE organization_id = :org_id
                        AND assignee_id = :user_id
                        AND event_type = 'task.assigned'
                        AND time >= now() - CAST(:since_interval AS interval)
                ),
                due_dates AS (
                    SELECT DISTINCT ON (task_id) task_id, due_date
                    FROM fact_task_events
                    WHERE event_type = 'task.created' AND task_id IS NOT NULL
                    ORDER BY task_id, time DESC
                ),
                latest_status AS (
                    SELECT DISTINCT ON (task_id) task_id, to_status
                    FROM fact_task_events
                    WHERE event_type = 'task.status_changed' AND task_id IS NOT NULL
                    ORDER BY task_id, time DESC
                )
                SELECT
                    count(*)::int AS total_tasks,
                    count(*) FILTER (WHERE COALESCE(ls.to_status, 'TODO') = 'DONE')::int AS completed_tasks,
                    count(*) FILTER (
                        WHERE dd.due_date IS NOT NULL AND dd.due_date < now()
                            AND COALESCE(ls.to_status, 'TODO') != 'DONE'
                    )::int AS overdue_tasks
                FROM assigned_tasks at
                LEFT JOIN due_dates dd ON dd.task_id = at.task_id
                LEFT JOIN latest_status ls ON ls.task_id = at.task_id
                """
            ),
            {"org_id": organization_id, "user_id": user_id, "since_interval": since_interval},
        ).one()

        attendance_row = session.execute(
            text(
                """
                SELECT count(DISTINCT work_date)::int AS days_present
                FROM fact_attendance
                WHERE organization_id = :org_id
                    AND user_id = :user_id
                    AND time >= now() - CAST(:since_interval AS interval)
                """
            ),
            {"org_id": organization_id, "user_id": user_id, "since_interval": since_interval},
        ).one()

        total_tasks = task_row.total_tasks or 0
        completed_tasks = task_row.completed_tasks or 0
        completion_rate = round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0
        days_present = attendance_row.days_present or 0
        attendance_rate = round(min(days_present / calendar_days, 1.0) * 100, 1) if calendar_days > 0 else 0.0

        results.append(
            EmployeeFeatures(
                user_id=str(user_id),
                total_tasks=total_tasks,
                completion_rate=completion_rate,
                overdue_tasks=task_row.overdue_tasks or 0,
                attendance_rate=attendance_rate,
            )
        )
    return results
