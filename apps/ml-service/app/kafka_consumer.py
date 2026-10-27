"""24/09/2026: consumer Kafka (aiokafka) - subscribe DUNG 3 topic da co san (iam.events,
project-task.events, hrm.events), tu xay read-model rieng cua ml-service (app/db.py) - mirror
tinh than "moi service tu xay read-model tu Kafka, khong goi HTTP noi bo xuyen service" da ap
dung xuyen suot du an (vd apps/analytics-service/src/kafka/kafka-consumer.service.ts).

Don gian hoa co chu dich so voi ban Node (KafkaConsumerService): khong xay pipeline DLQ rieng
(publish lai message loi sang topic domain-events.dlq) - day la service Python DAU TIEN, rui ro/
cong suc cao nhat trong dot nang cap nay (xem ke hoach), nen chi dung 2 muc loi don gian: du lieu
loi (log + bo qua, KHONG crash) va loi ha tang tam thoi (backoff + tu ket noi lai, mirror
restartWithBackoff() ben Node). Neu sau nay can DLQ day du, xay them 1 producer rieng ghi
DeadLetterEnvelope giong dinh dang packages/common-dto/src/events/dead-letter-envelope.ts."""

import asyncio
import json
import logging
import uuid

from aiokafka import AIOKafkaConsumer
from sqlalchemy import text

from app import face_store
from app.config import KAFKA_BROKER, KAFKA_CONSUMER_GROUP, KAFKA_TOPICS
from app.db import SessionLocal
from app.storage import storage

logger = logging.getLogger("ml-service.kafka")

_MAX_BACKOFF_SECONDS = 30


def _is_valid_envelope(envelope: dict) -> bool:
    # 24/09/2026: mirror isValidDomainEventEnvelope() (kafka-consumer.service.ts) - kiem tra
    # "vua du" de tin duoc cau truc, khong xac thuc sau tung payload cu the.
    return (
        isinstance(envelope, dict)
        and isinstance(envelope.get("eventId"), str)
        and bool(envelope.get("eventId"))
        and isinstance(envelope.get("eventType"), str)
        and bool(envelope.get("eventType"))
        and isinstance(envelope.get("organizationId"), str)
        and bool(envelope.get("organizationId"))
        and isinstance(envelope.get("payload"), dict)
    )


def _as_uuid_or_none(value):
    if not value:
        return None
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, AttributeError, TypeError):
        return None


# 26/10/2026: muc vai tro cua user (Technical_Spec.md muc 27.4) - chi chap nhan 3 gia tri nay, gia tri
# khac/thieu -> giu nguyen gia tri cu (NULL = chua biet -> pham vi Manager tu choi, fail-closed).
_ROLE_LEVELS = {"ORG_ADMIN", "MANAGER", "EMPLOYEE"}


def _role_level_or_none(value):
    return value if value in _ROLE_LEVELS else None


def _handle_user_registered(session, org_id: str, payload: dict) -> None:
    user_id = _as_uuid_or_none(payload.get("userId"))
    if not user_id:
        return
    # 26/10/2026: USER_REGISTERED mang them roleLevel (tuy chon); department_changed khong co ->
    # COALESCE giu role_level da biet thay vi xoa ve NULL.
    session.execute(
        text(
            """
            INSERT INTO dim_user (user_id, organization_id, department_id, role_level)
            VALUES (:user_id, :org_id, :department_id, :role_level)
            ON CONFLICT (user_id) DO UPDATE SET
                organization_id = EXCLUDED.organization_id,
                department_id = EXCLUDED.department_id,
                role_level = COALESCE(EXCLUDED.role_level, dim_user.role_level)
            """
        ),
        {
            "user_id": user_id,
            "org_id": org_id,
            "department_id": _as_uuid_or_none(payload.get("departmentId")),
            "role_level": _role_level_or_none(payload.get("roleLevel")),
        },
    )


def _handle_roles_changed(session, org_id: str, payload: dict) -> None:
    """26/10/2026: iam.user.roles_changed (doi vai tro + resync luc iam-service khoi dong). Ban resync
    mang them `isActive` -> tu lanh co hoat dong neu lo event deactivated/reactivated."""
    user_id = _as_uuid_or_none(payload.get("userId"))
    role_level = _role_level_or_none(payload.get("roleLevel"))
    if not user_id or not role_level:
        return
    is_active = payload.get("isActive")
    session.execute(
        text(
            """
            INSERT INTO dim_user (user_id, organization_id, department_id, role_level, is_active)
            VALUES (:user_id, :org_id, NULL, :role_level, COALESCE(:is_active, TRUE))
            ON CONFLICT (user_id) DO UPDATE SET
                role_level = EXCLUDED.role_level,
                is_active = COALESCE(:is_active, dim_user.is_active)
            WHERE dim_user.organization_id = EXCLUDED.organization_id
            """
        ),
        {"user_id": user_id, "org_id": org_id, "role_level": role_level, "is_active": is_active if isinstance(is_active, bool) else None},
    )


