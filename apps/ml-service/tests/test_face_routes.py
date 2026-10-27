"""24/10/2026: test TICH HOP cho cac route /api/v1/ml/face/* - mirror tinh than
test_features_integration.py: chay DUNG Postgres thuc (postgres-ml, cong 5440), khong mock DB.

26/10/2026: viet lai cho kho anh nhan dien + dong y (Technical_Spec.md muc 27.13): ma tran RBAC
(chinh chu / Manager -> Employee phong minh / phong khac / Manager khac / Org Admin / khong co phong
ban / Super Admin / role_level NULL), trang thai dong y (ban cho khong duoc verify, xac nhan/tu
choi/rut lai -> 409), trung 1:N, strict, proxy anh (no-store + VIEW_REF), xuyen to chuc. MinIO thay
bang FakeStorage (tests/conftest.py); anh test sinh bang code (tests/face_fixtures.py).

DIEU KIEN TIEN QUYET: `docker compose up -d postgres-ml` dang chay + model ONNX cuc bo."""

import uuid

import pytest
import sqlalchemy
from fastapi.testclient import TestClient

from app.config import INTERNAL_SHARED_SECRET
from app.db import SessionLocal, bootstrap_schema
from app.main import app, expire_pending_once
from tests import face_fixtures as ff

pytestmark = pytest.mark.skipif(
    not ff.FIXTURES_AVAILABLE,
    reason="Thieu model/anh mau ONNX cuc bo (apps/ml-service/models/) - xem Dockerfile/test_face.py.",
)

CONSENT = "face-consent-v1"
_FACE_TABLES = ("face_enrollments", "face_pending_enrollments", "face_consents", "face_enrollment_events", "dim_user")


@pytest.fixture(scope="module")
def client():
    bootstrap_schema()
    with TestClient(app) as c:
        yield c


class Org:
    """1 to chuc test: Org Admin, 2 Manager + 2 Employee cung phong D1, 1 Employee phong D2."""

    def __init__(self) -> None:
        self.id = str(uuid.uuid4())
        self.d1, self.d2 = str(uuid.uuid4()), str(uuid.uuid4())
        self.admin, self.manager, self.manager2 = (str(uuid.uuid4()) for _ in range(3))
        self.emp, self.emp2, self.emp_d2 = (str(uuid.uuid4()) for _ in range(3))

    def seed(self, session) -> None:
        rows = [
            (self.admin, self.d1, "ORG_ADMIN"),
            (self.manager, self.d1, "MANAGER"),
            (self.manager2, self.d1, "MANAGER"),
            (self.emp, self.d1, "EMPLOYEE"),
            (self.emp2, self.d1, "EMPLOYEE"),
            (self.emp_d2, self.d2, "EMPLOYEE"),
        ]
        for user_id, dept, level in rows:
            session.execute(
                sqlalchemy.text("INSERT INTO dim_user (user_id, organization_id, department_id, role_level) VALUES (:u, :o, :d, :l)"),
                {"u": user_id, "o": self.id, "d": dept, "l": level},
            )


@pytest.fixture
def org():
    o = Org()
    session = SessionLocal()
    try:
        o.seed(session)
        session.commit()
        yield o
    finally:
        for table in _FACE_TABLES:
            session.execute(sqlalchemy.text(f"DELETE FROM {table} WHERE organization_id = :o"), {"o": o.id})
        session.commit()
        session.close()


def _headers(user_id: str, org_id: str, level: str, department_id: str | None = None, super_admin: bool = False) -> dict:
    permissions = {
        "ORG_ADMIN": "user:manage,user:invite,attendance:checkin",
        "MANAGER": "user:invite,attendance:checkin",
        "EMPLOYEE": "attendance:checkin",
        "NONE": "",
    }[level]
    headers = {
        "x-internal-secret": INTERNAL_SHARED_SECRET,
        "x-user-id": user_id,
        "x-org-id": org_id,
        "x-permissions": permissions,
        "x-roles": {"ORG_ADMIN": "Org Admin", "MANAGER": "Manager", "EMPLOYEE": "Employee", "NONE": ""}[level],
        "x-is-super-admin": "true" if super_admin else "false",
    }
    if department_id:
        headers["x-department-id"] = department_id
    return headers


def _admin(o: Org) -> dict:
    return _headers(o.admin, o.id, "ORG_ADMIN", o.d1)


