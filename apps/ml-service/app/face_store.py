"""26/10/2026: tang du lieu cua kho anh nhan dien + dong y (Technical_Spec.md muc 27.4/27.8/27.11).

Moi truy van/upsert deu loc `organization_id` (GD 0, Q14) - user_id la UUID toan cuc nhung 1 ban
ghi cua to chuc A khong bao gio duoc doc/ghi/xoa bang ngu canh cua to chuc B. Upsert dung
`ON CONFLICT ... DO UPDATE ... WHERE <bang>.organization_id = EXCLUDED.organization_id RETURNING`
- khong tra ve dong nao = xung dot xuyen to chuc -> tu choi ro rang thay vi am tham bo qua.

Cac ham chi thao tac DB tren `session` truyen vao (route/consumer tu commit); ham nao lam object
MinIO tro nen mo coi thi TRA VE danh sach key de goi storage.remove_quietly() SAU khi commit."""

from __future__ import annotations

import uuid

import numpy as np
from sqlalchemy import text

from app.errors import FaceError

CONSENT_TEXT_VERSION = "face-consent-v1"
PENDING_TTL_DAYS = 30
BLOCKING_CONSENT_ACTIONS = ("REJECT", "WITHDRAW")
SELF_SOURCES = ("SELF_CAMERA", "SELF_UPLOAD")


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def log_event(session, org_id: str, actor_id: str, target_user_id: str, action: str, source: str | None = None) -> None:
    session.execute(
        text(
            "INSERT INTO face_enrollment_events (id, organization_id, actor_id, target_user_id, action, source, created_at) "
            "VALUES (:id, :org, :actor, :target, :action, :source, clock_timestamp())"
        ),
        {"id": str(uuid.uuid4()), "org": org_id, "actor": actor_id, "target": target_user_id, "action": action, "source": source},
    )


def record_consent(session, org_id: str, user_id: str, action: str, source: str, actor_id: str, version: str | None = None) -> None:
    # clock_timestamp() (khong phai now()) de 2 ban ghi trong cung transaction van co thu tu dung.
    session.execute(
        text(
            "INSERT INTO face_consents (id, organization_id, user_id, action, consent_text_version, source, actor_id, created_at) "
            "VALUES (:id, :org, :user, :action, :version, :source, :actor, clock_timestamp())"
        ),
        {"id": str(uuid.uuid4()), "org": org_id, "user": user_id, "action": action, "version": version, "source": source, "actor": actor_id},
    )


def latest_consent_action(session, org_id: str, user_id: str) -> str | None:
    row = session.execute(
        text(
            "SELECT action FROM face_consents WHERE organization_id = :org AND user_id = :user "
            "ORDER BY created_at DESC LIMIT 1"
        ),
        {"org": org_id, "user": user_id},
    ).fetchone()
    return row[0] if row else None


def get_user_ref(session, org_id: str, user_id: str):
    """Dong dim_user (read-model tu iam.events) cua dung to chuc - None neu chua dong bo.
    26/10/2026: tra them is_active (cot thu 3)."""
    return session.execute(
        text("SELECT department_id, role_level, is_active FROM dim_user WHERE user_id = :user AND organization_id = :org"),
        {"user": user_id, "org": org_id},
    ).fetchone()


def load_statuses(session, org_id: str, user_ids: list[str]) -> dict[str, dict]:
    params = {"org": org_id, "ids": user_ids}
    active = {
        str(r[0]): r
        for r in session.execute(
            text(
                "SELECT user_id, enrolled_at, source, enrolled_by, photo_object_key FROM face_enrollments "
                "WHERE organization_id = :org AND user_id = ANY(CAST(:ids AS uuid[]))"
            ),
            params,
        ).fetchall()
    }
    pending = {
        str(r[0]): r
        for r in session.execute(
            text(
                "SELECT user_id, source, actor_id, created_at, expires_at FROM face_pending_enrollments "
                "WHERE organization_id = :org AND user_id = ANY(CAST(:ids AS uuid[])) AND expires_at > now()"
            ),
            params,
        ).fetchall()
    }
    consents = {
        str(r[0]): r
        for r in session.execute(
            text(
                "SELECT DISTINCT ON (user_id) user_id, action, created_at FROM face_consents "
                "WHERE organization_id = :org AND user_id = ANY(CAST(:ids AS uuid[])) ORDER BY user_id, created_at DESC"
            ),
            params,
        ).fetchall()
    }
    return {uid: _build_status(uid, active.get(uid), pending.get(uid), consents.get(uid)) for uid in user_ids}


def load_status(session, org_id: str, user_id: str) -> dict:
    return load_statuses(session, org_id, [user_id])[user_id]


