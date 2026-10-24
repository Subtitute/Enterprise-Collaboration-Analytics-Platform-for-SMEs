"""24/10/2026: test TICH HOP cho 4 route /api/v1/ml/face/* (app/routes.py) - mirror tinh than
test_features_integration.py: chay DUNG Postgres thuc (postgres-ml, cong 5440), khong mock DB.

DIEU KIEN TIEN QUYET: `docker compose up -d postgres-ml` dang chay. Tu bo qua model THAT (xem
test_face.py) khi thieu file ONNX cuc bo - cac test o day van can model vi goi qua route thuc."""

import uuid
from pathlib import Path

import pytest
import sqlalchemy
from fastapi.testclient import TestClient

from app.config import INTERNAL_SHARED_SECRET
from app.db import SessionLocal, bootstrap_schema
from app.main import app

_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
_MODELS_PRESENT = (_MODELS_DIR / "face_detection_yunet.onnx").exists() and (
    _MODELS_DIR / "arcface_resnet100.onnx"
).exists()
_SAMPLE_PHOTO = _MODELS_DIR / "sample_face_for_tests.jpg"

pytestmark = pytest.mark.skipif(
    not (_MODELS_PRESENT and _SAMPLE_PHOTO.exists()),
    reason="Thieu model/anh mau ONNX cuc bo (apps/ml-service/models/) - xem Dockerfile/test_face.py.",
)


@pytest.fixture(scope="module", autouse=True)
def _ensure_schema():
    bootstrap_schema()


@pytest.fixture
def user_id():
    return str(uuid.uuid4())


@pytest.fixture
def org_id():
    return str(uuid.uuid4())


@pytest.fixture
def client(user_id, org_id):
    with TestClient(app) as c:
        yield c
    session = SessionLocal()
    try:
        session.execute(
            sqlalchemy.text("DELETE FROM face_enrollments WHERE user_id = :u"),
            {"u": user_id},
        )
        session.commit()
    finally:
        session.close()


def _auth_headers(user_id: str, org_id: str, permissions: str = "attendance:checkin") -> dict:
    return {
        "x-internal-secret": INTERNAL_SHARED_SECRET,
        "x-user-id": user_id,
        "x-org-id": org_id,
        "x-permissions": permissions,
    }


def _photo_file() -> dict:
    return {"photo": ("sample.jpg", _SAMPLE_PHOTO.read_bytes(), "image/jpeg")}


def test_thieu_quyen_attendance_checkin_tra_ve_403(client, user_id, org_id):
    resp = client.get("/api/v1/ml/face/enrollment", headers=_auth_headers(user_id, org_id, permissions=""))
    assert resp.status_code == 403


def test_chua_dang_ky_tra_ve_enrolled_false(client, user_id, org_id):
    resp = client.get("/api/v1/ml/face/enrollment", headers=_auth_headers(user_id, org_id))
    assert resp.status_code == 200
    assert resp.json() == {"enrolled": False, "enrolledAt": None}


def test_verify_khi_chua_dang_ky_tra_ve_enrolled_false_khong_loi(client, user_id, org_id):
    resp = client.post(
        "/api/v1/ml/face/verify",
        headers=_auth_headers(user_id, org_id),
        files=_photo_file(),
    )
    assert resp.status_code == 200
    assert resp.json() == {"enrolled": False, "score": None, "matched": None}


def test_dang_ky_roi_verify_cung_anh_tra_ve_matched_true_score_gan_1(client, user_id, org_id):
    enroll_resp = client.post(
        "/api/v1/ml/face/enroll",
        headers=_auth_headers(user_id, org_id),
        files=_photo_file(),
    )
    assert enroll_resp.status_code == 200
    assert enroll_resp.json()["enrolled"] is True

    status_resp = client.get("/api/v1/ml/face/enrollment", headers=_auth_headers(user_id, org_id))
    assert status_resp.json()["enrolled"] is True
    assert status_resp.json()["enrolledAt"] is not None

    verify_resp = client.post(
        "/api/v1/ml/face/verify",
        headers=_auth_headers(user_id, org_id),
        files=_photo_file(),
    )
    body = verify_resp.json()
    assert body["enrolled"] is True
    assert body["matched"] is True
    assert body["score"] == pytest.approx(1.0, abs=1e-3)


def test_dang_ky_lai_ghi_de_embedding_cu_khong_tao_2_ban_ghi(client, user_id, org_id):
    client.post("/api/v1/ml/face/enroll", headers=_auth_headers(user_id, org_id), files=_photo_file())
    client.post("/api/v1/ml/face/enroll", headers=_auth_headers(user_id, org_id), files=_photo_file())

    session = SessionLocal()
    try:
        count = session.execute(
            sqlalchemy.text("SELECT count(*) FROM face_enrollments WHERE user_id = :u"),
            {"u": user_id},
        ).scalar()
    finally:
        session.close()
    assert count == 1


def test_xoa_dang_ky_thanh_cong_verify_lai_tra_ve_enrolled_false(client, user_id, org_id):
    client.post("/api/v1/ml/face/enroll", headers=_auth_headers(user_id, org_id), files=_photo_file())

    delete_resp = client.delete("/api/v1/ml/face/enrollment", headers=_auth_headers(user_id, org_id))
    assert delete_resp.status_code == 204

    status_resp = client.get("/api/v1/ml/face/enrollment", headers=_auth_headers(user_id, org_id))
    assert status_resp.json()["enrolled"] is False
