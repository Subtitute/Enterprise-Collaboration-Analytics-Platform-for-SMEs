"""26/10/2026: kho anh nhan dien goc (Technical_Spec.md muc 27.5, Q1) - bucket PRIVATE
`ml-face-references` (tao boi container minio-init). ml-service la noi DUY NHAT doc/ghi bucket nay;
client chi xem anh qua proxy co kiem tra pham vi (app/face_routes.py), KHONG BAO GIO co presigned URL.

Client MinIO tao luoi (lan dau dung) de test/dev khong co MinIO van import duoc module; test thay
`storage` bang ban gia trong bo nho (tests/conftest.py)."""

from __future__ import annotations

import io
import logging
import uuid

import urllib3
from minio import Minio
from minio.error import S3Error

from app.config import MINIO_ACCESS_KEY, MINIO_ENDPOINT, MINIO_ML_BUCKET, MINIO_PORT, MINIO_SECRET_KEY, MINIO_USE_SSL

logger = logging.getLogger("ml-service.storage")


class PhotoNotFoundError(Exception):
    pass


def new_object_key(organization_id: str, user_id: str) -> str:
    # Key co UUID: ghi object moi -> cap nhat DB -> xoa object cu (khong ghi de tai cho).
    return f"{organization_id}/{user_id}/{uuid.uuid4()}.jpg"


class ObjectStorage:
    def __init__(self) -> None:
        self._client: Minio | None = None

    def _get_client(self) -> Minio:
        if self._client is None:
            # Gioi han thoi gian cho moi lan goi (mac dinh cua SDK rat dai) - MinIO "treo" khong duoc
            # keo request cua nguoi dung treo theo.
            http_client = urllib3.PoolManager(
                timeout=urllib3.Timeout(connect=5, read=15),
                retries=urllib3.Retry(total=2, backoff_factor=0.2, status_forcelist=[500, 502, 503, 504]),
            )
            self._client = Minio(
                f"{MINIO_ENDPOINT}:{MINIO_PORT}",
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_USE_SSL,
                region="us-east-1",
                http_client=http_client,
            )
        return self._client

    def put(self, key: str, data: bytes) -> None:
        self._get_client().put_object(MINIO_ML_BUCKET, key, io.BytesIO(data), len(data), content_type="image/jpeg")

    def get(self, key: str) -> bytes:
        try:
            response = self._get_client().get_object(MINIO_ML_BUCKET, key)
        except S3Error as err:
            if err.code in ("NoSuchKey", "NoSuchObject"):
                raise PhotoNotFoundError(key) from err
            raise
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def remove_quietly(self, keys: list[str | None]) -> None:
        """Xoa object cu SAU khi DB da commit - loi chi ghi log (object mo coi khong lo du lieu vi
        bucket private va khong con ban ghi nao tro toi)."""
        for key in keys:
            if not key:
                continue
            try:
                self._get_client().remove_object(MINIO_ML_BUCKET, key)
            except Exception as err:  # noqa: BLE001
                logger.warning("Khong xoa duoc object %s: %s", key, err)


storage = ObjectStorage()
