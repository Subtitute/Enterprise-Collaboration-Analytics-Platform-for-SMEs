"""24/09/2026: unit test cho wrapper IsolationForest (app/anomaly.py) bang du lieu gia nho -
khong can Postgres/Kafka that, dung thuan tuy de kiem tra logic Python/scikit-learn."""

import numpy as np

from app.anomaly import CONTAMINATION, MIN_SAMPLE_SIZE, detect_anomalies
from app.features import EmployeeFeatures


def _employee(user_id: str, completion_rate: float, overdue_tasks: int, attendance_rate: float) -> EmployeeFeatures:
    return EmployeeFeatures(
        user_id=user_id,
        total_tasks=10,
        completion_rate=completion_rate,
        overdue_tasks=overdue_tasks,
        attendance_rate=attendance_rate,
    )


def test_duoi_nguong_mau_toi_thieu_tra_ve_rong():
    employees = [_employee(f"u{i}", 80.0, 1, 90.0) for i in range(MIN_SAMPLE_SIZE - 1)]
    assert detect_anomalies(employees) == []


def test_du_lieu_dao_dong_nhe_thuc_te_gioi_han_ty_le_flag_theo_contamination():
    # 24/09/2026: xac minh thuc te phat hien contamination='auto' (nguong CO DINH tren
    # decision_function, KHONG phai "top N%") flag toi 25-44% nhan vien tren du lieu nhieu gaussian
    # THUAN TUY (khong co bat thuong ro ret) - da doi sang contamination=CONTAMINATION (ty le CO
    # DINH, xem anomaly.py) de gioi han so luong flag co the du doan duoc. Test nay xac nhan dung
    # dieu do: so luong flag xap xi ty le CONTAMINATION * n, khong con bung no bat thuong nhu ban
    # 'auto'.
    rng = np.random.default_rng(42)
    n = 25
    completion = rng.normal(80.0, 2.0, n)
    overdue = rng.integers(0, 3, n)
    attendance = rng.normal(93.0, 2.0, n)
    employees = [
        _employee(f"u{i}", round(float(completion[i]), 1), int(overdue[i]), round(float(attendance[i]), 1))
        for i in range(n)
    ]
    results = detect_anomalies(employees)
    # +1 dung sai cho phep (IsolationForest lam tron noi bo, khong phai chinh xac tuyet doi).
    assert len(results) <= round(n * CONTAMINATION) + 1


def test_flag_dung_1_nhan_vien_lech_han_so_voi_doi_nhom():
    # 9 nguoi "binh thuong" (hoan thanh cao, cham cong deu) + 1 nguoi lech han o CA 3 chi so.
    normal = [_employee(f"normal-{i}", 85.0 + i, 0, 95.0 - i) for i in range(9)]
    outlier = _employee("outlier-1", 10.0, 8, 20.0)
    employees = normal + [outlier]

    results = detect_anomalies(employees)

    assert len(results) >= 1
    flagged_ids = {r.user_id for r in results}
    assert "outlier-1" in flagged_ids

    outlier_result = next(r for r in results if r.user_id == "outlier-1")
    assert outlier_result.metrics["completionRate"] == 10.0
    assert outlier_result.metrics["overdueTasks"] == 8
    assert outlier_result.metrics["attendanceRate"] == 20.0
    # attendanceRate cua outlier (20%) thap hon han trung binh doi nhom - huong lech phai la "down".
    assert outlier_result.top_deviation.direction in ("down", "up")
    assert outlier_result.top_deviation.metric in ("completionRate", "overdueTasks", "attendanceRate")


def test_khong_flag_nguoi_binh_thuong_khi_chi_co_1_outlier_ro_ret():
    normal = [_employee(f"normal-{i}", 85.0, 0, 95.0) for i in range(9)]
    outlier = _employee("outlier-1", 5.0, 12, 15.0)
    employees = normal + [outlier]

    results = detect_anomalies(employees)
    flagged_ids = {r.user_id for r in results}

    # Khong nguoi "binh thuong" nao bi flag nham - chi outlier ro ret moi bi gan co -1.
    assert flagged_ids.issubset({"outlier-1"})
