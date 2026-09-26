"""24/09/2026: unit test cho phan thuan Python cua app/features.py (resolve_range) - phan con lai
(compute_employee_features) la SQL thuan, duoc kiem tra qua tests/test_features_integration.py
(can Postgres that, xem README) va qua kiem thu song tren trinh duyet (drill-down/anomaly)."""

import pytest

from app.features import resolve_range


@pytest.mark.parametrize(
    "range_key,expected_interval,expected_days",
    [
        ("7d", "7 days", 7),
        ("30d", "30 days", 30),
        ("quarter", "3 months", 90),
    ],
)
def test_resolve_range_hop_le(range_key, expected_interval, expected_days):
    interval, days = resolve_range(range_key)
    assert interval == expected_interval
    assert days == expected_days


def test_resolve_range_khong_hop_le_nem_loi():
    with pytest.raises(ValueError):
        resolve_range("1y")
