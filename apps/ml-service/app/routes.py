"""24/09/2026: GET /api/v1/health (healthcheck, mirror /api/v1/health cua cac service Node) va
POST /api/v1/ml/anomalies?range=7d|30d|quarter (Layer 3 Anomaly Detection, THEO YEU CAU bam nut -
khong tu dong, mirror UX "Tao tom tat bao cao" da co, xem AnalyticsPage.tsx)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text

from app.anomaly import detect_anomalies
from app.auth import AuthContext, get_auth_context, require_ml_view
from app.db import SessionLocal
from app.features import compute_employee_features

router = APIRouter()


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
