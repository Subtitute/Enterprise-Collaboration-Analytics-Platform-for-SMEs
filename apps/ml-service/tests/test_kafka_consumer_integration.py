"""24/10/2026: test TICH HOP cho _handle_user_deleted() (app/kafka_consumer.py) - tach rieng khoi
test_kafka_consumer.py (file do CHI danh cho ham thuan, khong Postgres - xem docstring dau file
do). Mirror tinh than test_features_integration.py: chay DUNG Postgres thuc (postgres-ml, cong
5440), KHONG mock.

DIEU KIEN TIEN QUYET: `docker compose up -d postgres-ml` dang chay (xem test_features_integration.py)."""

import uuid

import pytest
from sqlalchemy import text

from app.db import SessionLocal, bootstrap_schema
from app.kafka_consumer import _handle_user_deleted


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
        s.execute(text("DELETE FROM dim_user WHERE organization_id = :o"), {"o": org_id})
        s.execute(text("DELETE FROM face_enrollments WHERE organization_id = :o"), {"o": org_id})
        s.commit()
        s.close()


def test_user_deleted_xoa_CA_dim_user_LAN_face_enrollments(session, org_id):
    """24/10/2026 (fix lo hong rieng tu THAT phat hien qua QA doc lap): xoa tai khoan vinh vien
    PHAI don sach ca vector dac trung khuon mat da dang ky cua nguoi do - day la du lieu sinh
    trac hoc, cung nhom "lookup danh tinh HIEN TAI" voi dim_user (khong phai lich su su kien can
    giu), khac fact_attendance/fact_task_events (lich su, PHAI giu lai - khong test o day)."""
    user_id = str(uuid.uuid4())
    session.execute(
        text("INSERT INTO dim_user (user_id, organization_id, department_id) VALUES (:u, :o, NULL)"),
        {"u": user_id, "o": org_id},
    )
    session.execute(
        text(
            "INSERT INTO face_enrollments (user_id, organization_id, embedding, enrolled_at) "
            "VALUES (:u, :o, :emb, now())"
        ),
        {"u": user_id, "o": org_id, "emb": [0.1] * 512},
    )
    session.commit()

    _handle_user_deleted(session, org_id, {"userId": user_id})
    session.commit()

    dim_user_row = session.execute(text("SELECT 1 FROM dim_user WHERE user_id = :u"), {"u": user_id}).fetchone()
    face_row = session.execute(text("SELECT 1 FROM face_enrollments WHERE user_id = :u"), {"u": user_id}).fetchone()
    assert dim_user_row is None
    assert face_row is None


def test_user_deleted_khong_xoa_du_lieu_cua_to_chuc_khac(session, org_id):
    other_org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    try:
        session.execute(
            text(
                "INSERT INTO face_enrollments (user_id, organization_id, embedding, enrolled_at) "
                "VALUES (:u, :o, :emb, now())"
            ),
            {"u": user_id, "o": other_org_id, "emb": [0.2] * 512},
        )
        session.commit()

        # Xoa voi org_id KHAC (org_id cua fixture, khong phai other_org_id) - khong anh huong ban
        # ghi cua other_org_id dung user_id.
        _handle_user_deleted(session, org_id, {"userId": user_id})
        session.commit()

        row = session.execute(text("SELECT 1 FROM face_enrollments WHERE user_id = :u"), {"u": user_id}).fetchone()
        assert row is not None
    finally:
        session.execute(text("DELETE FROM face_enrollments WHERE organization_id = :o"), {"o": other_org_id})
        session.commit()