def _build_status(user_id: str, active, pending, consent) -> dict:
    if active is not None:
        status = "ACTIVE"
    elif pending is not None:
        status = "PENDING_CONSENT"
    elif consent is not None and consent[1] in BLOCKING_CONSENT_ACTIONS:
        status = "WITHDRAWN"
    else:
        status = "NONE"
    return {
        "userId": user_id,
        "status": status,
        # Giu `enrolled` cho client cu (ProfileFaceEnrollmentCard truoc ngay nay) = status ACTIVE.
        "enrolled": active is not None,
        "enrolledAt": _iso(active[1]) if active is not None else None,
        "source": active[2] if active is not None else None,
        "enrolledBy": str(active[3]) if active is not None and active[3] else None,
        "hasPhoto": bool(active is not None and active[4]),
        "pending": (
            {"source": pending[1], "actorId": str(pending[2]), "createdAt": _iso(pending[3]), "expiresAt": _iso(pending[4])}
            if pending is not None
            else None
        ),
        "consentAction": consent[1] if consent is not None else None,
        "consentAt": _iso(consent[2]) if consent is not None else None,
    }


def find_duplicate(session, org_id: str, exclude_user_id: str | None, embedding: list[float]) -> tuple[str, float] | None:
    """So khop 1:N voi ban dang dung + ban cho cua CA to chuc (tru chinh nguoi do). Embedding da
    L2-normalize nen tich vo huong = cosine similarity."""
    rows = session.execute(
        text(
            "SELECT user_id, embedding FROM face_enrollments WHERE organization_id = :org "
            "AND (CAST(:exclude AS uuid) IS NULL OR user_id <> CAST(:exclude AS uuid)) "
            "UNION ALL "
            "SELECT user_id, embedding FROM face_pending_enrollments WHERE organization_id = :org AND expires_at > now() "
            "AND (CAST(:exclude AS uuid) IS NULL OR user_id <> CAST(:exclude AS uuid))"
        ),
        {"org": org_id, "exclude": exclude_user_id},
    ).fetchall()
    if not rows:
        return None
    matrix = np.array([list(r[1]) for r in rows], dtype=np.float32)
    scores = matrix @ np.array(embedding, dtype=np.float32)
    best = int(np.argmax(scores))
    return str(rows[best][0]), float(scores[best])


def _upsert_active(session, org_id: str, user_id: str, embedding, key: str, source: str, enrolled_by: str) -> None:
    row = session.execute(
        text(
            """
            INSERT INTO face_enrollments (user_id, organization_id, embedding, enrolled_at, photo_object_key, source, enrolled_by)
            VALUES (:user, :org, :embedding, now(), :key, :source, :by)
            ON CONFLICT (user_id) DO UPDATE SET
                embedding = EXCLUDED.embedding, enrolled_at = EXCLUDED.enrolled_at,
                photo_object_key = EXCLUDED.photo_object_key, source = EXCLUDED.source,
                enrolled_by = EXCLUDED.enrolled_by, model_version = DEFAULT
            WHERE face_enrollments.organization_id = EXCLUDED.organization_id
            RETURNING user_id
            """
        ),
        {"user": user_id, "org": org_id, "embedding": list(embedding), "key": key, "source": source, "by": enrolled_by},
    ).fetchone()
    if row is None:
        raise FaceError(409, "FACE_ORG_MISMATCH", "Ban ghi khuon mat thuoc to chuc khac")


def _active_key(session, org_id: str, user_id: str):
    row = session.execute(
        text("SELECT photo_object_key FROM face_enrollments WHERE user_id = :user AND organization_id = :org"),
        {"user": user_id, "org": org_id},
    ).fetchone()
    return row


def _delete_pending(session, org_id: str, user_id: str) -> list[str]:
    rows = session.execute(
        text("DELETE FROM face_pending_enrollments WHERE user_id = :user AND organization_id = :org RETURNING photo_object_key"),
        {"user": user_id, "org": org_id},
    ).fetchall()
    return [r[0] for r in rows]


def _delete_active(session, org_id: str, user_id: str) -> list[str]:
    rows = session.execute(
        text("DELETE FROM face_enrollments WHERE user_id = :user AND organization_id = :org RETURNING photo_object_key"),
        {"user": user_id, "org": org_id},
    ).fetchall()
    return [r[0] for r in rows]


def save_self_enrollment(session, org_id: str, user_id: str, embedding, key: str, source: str, version: str) -> list[str]:
    """Tu dang ky = ghi dong y + co hieu luc ngay; ban cho (neu co) bi thay the."""
    previous = _active_key(session, org_id, user_id)
    old_keys = [previous[0]] if previous is not None else []
    old_keys += _delete_pending(session, org_id, user_id)
    _upsert_active(session, org_id, user_id, embedding, key, source, user_id)
    record_consent(session, org_id, user_id, "CONSENT", source, user_id, version)
    log_event(session, org_id, user_id, user_id, "RE_ENROLL" if previous is not None else "ENROLL", source)
    return old_keys


