"""24/09/2026: test TICH HOP cho compute_employee_features() (app/features.py) - phan lon logic
cua ham nay la SQL thuan (CTE), gia tri kiem thu that su nam o chay DUNG Postgres, khong phai
mock chuoi SQL (chi xac nhan "go dung chu", khong xac nhan "SQL chay dung"). Mirror tinh than
e2e/ (kiem tra tren stack that dang chay) ap dung cho tang service nay.

DIEU KIEN TIEN QUYET: `docker compose up -d postgres-ml` (hoac ca stack) dang chay va expose cong
5440 ra host (xem infra/docker-compose.yml) - test nay KHONG tu dong khoi dong Postgres. Dung 1
organization_id ngau nhien (uuid4) rieng cho MOI lan chay va don sach chinh no o teardown, khong
dung chung/anh huong du lieu demo that."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text

from app.db import SessionLocal, bootstrap_schema
from app.features import compute_employee_features


@pytest.fixture(scope="module", autouse=True)
def _ensure_schema():
    bootstrap_schema()


@pytest.fixture
def org_id():
    return str(uuid.uuid4())


@pytest.fixture
def session(org_id):
    s = SessionLocal()
    try:
        yield s
    finally:
        # Don sach TOAN BO du lieu cua rieng organization_id nay - khong dung TRUNCATE (se xoa
        # ca du lieu demo that dang chay chung 1 database).
        s.execute(text("DELETE FROM fact_attendance WHERE organization_id = :o"), {"o": org_id})
        s.execute(text("DELETE FROM fact_task_events WHERE organization_id = :o"), {"o": org_id})
        s.execute(text("DELETE FROM dim_user WHERE organization_id = :o"), {"o": org_id})
        s.commit()
        s.close()


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def test_tinh_dung_completion_rate_qua_han_va_cham_cong(session, org_id):
    now = datetime.now(timezone.utc)
    user_id = str(uuid.uuid4())
    task_done_id = str(uuid.uuid4())
    task_overdue_id = str(uuid.uuid4())

    session.execute(
        text("INSERT INTO dim_user (user_id, organization_id, department_id) VALUES (:u, :o, NULL)"),
        {"u": user_id, "o": org_id},
    )

    # Task 1: co han trong QUA KHU (qua han), CHUA xong - dong gop vao overdue_tasks.
    session.execute(
        text(
            "INSERT INTO fact_task_events (event_id, organization_id, event_type, time, task_id, due_date) "
            "VALUES (:eid, :o, 'task.created', :t, :task, :due)"
        ),
        {"eid": str(uuid.uuid4()), "o": org_id, "t": _iso(now), "task": task_overdue_id, "due": _iso(now - timedelta(days=1))},
    )
    session.execute(
        text(
            "INSERT INTO fact_task_events (event_id, organization_id, event_type, time, task_id, assignee_id) "
            "VALUES (:eid, :o, 'task.assigned', :t, :task, :u)"
        ),
        {"eid": str(uuid.uuid4()), "o": org_id, "t": _iso(now), "task": task_overdue_id, "u": user_id},
    )
    session.execute(
        text(
            "INSERT INTO fact_task_events (event_id, organization_id, event_type, time, task_id, to_status) "
            "VALUES (:eid, :o, 'task.status_changed', :t, :task, 'DOING')"
        ),
        {"eid": str(uuid.uuid4()), "o": org_id, "t": _iso(now), "task": task_overdue_id},
    )

    # Task 2: han trong TUONG LAI, DA xong - dong gop vao completed.
    session.execute(
        text(
            "INSERT INTO fact_task_events (event_id, organization_id, event_type, time, task_id, due_date) "
            "VALUES (:eid, :o, 'task.created', :t, :task, :due)"
        ),
        {"eid": str(uuid.uuid4()), "o": org_id, "t": _iso(now), "task": task_done_id, "due": _iso(now + timedelta(days=10))},
    )
    session.execute(
        text(
            "INSERT INTO fact_task_events (event_id, organization_id, event_type, time, task_id, assignee_id) "
            "VALUES (:eid, :o, 'task.assigned', :t, :task, :u)"
        ),
        {"eid": str(uuid.uuid4()), "o": org_id, "t": _iso(now), "task": task_done_id, "u": user_id},
    )
    session.execute(
        text(
            "INSERT INTO fact_task_events (event_id, organization_id, event_type, time, task_id, to_status) "
            "VALUES (:eid, :o, 'task.status_changed', :t, :task, 'DONE')"
        ),
        {"eid": str(uuid.uuid4()), "o": org_id, "t": _iso(now), "task": task_done_id},
    )

    # Cham cong: 3 ngay khac nhau trong 7 ngay qua.
    for i in range(3):
        session.execute(
            text(
                "INSERT INTO fact_attendance (event_id, organization_id, time, user_id, work_date) "
                "VALUES (:eid, :o, :t, :u, :d)"
            ),
            {
                "eid": str(uuid.uuid4()),
                "o": org_id,
                "t": _iso(now - timedelta(days=i)),
                "u": user_id,
                "d": (now - timedelta(days=i)).date().isoformat(),
            },
        )
    session.commit()

    results = compute_employee_features(session, org_id, "7d", None)

    assert len(results) == 1
    employee = results[0]
    assert employee.user_id == user_id
    assert employee.total_tasks == 2
    assert employee.completion_rate == 50.0
    assert employee.overdue_tasks == 1
    assert employee.attendance_rate == round(3 / 7 * 100, 1)


def test_nhan_vien_khong_co_task_hay_cham_cong_van_xuat_hien_voi_gia_tri_0(session, org_id):
    user_id = str(uuid.uuid4())
    session.execute(
        text("INSERT INTO dim_user (user_id, organization_id, department_id) VALUES (:u, :o, NULL)"),
        {"u": user_id, "o": org_id},
    )
    session.commit()

    results = compute_employee_features(session, org_id, "30d", None)

    assert len(results) == 1
    employee = results[0]
    assert employee.total_tasks == 0
    assert employee.completion_rate == 0.0
    assert employee.overdue_tasks == 0
    assert employee.attendance_rate == 0.0


def test_loc_theo_department_ids_chi_lay_dung_pham_vi(session, org_id):
    dept_a = str(uuid.uuid4())
    dept_b = str(uuid.uuid4())
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())

    session.execute(
        text("INSERT INTO dim_user (user_id, organization_id, department_id) VALUES (:u, :o, :d)"),
        {"u": user_a, "o": org_id, "d": dept_a},
    )
    session.execute(
        text("INSERT INTO dim_user (user_id, organization_id, department_id) VALUES (:u, :o, :d)"),
        {"u": user_b, "o": org_id, "d": dept_b},
    )
    session.commit()

    results = compute_employee_features(session, org_id, "30d", [dept_a])

    assert len(results) == 1
    assert results[0].user_id == user_a
