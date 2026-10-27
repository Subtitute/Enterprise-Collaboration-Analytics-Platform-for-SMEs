"""24/09/2026: cau hinh doc tu bien moi truong - mirror tinh than configuration.ts cua cac
service Node (mac dinh an toan cho dev, khong crash neu thieu bien khong bat buoc)."""

import os


def _bool_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes")


DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5440")
DB_NAME = os.environ.get("DB_NAME", "ml_db")
DB_USER = os.environ.get("DB_USER", "ml_user")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "ml_password")

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

KAFKA_BROKER = os.environ.get("KAFKA_BROKER", "localhost:29092")
# 24/09/2026: PHAI khop CHINH XAC voi packages/common-dto/src/events/event-types.ts
# KAFKA_CONSUMER_GROUPS.ML_SERVICE - xem ghi chu dong bo tai do.
KAFKA_CONSUMER_GROUP = "ml-service-group"
KAFKA_TOPICS = ["iam.events", "project-task.events", "hrm.events"]

# 24/09/2026: xem packages/common-dto/src/constants/internal-shared-secret.constant.ts - gia tri
# fallback CHI danh cho dev, dong bo voi InternalAuthGuard (@app/common-guard) phia Node. Mirror
# dung hanh vi fail-fast-luc-khoi-dong cua resolveExpectedInternalSecret() (internal-auth.guard.ts):
# thieu bien nay trong production la loi cau hinh nghiem trong (fail-open vao gia tri da cong khai
# trong git), nen tu choi khoi dong thay vi am tham chay tiep.
_DEV_FALLBACK_INTERNAL_SHARED_SECRET = "dev-shared-secret-change-me"
IS_PRODUCTION = os.environ.get("NODE_ENV") == "production"
_env_secret = os.environ.get("INTERNAL_SHARED_SECRET")
if _env_secret:
    INTERNAL_SHARED_SECRET = _env_secret
elif IS_PRODUCTION:
    raise RuntimeError(
        "INTERNAL_SHARED_SECRET chua duoc thiet lap trong moi truong production - tu choi khoi "
        "dong service de tranh fail-open vao gia tri fallback dev da cong khai trong ma nguon."
    )
else:
    INTERNAL_SHARED_SECRET = _DEV_FALLBACK_INTERNAL_SHARED_SECRET

# 26/10/2026: kho anh nhan dien (Technical_Spec.md muc 27.5) - bucket PRIVATE rieng cua ml-service,
# chi doc qua proxy co kiem tra pham vi (khong bao gio cap presigned URL cho anh nay). Mac dinh cho
# dev cuc bo; trong Docker dat qua infra/docker-compose.yml (minio:9000 noi bo).
MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "localhost")
MINIO_PORT = os.environ.get("MINIO_PORT", "9000")
MINIO_USE_SSL = _bool_env("MINIO_USE_SSL", False)
MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "")
MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "")
MINIO_ML_BUCKET = os.environ.get("MINIO_BUCKET", "ml-face-references")
