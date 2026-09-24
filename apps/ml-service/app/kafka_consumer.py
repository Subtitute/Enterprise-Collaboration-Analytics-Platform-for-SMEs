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

from app.config import KAFKA_BROKER, KAFKA_CONSUMER_GROUP, KAFKA_TOPICS
from app.db import SessionLocal

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


def _handle_user_registered(session, org_id: str, payload: dict) -> None:
    user_id = _as_uuid_or_none(payload.get("userId"))
    if not user_id:
        return
    session.execute(
        text(
            """
            INSERT INTO dim_user (user_id, organization_id, department_id)
            VALUES (:user_id, :org_id, :department_id)
            ON CONFLICT (user_id) DO UPDATE SET
                organization_id = EXCLUDED.organization_id,
                department_id = EXCLUDED.department_id
            """
        ),
        {"user_id": user_id, "org_id": org_id, "department_id": _as_uuid_or_none(payload.get("departmentId"))},
    )


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
    try:
        if event_type in ("iam.user.registered", "iam.user.department_changed"):
            _handle_user_registered(session, org_id, payload)
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