def _set_active(session, org_id: str, user_id: str, active: bool) -> None:
    """26/10/2026: co hoat dong cua dim_user (tao dong neu chua co de deactivated den truoc van chan duoc)."""
    session.execute(
        text(
            """
            INSERT INTO dim_user (user_id, organization_id, department_id, is_active)
            VALUES (:user_id, :org_id, NULL, :active)
            ON CONFLICT (user_id) DO UPDATE SET is_active = EXCLUDED.is_active
            WHERE dim_user.organization_id = EXCLUDED.organization_id
            """
        ),
        {"user_id": user_id, "org_id": org_id, "active": active},
    )


def _handle_user_reactivated(session, org_id: str, payload: dict) -> None:
    """26/10/2026: kich hoat lai -> hoat dong tro lai; du lieu khuon mat da bi xoa luc vo hieu hoa nen
    trang thai la NONE, phai tu dang ky va dong y lai (muc 27.8)."""
    user_id = _as_uuid_or_none(payload.get("userId"))
    if user_id:
        _set_active(session, org_id, user_id, True)


def _handle_user_deactivated(session, org_id: str, payload: dict) -> list[str]:
    """26/10/2026: vo hieu hoa tai khoan -> xoa ban dang dung + ban cho + anh + dong y (Q9, muc 27.11).
    Truoc day vo hieu hoa VAN GIU embedding. Tra ve key MinIO de xoa sau khi commit."""
    user_id = _as_uuid_or_none(payload.get("userId"))
    if not user_id:
        return []
    actor_id = _as_uuid_or_none(payload.get("actorId")) or user_id
    _set_active(session, org_id, user_id, False)
    return face_store.purge_user(session, org_id, user_id, actor_id, "PURGE_DEACTIVATED")


def _handle_user_deleted(session, org_id: str, payload: dict) -> list[str]:
    """25/09/2026: IAM Service them DELETE /users/:id (hard delete, chi cho tai khoan da vo hieu
    hoa) va phat EVENT_TYPES.USER_DELETED tuong ung - truoc do dim_user cua ml-service khong bao
    gio biet 1 user da bi xoa, khien compute_employee_features() (app/features.py, liet ke tu
    dim_user) tiep tuc dua nhung user "ma" nay vao IsolationForest, hien UUID tho (khong resolve
    duoc ten qua GET /users da xoa) thay vi bo qua han - phat hien qua phan hoi thuc te tren giao
    dien Phat hien bat thuong. Chi xoa dim_user (ban ghi lookup danh tinh/phong ban), GIU NGUYEN
    fact_task_events/fact_attendance (lich su su kien, khong phai lookup danh tinh).

    24/10/2026 (fix lo hong rieng tu THAT phat hien qua QA doc lap - Face recognition): bo sung
    xoa CA face_enrollments - day la DU LIEU SINH TRAC HOC (vector dac trung khuon mat), cung
    nhom "lookup danh tinh HIEN TAI" nhu dim_user (khong phai lich su su kien can giu de kiem
    toan/phan tich), nen PHAI xoa khi user bi xoa vinh vien, giong dung ly do dim_user duoc xoa
    o tren. Truoc fix nay, xoa tai khoan khong he dong nghia voi xoa du lieu khuon mat da dang
    ky cua ho - vi pham nguyen tac toi thieu hoa du lieu sinh trac hoc.
    """
    user_id = _as_uuid_or_none(payload.get("userId"))
    if not user_id:
        return []
    session.execute(
        text("DELETE FROM dim_user WHERE user_id = :user_id AND organization_id = :org_id"),
        {"user_id": user_id, "org_id": org_id},
    )
    # 26/10/2026: xoa them ban cho, dong y va anh goc (MinIO) - face_store.purge_user() loc dung to chuc.
    actor_id = _as_uuid_or_none(payload.get("actorId")) or user_id
    return face_store.purge_user(session, org_id, user_id, actor_id, "PURGE_DELETED")


def _handle_department_manager_changed(session, org_id: str, payload: dict) -> None:
    department_id = _as_uuid_or_none(payload.get("departmentId"))
    if not department_id:
        return
    session.execute(
        text(
            """
            INSERT INTO dim_department_manager (department_id, organization_id, manager_id)
            VALUES (:department_id, :org_id, :manager_id)
            ON CONFLICT (department_id) DO UPDATE SET
                organization_id = EXCLUDED.organization_id,
                manager_id = EXCLUDED.manager_id
            """
        ),
        {"department_id": department_id, "org_id": org_id, "manager_id": _as_uuid_or_none(payload.get("managerId"))},
    )


def _handle_task_event(session, event_id: str, org_id: str, event_type: str, occurred_at: str, payload: dict) -> None:
    task_id = _as_uuid_or_none(payload.get("taskId"))
    if not task_id:
        return
    session.execute(
        text(
            """
            INSERT INTO fact_task_events
                (event_id, organization_id, event_type, time, task_id, project_id, assignee_id, to_status, due_date)
            VALUES
                (:event_id, :org_id, :event_type, :time, :task_id, :project_id, :assignee_id, :to_status, :due_date)
            ON CONFLICT (event_id) DO NOTHING
            """
        ),
        {
            "event_id": event_id,
            "org_id": org_id,
            "event_type": event_type,
            "time": occurred_at,
            "task_id": task_id,
            "project_id": _as_uuid_or_none(payload.get("projectId")),
            "assignee_id": _as_uuid_or_none(payload.get("assigneeId")),
            "to_status": payload.get("toStatus"),
            "due_date": payload.get("dueDate"),
        },
    )


