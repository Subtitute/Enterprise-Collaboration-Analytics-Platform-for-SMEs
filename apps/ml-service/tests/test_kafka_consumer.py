"""24/09/2026: unit test cho cac ham thuan (khong can Kafka/Postgres that) cua app/kafka_consumer.py
- xac thuc envelope + parse UUID, cung tinh than voi kafka-consumer.service.spec.ts phia Node
(kiem tra rieng "message xau" khong lam sap consumer)."""

from app.kafka_consumer import _as_uuid_or_none, _is_valid_envelope

VALID_ENVELOPE = {
    "eventId": "11111111-1111-1111-1111-111111111111",
    "eventType": "task.created",
    "occurredAt": "2026-09-24T00:00:00.000Z",
    "organizationId": "22222222-2222-2222-2222-222222222222",
    "producer": "project-task-service",
    "payload": {"taskId": "33333333-3333-3333-3333-333333333333"},
}


def test_envelope_hop_le():
    assert _is_valid_envelope(VALID_ENVELOPE) is True


def test_envelope_thieu_eventId():
    bad = {**VALID_ENVELOPE, "eventId": ""}
    assert _is_valid_envelope(bad) is False


def test_envelope_thieu_organizationId():
    bad = dict(VALID_ENVELOPE)
    del bad["organizationId"]
    assert _is_valid_envelope(bad) is False


def test_envelope_payload_khong_phai_dict():
    bad = {**VALID_ENVELOPE, "payload": "khong-phai-dict"}
    assert _is_valid_envelope(bad) is False


def test_envelope_khong_phai_dict():
    assert _is_valid_envelope("khong-phai-dict") is False
    assert _is_valid_envelope(None) is False


def test_as_uuid_or_none_hop_le():
    assert _as_uuid_or_none("11111111-1111-1111-1111-111111111111") == "11111111-1111-1111-1111-111111111111"


def test_as_uuid_or_none_khong_hop_le():
    assert _as_uuid_or_none("khong-phai-uuid") is None
    assert _as_uuid_or_none(None) is None
    assert _as_uuid_or_none("") is None
