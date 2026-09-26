"""24/09/2026: Layer 3 Anomaly Detection - scikit-learn IsolationForest THAT (khong phai heuristic
gia lap), theo dung yeu cau cua nguoi dung (Analytics_Upgrade.md muc 2.3 - da gop vao
Technical_Spec.md muc 19). Chi chay khi nguoi dung bam nut (xem app/routes.py), khong tu dong -
mirror tinh than "Tao tom tat bao cao" (AiInsightsService) da co, tranh tinh toan thua."""

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.features import EmployeeFeatures

# 24/09/2026: can it nhat vai nhan vien de "bat thuong" (so voi trung binh doi nhom) co y nghia
# thong ke toi thieu - duoi nguong nay tra ve rong (KHONG chay model tren mau qua nho) thay vi
# tao ra ket qua gay nham lan.
MIN_SAMPLE_SIZE = 4

# 24/09/2026: contamination='auto' (nguong CO DINH tren decision_function, KHONG phai "top N%")
# da duoc XAC MINH THUC TE (tests/test_anomaly.py) flag toi 25-44% nhan vien tren du lieu nhieu
# gaussian THUAN TUY (khong co bat thuong ro ret nao) - dac tinh da biet cua 'auto' (hieu chinh
# theo benchmark goc cua thuat toan, khong dam bao ty le flag nho/co the du doan tren du lieu
# khac). Dung ty le CO DINH 10% thay the - chuan hon cho muc dich "lam noi bat 1 SO IT truong hop
# dang chu y" (dashboard/canh bao), cho ket qua co the du doan/kiem soat duoc thay vi phu thuoc
# vao dac diem thong ke ngau nhien cua tung lo du lieu.
CONTAMINATION = 0.1

_FEATURE_NAMES = ("completionRate", "overdueTasks", "attendanceRate")


@dataclass
class Deviation:
    metric: str
    value: float
    team_average: float
    direction: str  # 'down' | 'up'


@dataclass
class AnomalyResult:
    user_id: str
    metrics: dict
    top_deviation: Deviation


def detect_anomalies(employees: list[EmployeeFeatures]) -> list[AnomalyResult]:
    if len(employees) < MIN_SAMPLE_SIZE:
        return []

    # Thu tu cot PHAI khop _FEATURE_NAMES o tren.
    matrix = np.array([[e.completion_rate, e.overdue_tasks, e.attendance_rate] for e in employees], dtype=float)

    # 24/09/2026: chuan hoa truoc khi dua vao IsolationForest - cac feature khac don vi/thang do
    # (% vs so nguyen tho), StandardScaler tu dong an toan voi cot phuong sai=0 (vd toan bo nhan
    # vien deu 0 task qua han) - khong chia cho 0/NaN.
    scaled = StandardScaler().fit_transform(matrix)

    model = IsolationForest(contamination=CONTAMINATION, random_state=42)
    labels = model.fit_predict(scaled)  # -1 = bat thuong, 1 = binh thuong

    team_average = matrix.mean(axis=0)

    results: list[AnomalyResult] = []
    for idx, label in enumerate(labels):
        if label != -1:
            continue
        employee = employees[idx]
        row = matrix[idx]
        scaled_row = scaled[idx]

        # Chi so lech NHIEU NHAT so voi trung binh doi nhom - theo DO LECH CHUAN HOA (khong phai
        # gia tri tho, vi cac feature khac thang do), dung dinh dang vi du trong dac ta ("Attendance
        # 62% giam so voi trung binh doi nhom 94%").
        top_feature_idx = int(np.argmax(np.abs(scaled_row)))
        top_metric = _FEATURE_NAMES[top_feature_idx]
        value = round(float(row[top_feature_idx]), 1)
        avg = round(float(team_average[top_feature_idx]), 1)

        results.append(
            AnomalyResult(
                user_id=employee.user_id,
                metrics={
                    "totalTasks": employee.total_tasks,
                    "completionRate": employee.completion_rate,
                    "overdueTasks": employee.overdue_tasks,
                    "attendanceRate": employee.attendance_rate,
                },
                top_deviation=Deviation(
                    metric=top_metric,
                    value=value,
                    team_average=avg,
                    direction="down" if value < avg else "up",
                ),
            )
        )
    return results