def _handle_attendance_checked_in(session, event_id: str, org_id: str, occurred_at: str, payload: dict) -> None:
    session.execute(
        text(
            """
            INSERT INTO fact_attendance (event_id, organization_id, time, user_id, work_date)
            VALUES (:event_id, :org_id, :time, :user_id, :work_date)
            ON CONFLICT (event_id) DO NOTHING
            """
        ),
        {
            "event_id": event_id,
            "org_id": org_id,
            "time": occurred_at,
            "user_id": _as_uuid_or_none(payload.get("userId")),
            "work_date": payload.get("workDate"),
        },
    )


_TASK_EVENT_TYPES = {"task.created", "task.status_changed", "task.assigned"}


def _dispatch(envelope: dict) -> None:
    event_type = envelope["eventType"]
    org_id = envelope["organizationId"]
    event_id = envelope["eventId"]
    occurred_at = envelope.get("occurredAt")
    payload = envelope["payload"]

    session = SessionLocal()
    orphan_keys: list[str] = []
    try:
        if event_type in ("iam.user.registered", "iam.user.department_changed"):
            _handle_user_registered(session, org_id, payload)
        elif event_type == "iam.user.roles_changed":
            _handle_roles_changed(session, org_id, payload)
        elif event_type == "iam.user.deactivated":
            orphan_keys = _handle_user_deactivated(session, org_id, payload)
        elif event_type == "iam.user.reactivated":
            _handle_user_reactivated(session, org_id, payload)
        elif event_type == "iam.user.deleted":
            orphan_keys = _handle_user_deleted(session, org_id, payload)
        elif event_type == "iam.department.manager_changed":
            _handle_department_manager_changed(session, org_id, payload)
        elif event_type in _TASK_EVENT_TYPES:
            _handle_task_event(session, event_id, org_id, event_type, occurred_at, payload)
        elif event_type == "attendance.checked_in":
            _handle_attendance_checked_in(session, event_id, org_id, occurred_at, payload)
        else:
            session.close()
            return
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
    # 26/10/2026: object anh goc chi xoa SAU khi DB da commit (khong de ban ghi tro toi object da mat).
    storage.remove_quietly(orphan_keys)


async def _consume_forever() -> None:
    consumer = AIOKafkaConsumer(
        *KAFKA_TOPICS,
        bootstrap_servers=KAFKA_BROKER,
        group_id=KAFKA_CONSUMER_GROUP,
        auto_offset_reset="earliest",
        enable_auto_commit=True,
    )
    await consumer.start()
    logger.info(f"Da ket noi Kafka consumer (group={KAFKA_CONSUMER_GROUP}, topics={','.join(KAFKA_TOPICS)})")
    try:
        async for message in consumer:
            try:
                envelope = json.loads(message.value)
            except (json.JSONDecodeError, UnicodeDecodeError) as err:
                logger.warning(f"Bo qua message JSON khong hop le tu topic {message.topic}: {err}")
                continue
            if not _is_valid_envelope(envelope):
                logger.warning(f"Bo qua message thieu truong bat buoc tu topic {message.topic}")
                continue
            try:
                _dispatch(envelope)
            except Exception as err:
                # 24/09/2026: loi ghi DB (vd mat ket noi Postgres tam thoi) - log va bo qua DONG
                # NAY thay vi crash toan bo consumer loop, don gian hoa co chu dich (xem docstring
                # dau file). Voi enable_auto_commit=True, dong bi loi se KHONG duoc thu lai tu dong
                # - chap nhan danh doi nay cho ban dau tien cua tinh nang.
                logger.error(f"Loi khi xu ly event {envelope.get('eventType')} (eventId={envelope.get('eventId')}): {err}")
    finally:
        await consumer.stop()


async def run_consumer_with_backoff(stop_event: asyncio.Event) -> None:
    """Vong lap tu ket noi lai voi backoff luy thua (cap 30s) - mirror restartWithBackoff()
    (kafka-consumer.service.ts) vi aiokafka cung KHONG tu dong khoi dong lai khi ket noi Kafka
    that bai/mat giua chung, chi nem exception ra ngoai vong for."""
    backoff = 1
    while not stop_event.is_set():
        try:
            await _consume_forever()
            backoff = 1
        except asyncio.CancelledError:
            raise
        except Exception as err:
            logger.error(f"Kafka consumer loi/mat ket noi, thu lai sau {backoff}s: {err}")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=backoff)
            except asyncio.TimeoutError:
                pass
            backoff = min(backoff * 2, _MAX_BACKOFF_SECONDS)
