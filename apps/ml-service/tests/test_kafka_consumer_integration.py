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
        # 26/10/2026: purge_user() ghi them nhat ky PURGE_* - don ca bang nay de khong de rac trong ml_db.
        s.execute(text("DELETE FROM face_enrollment_events WHERE organization_id = :o"), {"o": org_id})
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


# ---------------------------------------------------------------------------------------------
# 26/10/2026: kho anh nhan dien (Technical_Spec.md muc 27.4/27.11) - vo hieu hoa/xoa tai khoan don
# sach ban dang dung + ban cho + dong y + object MinIO (FakeStorage), roles_changed cap nhat role_level.


def _seed_face_data(session, org_id: str, user_id: str, fake_storage) -> None:
    fake_storage.objects[f"{org_id}/{user_id}/active.jpg"] = b"a"
    fake_storage.objects[f"{org_id}/{user_id}/pending.jpg"] = b"p"
    session.execute(
        text(
            "INSERT INTO face_enrollments (user_id, organization_id, embedding, photo_object_key) "
            "VALUES (:u, :o, :emb, :k)"
        ),
        {"u": user_id, "o": org_id, "emb": [0.1] * 512, "k": f"{org_id}/{user_id}/active.jpg"},
    )
    session.execute(
        text(
            "INSERT INTO face_pending_enrollments (user_id, organization_id, embedding, photo_object_key, source, actor_id, expires_at) "
            "VALUES (:u, :o, :emb, :k, 'ADMIN', :u, now() + interval '30 days')"
        ),
        {"u": user_id, "o": org_id, "emb": [0.2] * 512, "k": f"{org_id}/{user_id}/pending.jpg"},
    )
    session.execute(
        text(
            "INSERT INTO face_consents (id, organization_id, user_id, action, source, actor_id) "
            "VALUES (:id, :o, :u, 'WITHDRAW', 'SELF', :u)"
        ),
        {"id": str(uuid.uuid4()), "o": org_id, "u": user_id},
    )
    session.commit()


def _cleanup_face(session, org_id: str) -> None:
    for table in ("face_pending_enrollments", "face_consents", "face_enrollment_events"):
        session.execute(text(f"DELETE FROM {table} WHERE organization_id = :o"), {"o": org_id})
    session.commit()


def test_user_deactivated_xoa_sach_du_lieu_khuon_mat_va_object(session, org_id, fake_storage):
    from app.kafka_consumer import _dispatch

    user_id = str(uuid.uuid4())
    try:
        _seed_face_data(session, org_id, user_id, fake_storage)
        _dispatch(
            {
                "eventId": str(uuid.uuid4()),
                "eventType": "iam.user.deactivated",
                "organizationId": org_id,
                "payload": {"userId": user_id, "actorId": str(uuid.uuid4())},
            }
        )
        for table in ("face_enrollments", "face_pending_enrollments", "face_consents"):
            assert session.execute(text(f"SELECT 1 FROM {table} WHERE user_id = :u"), {"u": user_id}).fetchone() is None
        assert fake_storage.objects == {}
        assert session.execute(
            text("SELECT 1 FROM face_enrollment_events WHERE target_user_id = :u AND action = 'PURGE_DEACTIVATED'"),
            {"u": user_id},
        ).fetchone() is not None
    finally:
        _cleanup_face(session, org_id)


def test_user_deleted_xoa_ca_ban_cho_dong_y_va_object(session, org_id, fake_storage):
    user_id = str(uuid.uuid4())
    try:
        _seed_face_data(session, org_id, user_id, fake_storage)
        keys = _handle_user_deleted(session, org_id, {"userId": user_id})
        session.commit()
        assert sorted(keys) == sorted([f"{org_id}/{user_id}/active.jpg", f"{org_id}/{user_id}/pending.jpg"])
        assert session.execute(text("SELECT 1 FROM face_consents WHERE user_id = :u"), {"u": user_id}).fetchone() is None
    finally:
        _cleanup_face(session, org_id)


def test_roles_changed_va_registered_cap_nhat_role_level_khong_xoa_khi_thieu(session, org_id):
    from app.kafka_consumer import _handle_roles_changed, _handle_user_registered

    user_id = str(uuid.uuid4())
    department_id = str(uuid.uuid4())
    _handle_user_registered(session, org_id, {"userId": user_id, "departmentId": department_id, "roleLevel": "EMPLOYEE"})
    session.commit()
    _handle_roles_changed(session, org_id, {"userId": user_id, "roleLevel": "MANAGER"})
    # department_changed khong mang roleLevel -> giu nguyen MANAGER.
    _handle_user_registered(session, org_id, {"userId": user_id, "departmentId": department_id})
    _handle_roles_changed(session, org_id, {"userId": user_id, "roleLevel": "KHONG_HOP_LE"})
    session.commit()
    row = session.execute(text("SELECT department_id, role_level FROM dim_user WHERE user_id = :u"), {"u": user_id}).fetchone()
    assert str(row[0]) == department_id and row[1] == "MANAGER"


def test_roles_changed_khong_ghi_de_user_cua_to_chuc_khac(session, org_id):
    from app.kafka_consumer import _handle_roles_changed, _handle_user_registered

    user_id = str(uuid.uuid4())
    other_org = str(uuid.uuid4())
    try:
        _handle_user_registered(session, other_org, {"userId": user_id, "departmentId": None, "roleLevel": "EMPLOYEE"})
        session.commit()
        _handle_roles_changed(session, org_id, {"userId": user_id, "roleLevel": "ORG_ADMIN"})
        session.commit()
        row = session.execute(text("SELECT role_level FROM dim_user WHERE user_id = :u"), {"u": user_id}).fetchone()
        assert row[0] == "EMPLOYEE"
    finally:
        session.execute(text("DELETE FROM dim_user WHERE organization_id = :o"), {"o": other_org})
        session.commit()


def test_co_hoat_dong_theo_deactivated_reactivated_va_resync_roles_changed(session, org_id):
    """26/10/2026: dim_user.is_active - deactivated -> false (tao dong neu chua co), reactivated -> true,
    ban resync roles_changed mang isActive cung cap nhat; thieu isActive thi giu nguyen."""
    from app.kafka_consumer import _handle_roles_changed, _handle_user_deactivated, _handle_user_reactivated

    user_id = str(uuid.uuid4())
    active = lambda: session.execute(text("SELECT is_active FROM dim_user WHERE user_id = :u"), {"u": user_id}).scalar()  # noqa: E731
    try:
        _handle_user_deactivated(session, org_id, {"userId": user_id})
        session.commit()
        assert active() is False
        _handle_user_reactivated(session, org_id, {"userId": user_id})
        session.commit()
        assert active() is True
        _handle_roles_changed(session, org_id, {"userId": user_id, "roleLevel": "EMPLOYEE", "isActive": False})
        session.commit()
        assert active() is False
        _handle_roles_changed(session, org_id, {"userId": user_id, "roleLevel": "MANAGER"})
        session.commit()
        assert active() is False
    finally:
        _cleanup_face(session, org_id)
