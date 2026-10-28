"""28/10/2026: test cho app/face_token.py - token ky diem tuong dong khuon mat ma hrm-service kiem lai.

Vector co dinh o test cuoi PHAI giong het vector trong hrm-service (face-match-score.util.spec.ts) de
bat loi lech dinh dang giua 2 ngon ngu (base64url, thu tu khoa JSON, khoa suy ra tu secret).
"""

import base64
import hashlib
import hmac
import json

from app import face_token
from app.config import INTERNAL_SHARED_SECRET


def _decode(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def test_payload_gan_dung_to_chuc_nguoi_dung_diem_anh_va_han_dung():
    token = face_token.sign_face_match("org-1", "user-1", 0.62, b"anh-cham-cong", now=1_000_000)
    body, _ = token.split(".")
    payload = json.loads(_decode(body))
    assert payload == {
        "v": 1,
        "org": "org-1",
        "sub": "user-1",
        "score": 0.62,
        "ph": hashlib.sha256(b"anh-cham-cong").hexdigest(),
        "exp": 1_000_000 + face_token.TOKEN_TTL_SECONDS,
    }


def test_chu_ky_la_hmac_sha256_cua_payload_bang_khoa_suy_ra_tu_secret():
    token = face_token.sign_face_match("org-1", "user-1", 0.62, b"anh", now=1_000_000)
    body, signature = token.split(".")
    key = hmac.new(INTERNAL_SHARED_SECRET.encode(), b"ecap-face-match-score-v1", hashlib.sha256).digest()
    assert _decode(signature) == hmac.new(key, body.encode(), hashlib.sha256).digest()


def test_vector_co_dinh_dung_chung_voi_hrm_service():
    # Secret dev mac dinh (tests chay khong dat INTERNAL_SHARED_SECRET) - xem app/config.py.
    if INTERNAL_SHARED_SECRET != "dev-shared-secret-change-me":
        return
    token = face_token.sign_face_match("org-1", "user-1", 0.5, b"photo", now=1_700_000_000)
    assert token == FIXED_VECTOR


FIXED_VECTOR = (
    "eyJ2IjoxLCJvcmciOiJvcmctMSIsInN1YiI6InVzZXItMSIsInNjb3JlIjowLjUsInBoIjoiNTVjNjRkMGZjZDZmOWQ1ZjdjODI4"
    "MDkzODU3ZTNmZGZkYTY4NDc4YmI0ZTliZDI0ZDQ4MWVmMzkxYzc4MDRlOCIsImV4cCI6MTcwMDAwMDMwMH0"
    ".KK-t7o90hciOCF9d6vXAEOgDp8YXIvjLqxdprhTRz-A"
)