def save_pending(session, org_id: str, user_id: str, embedding, key: str, source: str, actor_id: str) -> list[str]:
    """Tai ho/nhap Excel -> ban CHO (30 ngay); ban dang dung (neu co) van duoc verify toi khi xac nhan."""
    previous = session.execute(
        text("SELECT photo_object_key FROM face_pending_enrollments WHERE user_id = :user AND organization_id = :org"),
        {"user": user_id, "org": org_id},
    ).fetchone()
    row = session.execute(
        text(
            f"""
            INSERT INTO face_pending_enrollments
                (user_id, organization_id, embedding, photo_object_key, source, actor_id, created_at, expires_at)
            VALUES (:user, :org, :embedding, :key, :source, :actor, now(), now() + interval '{PENDING_TTL_DAYS} days')
            ON CONFLICT (user_id) DO UPDATE SET
                embedding = EXCLUDED.embedding, photo_object_key = EXCLUDED.photo_object_key,
                source = EXCLUDED.source, actor_id = EXCLUDED.actor_id,
                created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at
            WHERE face_pending_enrollments.organization_id = EXCLUDED.organization_id
            RETURNING user_id
            """
        ),
        {"user": user_id, "org": org_id, "embedding": list(embedding), "key": key, "source": source, "actor": actor_id},
    ).fetchone()
    if row is None:
        raise FaceError(409, "FACE_ORG_MISMATCH", "Ban ghi khuon mat thuoc to chuc khac")
    log_event(session, org_id, actor_id, user_id, "UPLOAD_PENDING", source)
    return [previous[0]] if previous is not None else []


def confirm_pending(session, org_id: str, user_id: str, version: str) -> list[str]:
    pending = session.execute(
        text(
            "DELETE FROM face_pending_enrollments WHERE user_id = :user AND organization_id = :org AND expires_at > now() "
            "RETURNING embedding, photo_object_key, source, actor_id"
        ),
        {"user": user_id, "org": org_id},
    ).fetchone()
    if pending is None:
        raise FaceError(404, "FACE_PENDING_NOT_FOUND", "Khong co anh cho xac nhan")
    previous = _active_key(session, org_id, user_id)
    _upsert_active(session, org_id, user_id, pending[0], pending[1], pending[2], str(pending[3]))
    record_consent(session, org_id, user_id, "CONFIRM", pending[2], user_id, version)
    log_event(session, org_id, user_id, user_id, "CONFIRM", pending[2])
    return [previous[0]] if previous is not None else []


def reject_pending(session, org_id: str, user_id: str) -> list[str]:
    keys = _delete_pending(session, org_id, user_id)
    if not keys:
        raise FaceError(404, "FACE_PENDING_NOT_FOUND", "Khong co anh cho xac nhan")
    record_consent(session, org_id, user_id, "REJECT", "SELF", user_id)
    log_event(session, org_id, user_id, user_id, "REJECT")
    return keys


def withdraw(session, org_id: str, user_id: str) -> list[str]:
    """Rut lai dong y: xoa ban dang dung + ban cho + anh; tai ho bi chan (409) toi khi tu dang ky lai."""
    keys = _delete_active(session, org_id, user_id) + _delete_pending(session, org_id, user_id)
    record_consent(session, org_id, user_id, "WITHDRAW", "SELF", user_id)
    log_event(session, org_id, user_id, user_id, "WITHDRAW")
    return keys


def admin_delete(session, org_id: str, user_id: str, actor_id: str, pending_only: bool = False) -> list[str]:
    """Org Admin/Manager xoa anh sai - KHONG tinh la rut dong y."""
    keys = [] if pending_only else _delete_active(session, org_id, user_id)
    keys += _delete_pending(session, org_id, user_id)
    log_event(session, org_id, actor_id, user_id, "DELETE", "PENDING" if pending_only else None)
    return keys


def purge_user(session, org_id: str, user_id: str, actor_id: str, action: str) -> list[str]:
    """Vo hieu hoa/xoa tai khoan (iam.events) -> xoa sach du lieu khuon mat + dong y. Kich hoat lai
    sau do = trang thai NONE, phai dang ky va dong y lai (muc 27.8)."""
    keys = _delete_active(session, org_id, user_id) + _delete_pending(session, org_id, user_id)
    session.execute(
        text("DELETE FROM face_consents WHERE user_id = :user AND organization_id = :org"),
        {"user": user_id, "org": org_id},
    )
    log_event(session, org_id, actor_id, user_id, action)
    return keys


def get_photo_key(session, org_id: str, user_id: str, pending: bool) -> str | None:
    if pending:
        row = session.execute(
            text(
                "SELECT photo_object_key FROM face_pending_enrollments "
                "WHERE user_id = :user AND organization_id = :org AND expires_at > now()"
            ),
            {"user": user_id, "org": org_id},
        ).fetchone()
    else:
        row = _active_key(session, org_id, user_id)
    return row[0] if row is not None else None


def expire_pending_and_prune(session) -> list[str]:
    """Job hang gio (lifespan): huy ban cho qua 30 ngay (xoa anh + embedding) + xoa nhat ky > 1 nam."""
    rows = session.execute(
        text(
            "DELETE FROM face_pending_enrollments WHERE expires_at <= now() "
            "RETURNING organization_id, user_id, photo_object_key, actor_id, source"
        )
    ).fetchall()
    for org_id, user_id, _key, actor_id, source in rows:
        log_event(session, str(org_id), str(actor_id), str(user_id), "EXPIRE", source)
    session.execute(text("DELETE FROM face_enrollment_events WHERE created_at < now() - interval '1 year'"))
    return [r[2] for r in rows]