def _manager(o: Org) -> dict:
    return _headers(o.manager, o.id, "MANAGER", o.d1)


def _emp(o: Org, user_id: str | None = None) -> dict:
    return _headers(user_id or o.emp, o.id, "EMPLOYEE", o.d1)


def _photo(data: bytes) -> dict:
    return {"photo": ("photo.jpg", data, "image/jpeg")}


def _self_enroll(client, headers: dict, data: bytes):
    return client.post("/api/v1/ml/face/enroll", headers=headers, files=_photo(data), data={"consentTextVersion": CONSENT})


def _count(table: str, where: str, params: dict) -> int:
    session = SessionLocal()
    try:
        return session.execute(sqlalchemy.text(f"SELECT count(*) FROM {table} WHERE {where}"), params).scalar()
    finally:
        session.close()


# ------------------------------------------------------------------ chinh chu + dong y -----------


def test_thieu_quyen_attendance_checkin_tra_ve_403(client, org):
    resp = client.get("/api/v1/ml/face/enrollment", headers=_headers(org.emp, org.id, "NONE"))
    assert resp.status_code == 403
    assert resp.json()["errorCode"] == "FACE_FORBIDDEN"


def test_chua_dang_ky_tra_ve_status_NONE(client, org):
    body = client.get("/api/v1/ml/face/enrollment", headers=_emp(org)).json()
    assert body["status"] == "NONE"
    assert body["enrolled"] is False and body["pending"] is None


def test_dang_ky_thieu_dong_y_bi_tu_choi(client, org):
    resp = client.post("/api/v1/ml/face/enroll", headers=_emp(org), files=_photo(ff.person_a()))
    assert resp.status_code == 400
    assert resp.json()["errorCode"] == "FACE_CONSENT_REQUIRED"


def test_tu_dang_ky_ghi_dong_y_luu_anh_khong_EXIF_va_verify_khop(client, org, fake_storage):
    resp = _self_enroll(client, _emp(org), ff.with_exif(ff.person_a()))
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "ACTIVE" and resp.json()["source"] == "SELF_CAMERA"
    assert _count("face_consents", "user_id = :u AND action = 'CONSENT'", {"u": org.emp}) == 1
    stored = list(fake_storage.objects.values())
    assert len(stored) == 1 and stored[0][:2] == b"\xff\xd8" and b"Exif" not in stored[0]

    verify = client.post("/api/v1/ml/face/verify", headers=_emp(org), files=_photo(ff.person_a_variant())).json()
    assert verify["enrolled"] is True and verify["matched"] is True


def test_dang_ky_lai_ghi_de_va_xoa_anh_cu(client, org, fake_storage):
    _self_enroll(client, _emp(org), ff.person_a())
    _self_enroll(client, _emp(org), ff.person_a_variant())
    assert _count("face_enrollments", "user_id = :u", {"u": org.emp}) == 1
    assert len(fake_storage.objects) == 1
    assert _count("face_enrollment_events", "target_user_id = :u AND action = 'RE_ENROLL'", {"u": org.emp}) == 1


def test_anh_khong_hop_le_bi_chan_strict(client, org):
    cases = {
        "FACE_MULTIPLE": ff.two_faces(),
        "FACE_NONE": ff.no_face(),
        "FACE_TOO_SMALL": ff.small_face(),
        "FACE_INVALID_IMAGE": ff.png_bytes(),
    }
    for code, data in cases.items():
        resp = _self_enroll(client, _emp(org), data)
        assert resp.status_code == 400, code
        assert resp.json()["errorCode"] == code
    trailing = _self_enroll(client, _emp(org), ff.with_trailing_data(ff.person_a()))
    assert trailing.json()["errorCode"] == "FACE_INVALID_IMAGE"


def test_ban_cho_khong_duoc_verify_cho_toi_khi_xac_nhan(client, org):
    put = client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a()))
    assert put.status_code == 200, put.text
    assert put.json()["status"] == "PENDING_CONSENT" and put.json()["pending"]["source"] == "ADMIN"

    verify = client.post("/api/v1/ml/face/verify", headers=_emp(org), files=_photo(ff.person_a())).json()
    assert verify == {"enrolled": False, "score": None, "matched": None}

    pending_photo = client.get("/api/v1/ml/face/enrollment/pending/photo", headers=_emp(org))
    assert pending_photo.status_code == 200 and pending_photo.headers["cache-control"] == "no-store"

    confirm = client.post("/api/v1/ml/face/enrollment/confirm", headers=_emp(org), json={"consentTextVersion": CONSENT})
    assert confirm.status_code == 200 and confirm.json()["status"] == "ACTIVE"
    assert confirm.json()["source"] == "ADMIN" and confirm.json()["enrolledBy"] == org.admin
    verify = client.post("/api/v1/ml/face/verify", headers=_emp(org), files=_photo(ff.person_a())).json()
    assert verify["matched"] is True


