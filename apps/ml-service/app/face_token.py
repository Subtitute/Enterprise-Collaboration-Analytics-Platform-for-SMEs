"""28/10/2026: ky diem tuong dong khuon mat de hrm-service tin duoc diem ma KHONG phai tin trinh duyet.

Truoc day web tu goi /ml/face/verify roi gui `faceMatchScore` (so tho) len /attendance/check-in -
nhan vien sua duoc so nay (vd gui 0.99) de luon hien "Khop khuon mat". Nay ml-service tra kem 1 token
HMAC-SHA256 gan chat: to chuc + nguoi dung + diem + SHA-256 cua CHINH anh vua doi chieu + han dung.
hrm-service (face-match-score.util.ts) tu tinh lai SHA-256 cua anh cham cong nhan duoc va kiem chu ky -
2 service van KHONG goi HTTP lan nhau.

Khoa ky suy ra tu INTERNAL_SHARED_SECRET (da co o ca 2 service) qua HMAC voi nhan muc dich rieng, nen
token nay khong dung lan sang muc dich khac cua secret do. Dinh dang `<payload base64url>.<chu ky
base64url>` phai khop tung byte voi ben TypeScript.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from app.config import INTERNAL_SHARED_SECRET

TOKEN_VERSION = 1
TOKEN_TTL_SECONDS = 300
_KEY_CONTEXT = b"ecap-face-match-score-v1"
_SIGNING_KEY = hmac.new(INTERNAL_SHARED_SECRET.encode(), _KEY_CONTEXT, hashlib.sha256).digest()


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def sign_face_match(organization_id: str, user_id: str, score: float, photo: bytes, now: float | None = None) -> str:
    payload = {
        "v": TOKEN_VERSION,
        "org": organization_id,
        "sub": user_id,
        "score": score,
        "ph": hashlib.sha256(photo).hexdigest(),
        "exp": int(now if now is not None else time.time()) + TOKEN_TTL_SECONDS,
    }
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    signature = _b64url(hmac.new(_SIGNING_KEY, body.encode(), hashlib.sha256).digest())
    return f"{body}.{signature}"
