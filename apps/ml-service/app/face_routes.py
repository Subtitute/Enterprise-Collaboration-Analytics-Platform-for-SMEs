"""26/10/2026: API kho anh nhan dien + dong y (Technical_Spec.md muc 27.6-27.8) - thay 4 route
/ml/face/* cu trong app/routes.py (giu nguyen duong dan + truong `enrolled` cho client cu).

Moi route la `def` thuong (KHONG async def) - FastAPI chay trong threadpool, khong chiem event loop
(xem ghi chu 24/10/2026 o routes.py cu). Pipeline ONNX da gioi han 2 luot dong thoi (app/face.py).

Phan quyen (muc 27.7): chinh chu (attendance:checkin) cho nhom /enrollment*; Org Admin (user:manage)
ca to chuc va Manager (user:invite + co phong ban) chi Employee phong minh - doc tu dim_user
(read-model iam.events), role_level NULL -> tu choi. Super Admin bi chan o MOI route moi."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Body, Depends, Form, Query, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text

from app.auth import ATTENDANCE_CHECKIN_PERMISSION, AuthContext, get_auth_context
from app.db import SessionLocal
from app.errors import FaceError
from app.face import (
    MATCH_THRESHOLD,
    NoFaceDetectedError,
    analyze_enrollment_photo,
    classify_duplicate,
    cosine_similarity,
    extract_face_embedding,
)
from app import face_store
from app.face_token import sign_face_match
from app.storage import PhotoNotFoundError, new_object_key, storage

router = APIRouter(prefix="/api/v1/ml/face")

# Mirror MAX_PHOTO_SIZE_BYTES cua hrm-service (5MB) - client da chuan hoa JPEG <= 1MB.
_MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
_MAX_BATCH_USER_IDS = 200
_NO_STORE_HEADERS = {"Cache-Control": "no-store", "Pragma": "no-cache"}


def _read_photo(photo: UploadFile) -> bytes:
    image_bytes = photo.file.read()
    if len(image_bytes) > _MAX_PHOTO_SIZE_BYTES:
        raise FaceError(400, "FACE_INVALID_IMAGE", "Anh vuot qua dung luong cho phep (toi da 5MB)")
    return image_bytes


def _require_self(ctx: AuthContext) -> None:
    if ctx.is_super_admin or ATTENDANCE_CHECKIN_PERMISSION not in ctx.permissions:
        raise FaceError(403, "FACE_FORBIDDEN", "Thieu quyen attendance:checkin")


def _require_manager_or_admin(ctx: AuthContext) -> None:
    if ctx.is_super_admin or ctx.data_scope == "self":
        raise FaceError(403, "FACE_FORBIDDEN", "Chi Org Admin hoac Manager co phong ban moi duoc thao tac")


def _ensure_target(session, ctx: AuthContext, target_user_id: str, for_write: bool) -> None:
    """Kiem tra lai pham vi o server cho MOI thao tac theo userId muc tieu."""
    _require_manager_or_admin(ctx)
    ref = face_store.get_user_ref(session, ctx.organization_id, target_user_id)
    # 26/10/2026: tai khoan dang bi vo hieu hoa -> khong tai anh ho (truoc day tai duoc, kich hoat lai thi
    # hien PENDING_CONSENT thay vi NONE nhu muc 27.8).
    if for_write and ref is not None and ref[2] is False:
        raise FaceError(409, "USER_INACTIVE", "Tai khoan dang bi vo hieu hoa")
    if ctx.data_scope == "organization":
        if ref is None and for_write:
            raise FaceError(409, "USER_NOT_SYNCED", "Nguoi dung chua dong bo sang ml-service, thu lai sau")
        return
    out_of_scope = FaceError(403, "FACE_OUT_OF_SCOPE", "Nguoi dung nam ngoai pham vi phong ban cua ban")
    not_synced = FaceError(409, "USER_NOT_SYNCED", "Nguoi dung chua dong bo sang ml-service, thu lai sau")
    if target_user_id == ctx.user_id:
        raise out_of_scope
    if ref is None:
        raise not_synced if for_write else out_of_scope
    if ref[0] is None or str(ref[0]) != ctx.department_id:
        raise out_of_scope
    # role_level NULL = chua biet muc vai tro -> dong (fail-closed); ghi thi cho client thu lai.
    if ref[1] is None:
        raise not_synced if for_write else out_of_scope
    if ref[1] != "EMPLOYEE":
        raise out_of_scope


def _duplicate_in_scope(session, ctx: AuthContext, user_id: str) -> bool:
    if ctx.data_scope == "organization":
        return True
    ref = face_store.get_user_ref(session, ctx.organization_id, user_id)
    return ref is not None and ref[0] is not None and str(ref[0]) == ctx.department_id and ref[1] == "EMPLOYEE"


def _analyze_or_raise(image_bytes: bytes):
    analysis = analyze_enrollment_photo(image_bytes)
    if analysis.error_code:
        raise FaceError(400, analysis.error_code, analysis.error_detail or "Anh khong hop le")
    return analysis


def _duplicate_warnings(session, org_id: str, exclude_user_id: str | None, embedding) -> list[str]:
    duplicate = face_store.find_duplicate(session, org_id, exclude_user_id, embedding)
    level = classify_duplicate(duplicate[1]) if duplicate else None
    if level == "block":
        raise FaceError(409, "FACE_DUPLICATE", "Anh trung voi khuon mat cua mot nhan vien khac trong to chuc")
    return ["FACE_POSSIBLE_DUPLICATE"] if level == "warn" else []


def _status_response(session, org_id: str, user_id: str, warnings: list[str] | None = None) -> dict:
    result = face_store.load_status(session, org_id, user_id)
    result["warnings"] = warnings or []
    return result


def _photo_response(session, ctx: AuthContext, target_user_id: str, pending: bool) -> Response:
    key = face_store.get_photo_key(session, ctx.organization_id, target_user_id, pending)
    if not key:
        raise FaceError(404, "FACE_PHOTO_NOT_FOUND", "Khong co anh nhan dien")
    try:
        data = storage.get(key)
    except PhotoNotFoundError as err:
        raise FaceError(404, "FACE_PHOTO_NOT_FOUND", "Khong co anh nhan dien") from err
    # Moi luot xem anh sinh trac deu ghi nhat ky (Luat 91/2025, D.31.4(b) - muc 27.3).
    face_store.log_event(session, ctx.organization_id, ctx.user_id, target_user_id, "VIEW_REF", "PENDING" if pending else "ACTIVE")
    session.commit()
    return Response(content=data, media_type="image/jpeg", headers=_NO_STORE_HEADERS)


# ---------------------------------------------------------------- Chinh chu ----------------------


@router.post("/enroll")
def enroll_face(
    photo: UploadFile,
    consentTextVersion: str | None = Form(default=None),
    source: str = Form(default="SELF_CAMERA"),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict:
    _require_self(ctx)
    if consentTextVersion != face_store.CONSENT_TEXT_VERSION:
        raise FaceError(400, "FACE_CONSENT_REQUIRED", "Can dong y van ban xu ly du lieu khuon mat truoc khi dang ky")
    if source not in face_store.SELF_SOURCES:
        source = "SELF_CAMERA"
    analysis = _analyze_or_raise(_read_photo(photo))

    session = SessionLocal()
    try:
        warnings = _duplicate_warnings(session, ctx.organization_id, ctx.user_id, analysis.embedding)
        if analysis.low_quality:
            warnings.append("FACE_LOW_QUALITY")
        key = new_object_key(ctx.organization_id, ctx.user_id)
        storage.put(key, analysis.normalized_jpeg)
        try:
            old_keys = face_store.save_self_enrollment(
                session, ctx.organization_id, ctx.user_id, analysis.embedding, key, source, consentTextVersion
            )
            session.commit()
        except Exception:
            session.rollback()
            storage.remove_quietly([key])
            raise
        storage.remove_quietly(old_keys)
        return _status_response(session, ctx.organization_id, ctx.user_id, warnings)
    finally:
        session.close()


@router.get("/enrollment")
def get_my_enrollment(ctx: AuthContext = Depends(get_auth_context)) -> dict:
    _require_self(ctx)
    session = SessionLocal()
    try:
        return _status_response(session, ctx.organization_id, ctx.user_id)
    finally:
        session.close()


@router.get("/enrollment/photo")
def get_my_photo(ctx: AuthContext = Depends(get_auth_context)) -> Response:
    _require_self(ctx)
    session = SessionLocal()
    try:
        return _photo_response(session, ctx, ctx.user_id, pending=False)
    finally:
        session.close()


@router.get("/enrollment/pending/photo")
def get_my_pending_photo(ctx: AuthContext = Depends(get_auth_context)) -> Response:
    _require_self(ctx)
    session = SessionLocal()
    try:
        return _photo_response(session, ctx, ctx.user_id, pending=True)
    finally:
        session.close()


def _self_transition(ctx: AuthContext, action) -> dict:
    session = SessionLocal()
    try:
        try:
            old_keys = action(session)
            session.commit()
        except Exception:
            session.rollback()
            raise
        storage.remove_quietly(old_keys)
        return _status_response(session, ctx.organization_id, ctx.user_id)
    finally:
        session.close()


class ConsentIn(BaseModel):
    consentTextVersion: str | None = None


@router.post("/enrollment/confirm")
def confirm_my_pending(body: ConsentIn | None = Body(default=None), ctx: AuthContext = Depends(get_auth_context)) -> dict:
    _require_self(ctx)
    version = body.consentTextVersion if body else None
    if version != face_store.CONSENT_TEXT_VERSION:
        raise FaceError(400, "FACE_CONSENT_REQUIRED", "Can dong y van ban xu ly du lieu khuon mat truoc khi xac nhan")
    return _self_transition(ctx, lambda s: face_store.confirm_pending(s, ctx.organization_id, ctx.user_id, version))


@router.post("/enrollment/reject")
def reject_my_pending(ctx: AuthContext = Depends(get_auth_context)) -> dict:
    _require_self(ctx)
    return _self_transition(ctx, lambda s: face_store.reject_pending(s, ctx.organization_id, ctx.user_id))


@router.delete("/enrollment", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_my_consent(ctx: AuthContext = Depends(get_auth_context)) -> Response:
    _require_self(ctx)
    _self_transition(ctx, lambda s: face_store.withdraw(s, ctx.organization_id, ctx.user_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/verify")
def verify_face(photo: UploadFile, ctx: AuthContext = Depends(get_auth_context)) -> dict:
    _require_self(ctx)
    session = SessionLocal()
    try:
        # CHI doc face_enrollments (ban dang dung) - ban cho chua xac nhan coi nhu chua dang ky.
        row = session.execute(
            text(
                "SELECT embedding FROM face_enrollments WHERE user_id = :user AND organization_id = :org"
            ),
            {"user": ctx.user_id, "org": ctx.organization_id},
        ).fetchone()
    finally:
        session.close()
    # 28/10/2026: tra kem `threshold` (giao dien hien "x% / nguong y%") va `token` ky diem cho dung anh
    # nay (app/face_token.py) - hrm-service chi tin diem qua token, khong nhan diem tho tu trinh duyet.
    if row is None:
        return {"enrolled": False, "score": None, "matched": None, "threshold": MATCH_THRESHOLD, "token": None}
    image_bytes = _read_photo(photo)
    try:
        candidate = extract_face_embedding(image_bytes)
    except NoFaceDetectedError as err:
        raise FaceError(400, err.error_code, str(err)) from err
    score = cosine_similarity(candidate, list(row[0]))
    return {
        "enrolled": True,
        "score": score,
        "matched": score >= MATCH_THRESHOLD,
        "threshold": MATCH_THRESHOLD,
        "token": sign_face_match(ctx.organization_id, ctx.user_id, score, image_bytes),
    }


# ---------------------------------------------------------------- Org Admin / Manager -----------


@router.get("/enrollments")
def list_enrollments(userIds: str = Query(default=""), ctx: AuthContext = Depends(get_auth_context)) -> dict:
    _require_manager_or_admin(ctx)
    requested: list[str] = []
    for raw in userIds.split(","):
        try:
            requested.append(str(uuid.UUID(raw.strip())))
        except ValueError:
            continue
    requested = list(dict.fromkeys(requested))[:_MAX_BATCH_USER_IDS]
    session = SessionLocal()
    try:
        if ctx.data_scope == "department":
            # Nguoi ngoai pham vi bi BO KHOI ket qua (khong bao 403 tung nguoi).
            rows = text(
                "SELECT user_id FROM dim_user WHERE organization_id = :org AND user_id = ANY(CAST(:ids AS uuid[])) "
                "AND department_id = CAST(:dept AS uuid) AND role_level = 'EMPLOYEE' AND user_id <> CAST(:me AS uuid)"
            )
            allowed = {
                str(r[0])
                for r in session.execute(
                    rows, {"org": ctx.organization_id, "ids": requested, "dept": ctx.department_id, "me": ctx.user_id}
                ).fetchall()
            }
            requested = [u for u in requested if u in allowed]
        statuses = face_store.load_statuses(session, ctx.organization_id, requested) if requested else {}
        return {"data": list(statuses.values())}
    finally:
        session.close()


@router.get("/enrollments/{user_id}")
def get_enrollment(user_id: uuid.UUID, ctx: AuthContext = Depends(get_auth_context)) -> dict:
    target = str(user_id)
    session = SessionLocal()
    try:
        _ensure_target(session, ctx, target, for_write=False)
        return _status_response(session, ctx.organization_id, target)
    finally:
        session.close()


@router.get("/enrollments/{user_id}/photo")
def get_enrollment_photo(
    user_id: uuid.UUID, pending: bool = Query(default=False), ctx: AuthContext = Depends(get_auth_context)
) -> Response:
    target = str(user_id)
    session = SessionLocal()
    try:
        _ensure_target(session, ctx, target, for_write=False)
        return _photo_response(session, ctx, target, pending)
    finally:
        session.close()


@router.put("/enrollments/{user_id}")
def upload_pending(
    user_id: uuid.UUID,
    photo: UploadFile,
    source: str = Query(default="ADMIN"),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict:
    target = str(user_id)
    session = SessionLocal()
    try:
        _ensure_target(session, ctx, target, for_write=True)
        if face_store.latest_consent_action(session, ctx.organization_id, target) in face_store.BLOCKING_CONSENT_ACTIONS:
            raise FaceError(409, "FACE_CONSENT_WITHDRAWN", "Nhan vien da tu choi/rut lai dong y - khong the tai anh ho")
        # Nguon ghi nhan theo NGUOI tai (Org Admin -> ADMIN, Manager -> MANAGER), rieng nhap Excel -> IMPORT.
        recorded_source = "IMPORT" if source == "IMPORT" else ("ADMIN" if ctx.data_scope == "organization" else "MANAGER")
        analysis = _analyze_or_raise(_read_photo(photo))
        warnings = _duplicate_warnings(session, ctx.organization_id, target, analysis.embedding)
        if analysis.low_quality:
            warnings.append("FACE_LOW_QUALITY")
        key = new_object_key(ctx.organization_id, target)
        storage.put(key, analysis.normalized_jpeg)
        try:
            old_keys = face_store.save_pending(
                session, ctx.organization_id, target, analysis.embedding, key, recorded_source, ctx.user_id
            )
            session.commit()
        except Exception:
            session.rollback()
            storage.remove_quietly([key])
            raise
        storage.remove_quietly(old_keys)
        return _status_response(session, ctx.organization_id, target, warnings)
    finally:
        session.close()


@router.delete("/enrollments/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enrollment(
    user_id: uuid.UUID, pending: bool = Query(default=False), ctx: AuthContext = Depends(get_auth_context)
) -> Response:
    """Xoa anh sai; `?pending=true` chi huy ban CHO (giu ban dang dung - nut "Huy anh cho")."""
    target = str(user_id)
    session = SessionLocal()
    try:
        _ensure_target(session, ctx, target, for_write=False)
        try:
            old_keys = face_store.admin_delete(session, ctx.organization_id, target, ctx.user_id, pending_only=pending)
            session.commit()
        except Exception:
            session.rollback()
            raise
        storage.remove_quietly(old_keys)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    finally:
        session.close()


@router.post("/inspect")
def inspect_photo(
    photo: UploadFile, userId: uuid.UUID | None = Query(default=None), ctx: AuthContext = Depends(get_auth_context)
) -> dict:
    """Kiem tra 1 anh, KHONG luu gi (buoc Xem truoc cua trinh nhap Excel / hop Tai anh thay the)."""
    _require_manager_or_admin(ctx)
    analysis = analyze_enrollment_photo(_read_photo(photo))
    result = {
        "ok": analysis.error_code is None,
        "errorCode": analysis.error_code,
        "warnings": ["FACE_LOW_QUALITY"] if analysis.low_quality else [],
        "faceCount": analysis.face_count,
        "faceHeight": analysis.face_height,
        "sharpness": round(analysis.sharpness, 1),
        "duplicateUserId": None,
    }
    if analysis.embedding is None:
        return result
    session = SessionLocal()
    try:
        exclude = str(userId) if userId else None
        duplicate = face_store.find_duplicate(session, ctx.organization_id, exclude, analysis.embedding)
        level = classify_duplicate(duplicate[1]) if duplicate else None
        if level == "block":
            result["ok"], result["errorCode"] = False, "FACE_DUPLICATE"
        elif level == "warn":
            result["warnings"].append("FACE_POSSIBLE_DUPLICATE")
        # Chi neu ro userId bi trung khi nguoi do nam trong pham vi nguoi goi (muc 27.6).
        if level and _duplicate_in_scope(session, ctx, duplicate[0]):
            result["duplicateUserId"] = duplicate[0]
        return result
    finally:
        session.close()