def test_ban_dang_dung_van_verify_khi_co_ban_cho_moi(client, org):
    _self_enroll(client, _emp(org), ff.person_a())
    client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_manager(org), files=_photo(ff.person_a_variant()))
    status = client.get("/api/v1/ml/face/enrollment", headers=_emp(org)).json()
    assert status["status"] == "ACTIVE" and status["pending"]["source"] == "MANAGER"
    assert client.post("/api/v1/ml/face/verify", headers=_emp(org), files=_photo(ff.person_a())).json()["matched"] is True


def test_tu_choi_roi_tai_ho_bi_409_cho_toi_khi_tu_dang_ky_lai(client, org):
    client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a()))
    reject = client.post("/api/v1/ml/face/enrollment/reject", headers=_emp(org))
    assert reject.json()["status"] == "WITHDRAWN"

    blocked = client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a()))
    assert blocked.status_code == 409 and blocked.json()["errorCode"] == "FACE_CONSENT_WITHDRAWN"

    assert _self_enroll(client, _emp(org), ff.person_a()).status_code == 200
    again = client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a_variant()))
    assert again.status_code == 200


def test_rut_dong_y_xoa_het_va_chan_tai_ho(client, org, fake_storage):
    _self_enroll(client, _emp(org), ff.person_a())
    assert client.delete("/api/v1/ml/face/enrollment", headers=_emp(org)).status_code == 204
    assert client.get("/api/v1/ml/face/enrollment", headers=_emp(org)).json()["status"] == "WITHDRAWN"
    assert fake_storage.objects == {}
    blocked = client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a()))
    assert blocked.status_code == 409


def test_admin_huy_rieng_ban_cho_giu_ban_dang_dung(client, org):
    _self_enroll(client, _emp(org), ff.person_a())
    client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a_variant()))
    assert client.delete(f"/api/v1/ml/face/enrollments/{org.emp}?pending=true", headers=_admin(org)).status_code == 204
    status = client.get(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org)).json()
    assert status["status"] == "ACTIVE" and status["pending"] is None


def test_admin_xoa_anh_khong_tinh_la_rut_dong_y(client, org):
    _self_enroll(client, _emp(org), ff.person_a())
    assert client.delete(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org)).status_code == 204
    assert client.get(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org)).json()["status"] == "NONE"
    assert client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a())).status_code == 200


# ------------------------------------------------------------------ trung 1:N + inspect ----------


def test_trung_1N_voi_nguoi_khac_bi_chan_va_inspect_bao_trung(client, org):
    _self_enroll(client, _emp(org), ff.person_a())
    dup = client.put(f"/api/v1/ml/face/enrollments/{org.emp2}", headers=_admin(org), files=_photo(ff.person_a_variant()))
    assert dup.status_code == 409 and dup.json()["errorCode"] == "FACE_DUPLICATE"
    assert _self_enroll(client, _emp(org, org.emp2), ff.person_a_variant()).status_code == 409

    inspect = client.post(
        f"/api/v1/ml/face/inspect?userId={org.emp2}", headers=_manager(org), files=_photo(ff.person_a_variant())
    ).json()
    assert inspect["ok"] is False and inspect["errorCode"] == "FACE_DUPLICATE"
    assert inspect["duplicateUserId"] == org.emp  # emp cung phong D1 -> trong pham vi Manager

    ok = client.post(f"/api/v1/ml/face/inspect?userId={org.emp2}", headers=_admin(org), files=_photo(ff.person_b())).json()
    assert ok["ok"] is True and ok["faceCount"] == 1 and ok["duplicateUserId"] is None
    # Chinh nguoi do dang ky lai bang anh cua minh -> khong tinh la trung.
    assert _self_enroll(client, _emp(org), ff.person_a_variant()).status_code == 200


