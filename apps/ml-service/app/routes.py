"""24/09/2026: GET /api/v1/health (healthcheck, mirror /api/v1/health cua cac service Node) va
POST /api/v1/ml/anomalies?range=7d|30d|quarter (Layer 3 Anomaly Detection, THEO YEU CAU bam nut -
khong tu dong, mirror UX "Tao tom tat bao cao" da co, xem AnalyticsPage.tsx).

24/10/2026: bo sung 4 endpoint Face recognition cho cham cong (/api/v1/ml/face/*) - xem
app/face.py cho pipeline, va Technical_Spec.md (muc bo sung cung ngay) cho thiet ke day du."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text

from app.anomaly import detect_anomalies
from app.auth import AuthContext, get_auth_context, require_attendance_checkin, require_ml_view
from app.db import SessionLocal
from app.face import MATCH_THRESHOLD, NoFaceDetectedError, cosine_similarity, extract_face_embedding
from app.features import compute_employee_features

router = APIRouter()

# 24/10/2026 (fix phat hien qua QA doc lap): gioi han dung luong file upload cho /face/* - mirror
# MAX_PHOTO_SIZE_BYTES cua attendance.controller.ts (hrm-service, cung 5MB). Khong co gioi han nao
# truoc day - 1 anh qua lon vua ton thoi gian xu ly rat lau (ONNX + resize tren anh dich day dac)
# vua chiem dung bo nho dang ke, la 1 vector tu-choi-dich-vu (DoS) de dang. Kiem tra SAU khi doc
# het file (FastAPI/Starlette da buffer toan bo truoc khi dua vao handler, xem UploadFile) nhung
# TRUOC khi dua vao pipeline ton kem (giai ma/phat hien/nhung dac trung).
_MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024


def _read_and_check_size(photo: UploadFile) -> bytes:
    image_bytes = photo.file.read()
    if len(image_bytes) > _MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Anh vuot qua dung luong cho phep (toi da 5MB)")
    return image_bytes


@router.get("/api/v1/health")
def health() -> dict:
    return {"status": "ok"}


class DeviationOut(BaseModel):
    metric: str
    value: float
    teamAverage: float
    direction: str


class AnomalyOut(BaseModel):
    userId: str
    metrics: dict
    topDeviation: DeviationOut


class AnomaliesResponse(BaseModel):
    range: str
    generatedAt: str
    sampleSize: int
    anomalies: list[AnomalyOut]


@router.post("/api/v1/ml/anomalies", response_model=AnomaliesResponse)
def post_anomalies(
    range_key: str = Query(..., alias="range", pattern="^(7d|30d|quarter)$"),
    ctx: AuthContext = Depends(get_auth_context),
) -> AnomaliesResponse:
    require_ml_view(ctx)

    session = SessionLocal()
    try:
        department_ids: list[str] | None = None
        if not ctx.is_org_admin:
            # 24/09/2026: Manager CHI xem duoc nhan vien thuoc (cac) phong ban minh phu trach -
            # mirror dung pham vi hien thi cua AnalyticsService.getDrillDown()/getRecentActivity().
            rows = session.execute(
                text(
                    "SELECT department_id FROM dim_department_manager "
                    "WHERE organization_id = :org_id AND manager_id = :manager_id"
                ),
                {"org_id": ctx.organization_id, "manager_id": ctx.user_id},
            ).fetchall()
            department_ids = [str(r[0]) for r in rows if r[0] is not None]
            if not department_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Ban khong phu trach phong ban nao nen khong the xem Phat hien bat thuong",
                )

        employees = compute_employee_features(session, ctx.organization_id, range_key, department_ids)
    finally:
        session.close()

    anomalies = detect_anomalies(employees)

    return AnomaliesResponse(
        range=range_key,
        generatedAt=datetime.now(timezone.utc).isoformat(),
        sampleSize=len(employees),
        anomalies=[
            AnomalyOut(
                userId=a.user_id,
                metrics=a.metrics,
                topDeviation=DeviationOut(
                    metric=a.top_deviation.metric,
                    value=a.top_deviation.value,
                    teamAverage=a.top_deviation.team_average,
                    direction=a.top_deviation.direction,
                ),
            )
            for a in anomalies
        ],
    )


class FaceEnrollmentStatusOut(BaseModel):
    enrolled: bool
    enrolledAt: str | None = None


class FaceVerifyOut(BaseModel):
    enrolled: bool
    score: float | None = None
    matched: bool | None = None


@router.post("/api/v1/ml/face/enroll", response_model=FaceEnrollmentStatusOut)
def enroll_face(
    photo: UploadFile,
    ctx: AuthContext = Depends(get_auth_context),
) -> FaceEnrollmentStatusOut:
    require_attendance_checkin(ctx)

    # 24/10/2026 (fix phat hien qua QA doc lap): route nay PHAI la `def` thuong (KHONG `async def`)
    # - mirror dung post_anomalies() o tren. Than ham lam 2 viec CHAN (blocking): suy luan ONNX
    # (CPU-bound, ~0.25s/anh) va goi DB dong bo qua SQLAlchemy Session. `async def` + `await
    # photo.read()` trong khi phan con lai van chay dong bo se CHIEM DUNG vong lap event loop
    # CHINH cua uvicorn trong suot thoi gian do - MOI request khac (ke ca GET /health, GET
    # /enrollment cua nguoi dung khac) phai doi xep hang phia sau. Do dac: 20 lan goi dong thoi
    # xep hang tu 0.55s den 5.7s thay vi chay song song. `def` thuong khien FastAPI tu dong chay
    # CA HAM trong threadpool rieng (Starlette), khong chiem event loop chinh.
    image_bytes = _read_and_check_size(photo)
    try:
        embedding = extract_face_embedding(image_bytes)
    except NoFaceDetectedError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    session = SessionLocal()
    try:
        session.execute(
            text(
                """
                INSERT INTO face_enrollments (user_id, organization_id, embedding, enrolled_at)
                VALUES (:user_id, :org_id, :embedding, now())
                ON CONFLICT (user_id) DO UPDATE
                    SET embedding = EXCLUDED.embedding, enrolled_at = EXCLUDED.enrolled_at
                """
            ),
            {"user_id": ctx.user_id, "org_id": ctx.organization_id, "embedding": embedding},
        )
        session.commit()
    finally:
        session.close()

    return FaceEnrollmentStatusOut(enrolled=True, enrolledAt=datetime.now(timezone.utc).isoformat())


@router.get("/api/v1/ml/face/enrollment", response_model=FaceEnrollmentStatusOut)
def get_face_enrollment(ctx: AuthContext = Depends(get_auth_context)) -> FaceEnrollmentStatusOut:
    require_attendance_checkin(ctx)

    session = SessionLocal()
    try:
        row = session.execute(
            text("SELECT enrolled_at FROM face_enrollments WHERE user_id = :user_id"),
            {"user_id": ctx.user_id},
        ).fetchone()
    finally:
        session.close()

    if row is None:
        return FaceEnrollmentStatusOut(enrolled=False)
    return FaceEnrollmentStatusOut(enrolled=True, enrolledAt=row[0].isoformat())


@router.delete("/api/v1/ml/face/enrollment", status_code=status.HTTP_204_NO_CONTENT)
def delete_face_enrollment(ctx: AuthContext = Depends(get_auth_context)) -> None:
    require_attendance_checkin(ctx)

    session = SessionLocal()
    try:
        session.execute(text("DELETE FROM face_enrollments WHERE user_id = :user_id"), {"user_id": ctx.user_id})
        session.commit()
    finally:
        session.close()


@router.post("/api/v1/ml/face/verify", response_model=FaceVerifyOut)
def verify_face(
    photo: UploadFile,
    ctx: AuthContext = Depends(get_auth_context),
) -> FaceVerifyOut:
    require_attendance_checkin(ctx)

    session = SessionLocal()
    try:
        row = session.execute(
            text("SELECT embedding FROM face_enrollments WHERE user_id = :user_id"),
            {"user_id": ctx.user_id},
        ).fetchone()
    finally:
        session.close()

    # 24/10/2026: CHUA dang ky khuon mat - tra ve "khong co du lieu de danh gia" (enrolled=false,
    # score/matched=null), KHONG phai loi - mirror dung quy uoc "null khac false" cua co GPS
    # on-site/off-site da co (AttendanceService.computeIsOnSite()). Frontend an han badge khi
    # enrolled=false, KHONG hien "khong khop".
    if row is None:
        return FaceVerifyOut(enrolled=False)

    image_bytes = _read_and_check_size(photo)
    try:
        candidate_embedding = extract_face_embedding(image_bytes)
    except NoFaceDetectedError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)) from err

    enrolled_embedding = list(row[0])
    score = cosine_similarity(candidate_embedding, enrolled_embedding)
    return FaceVerifyOut(enrolled=True, score=score, matched=score >= MATCH_THRESHOLD)