def test_inspect_khong_neu_userId_trung_ngoai_pham_vi_manager(client, org):
    _self_enroll(client, _emp(org, org.emp_d2), ff.person_a())
    inspect = client.post("/api/v1/ml/face/inspect", headers=_manager(org), files=_photo(ff.person_a_variant())).json()
    assert inspect["errorCode"] == "FACE_DUPLICATE" and inspect["duplicateUserId"] is None


def test_inspect_khong_luu_gi(client, org, fake_storage):
    client.post("/api/v1/ml/face/inspect", headers=_admin(org), files=_photo(ff.person_a()))
    assert fake_storage.objects == {}
    assert _count("face_pending_enrollments", "organization_id = :o", {"o": org.id}) == 0


def test_canh_bao_anh_mo(client, org):
    resp = client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.blurred_face()))
    assert resp.status_code == 200 and "FACE_LOW_QUALITY" in resp.json()["warnings"]


# ------------------------------------------------------------------ ma tran RBAC -----------------


def test_ma_tran_RBAC_doc_trang_thai(client, org):
    def get(headers, target):
        return client.get(f"/api/v1/ml/face/enrollments/{target}", headers=headers).status_code

    assert get(_admin(org), org.emp) == 200
    assert get(_admin(org), org.manager) == 200
    assert get(_manager(org), org.emp) == 200
    assert get(_manager(org), org.emp_d2) == 403  # Employee phong khac
    assert get(_manager(org), org.manager2) == 403  # Manager khac cung phong
    assert get(_manager(org), org.admin) == 403  # Org Admin
    assert get(_manager(org), org.manager) == 403  # chinh minh -> dung Ho so ca nhan
    assert get(_headers(org.manager, org.id, "MANAGER"), org.emp) == 403  # Manager khong co phong ban
    assert get(_emp(org), org.emp2) == 403  # Employee -> nguoi khac
    assert get(_headers(org.admin, org.id, "ORG_ADMIN", org.d1, super_admin=True), org.emp) == 403  # Super Admin


def test_super_admin_bi_chan_o_moi_route_moi(client, org):
    sa = _headers(org.admin, org.id, "ORG_ADMIN", org.d1, super_admin=True)
    assert client.get("/api/v1/ml/face/enrollment", headers=sa).status_code == 403
    assert client.get(f"/api/v1/ml/face/enrollments?userIds={org.emp}", headers=sa).status_code == 403
    assert client.post("/api/v1/ml/face/inspect", headers=sa, files=_photo(ff.person_a())).status_code == 403
    assert client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=sa, files=_photo(ff.person_a())).status_code == 403


def test_role_level_null_bi_tu_choi_fail_closed(client, org):
    session = SessionLocal()
    try:
        session.execute(sqlalchemy.text("UPDATE dim_user SET role_level = NULL WHERE user_id = :u"), {"u": org.emp})
        session.commit()
    finally:
        session.close()
    assert client.get(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_manager(org)).status_code == 403
    put = client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_manager(org), files=_photo(ff.person_a()))
    assert put.status_code == 409 and put.json()["errorCode"] == "USER_NOT_SYNCED"


def test_user_chua_dong_bo_tra_409_USER_NOT_SYNCED(client, org):
    unknown = str(uuid.uuid4())
    put = client.put(f"/api/v1/ml/face/enrollments/{unknown}", headers=_admin(org), files=_photo(ff.person_a()))
    assert put.status_code == 409 and put.json()["errorCode"] == "USER_NOT_SYNCED"


def test_danh_sach_trang_thai_loc_theo_pham_vi_manager(client, org):
    ids = ",".join([org.emp, org.emp2, org.emp_d2, org.manager2, org.admin])
    data = client.get(f"/api/v1/ml/face/enrollments?userIds={ids}", headers=_manager(org)).json()["data"]
    assert sorted(d["userId"] for d in data) == sorted([org.emp, org.emp2])
    data = client.get(f"/api/v1/ml/face/enrollments?userIds={ids}", headers=_admin(org)).json()["data"]
    assert len(data) == 5 and all("embedding" not in d for d in data)


def test_proxy_anh_no_store_va_ghi_VIEW_REF(client, org):
    _self_enroll(client, _emp(org), ff.person_a())
    resp = client.get(f"/api/v1/ml/face/enrollments/{org.emp}/photo", headers=_manager(org))
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-store" and resp.headers["content-type"] == "image/jpeg"
    assert _count("face_enrollment_events", "target_user_id = :u AND action = 'VIEW_REF' AND actor_id = :a", {"u": org.emp, "a": org.manager}) == 1
    assert client.get(f"/api/v1/ml/face/enrollments/{org.emp_d2}/photo", headers=_manager(org)).status_code == 403


# ------------------------------------------------------------------ xuyen to chuc ----------------


def test_xuyen_to_chuc_khong_doc_ghi_xoa_duoc(client, org):
    other = Org()
    session = SessionLocal()
    try:
        other.seed(session)
        session.commit()
        assert _self_enroll(client, _emp(other), ff.person_b()).status_code == 200

        # Org Admin to chuc A nham vao user cua to chuc B: khong thay gi, khong sua/xoa duoc.
        assert client.get(f"/api/v1/ml/face/enrollments/{other.emp}", headers=_admin(org)).json()["status"] == "NONE"
        assert client.get(f"/api/v1/ml/face/enrollments/{other.emp}/photo", headers=_admin(org)).status_code == 404
        client.delete(f"/api/v1/ml/face/enrollments/{other.emp}", headers=_admin(org))
        put = client.put(f"/api/v1/ml/face/enrollments/{other.emp}", headers=_admin(org), files=_photo(ff.person_b()))
        assert put.status_code == 409  # khong co trong dim_user cua to chuc A
        # Self-enroll gia mao org A cho user cua org B -> upsert bi chan (FACE_ORG_MISMATCH).
        forged = _self_enroll(client, _headers(other.emp, org.id, "EMPLOYEE", org.d1), ff.person_b())
        assert forged.status_code == 409 and forged.json()["errorCode"] == "FACE_ORG_MISMATCH"
        # Trung 1:N chi so trong cung to chuc: anh B dang ky o to chuc A khong bi bao trung.
        assert _self_enroll(client, _emp(org), ff.person_b()).status_code == 200

        assert client.get("/api/v1/ml/face/enrollment", headers=_emp(other)).json()["status"] == "ACTIVE"
    finally:
        for table in _FACE_TABLES:
            session.execute(sqlalchemy.text(f"DELETE FROM {table} WHERE organization_id = :o"), {"o": other.id})
        session.commit()
        session.close()


# ------------------------------------------------------------------ job qua han ------------------


def test_ban_cho_qua_30_ngay_tu_huy(client, org, fake_storage):
    client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a()))
    session = SessionLocal()
    try:
        session.execute(
            sqlalchemy.text("UPDATE face_pending_enrollments SET expires_at = now() - interval '1 minute' WHERE user_id = :u"),
            {"u": org.emp},
        )
        session.commit()
    finally:
        session.close()
    assert expire_pending_once() >= 1
    assert _count("face_pending_enrollments", "user_id = :u", {"u": org.emp}) == 0
    assert fake_storage.objects == {}
    assert _count("face_enrollment_events", "target_user_id = :u AND action = 'EXPIRE'", {"u": org.emp}) == 1
    assert client.get(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org)).json()["status"] == "NONE"


# ------------------------------------------------------------------ vo hieu hoa / kich hoat lai -----


def test_tai_khoan_vo_hieu_hoa_khong_tai_anh_ho_duoc_va_kich_hoat_lai_la_NONE(client, org, fake_storage):
    """26/10/2026 (phat hien qua kiem thu): truoc day van tai duoc ban cho cho user da vo hieu hoa, kich
    hoat lai thi hien PENDING_CONSENT thay vi NONE (muc 27.8)."""
    from app.kafka_consumer import _dispatch

    _self_enroll(client, _emp(org), ff.person_a())
    _dispatch({"eventId": str(uuid.uuid4()), "eventType": "iam.user.deactivated", "organizationId": org.id,
               "payload": {"userId": org.emp, "actorId": org.admin}})
    for headers in (_admin(org), _manager(org)):
        put = client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=headers, files=_photo(ff.person_a()))
        assert put.status_code == 409 and put.json()["errorCode"] == "USER_INACTIVE"
    assert fake_storage.objects == {}

    _dispatch({"eventId": str(uuid.uuid4()), "eventType": "iam.user.reactivated", "organizationId": org.id,
               "payload": {"userId": org.emp, "actorId": org.admin}})
    assert client.get(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org)).json()["status"] == "NONE"
    assert client.put(f"/api/v1/ml/face/enrollments/{org.emp}", headers=_admin(org), files=_photo(ff.person_a())).status_code == 200
