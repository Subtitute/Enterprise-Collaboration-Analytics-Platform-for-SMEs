"""24/10/2026: Nhan dien khuon mat (VERIFY 1:1, KHONG identify 1:N) cho cham cong - danh tinh nguoi
dang check-in da biet qua JWT (giong moi endpoint khac trong he thong), cau hoi o day CHI la "anh
vua chup co dung la nguoi do khong" de lam 1 CANH BAO MEM dinh kem - KHONG chan check-in, mirror
dung triet ly co "on-site"/"off-site" GPS da co (xem AttendanceService.computeIsOnSite() ben Node).

Khong tu train model nao ca - ca 2 model deu PRETRAINED, tai luc build Docker image (xem
Dockerfile), KHONG commit vao git:
  1. YuNet (opencv_zoo, MIT) - phat hien khuon mat + 5 diem moc (mat phai/mat trai/mui/mieng
     phai/mieng trai), dung de can chinh (align) khuon mat truoc khi dua vao model nhung dac trung.
  2. ArcFace ResNet100 (onnx/models chinh thuc, Apache-2.0) - nhung 1 khuon mat da can chinh
     112x112 thanh vector 512 chieu. 2 vector cung 1 nguoi se co cosine similarity cao sau khi
     chuan hoa L2 - đây chính là phep so sanh "verify".

Nguong so sanh (MATCH_THRESHOLD) la gia tri THAM KHAO tu tai lieu cong khai, CHUA duoc tinh chinh
bang du lieu thuc te cua he thong nay - co the can dieu chinh sau khi quan sat ty le canh bao
sai/sai sot thuc te luc demo."""

from __future__ import annotations

import logging
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

logger = logging.getLogger("ml-service.face")

_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
_DETECTOR_PATH = str(_MODELS_DIR / "face_detection_yunet.onnx")
_EMBEDDER_PATH = str(_MODELS_DIR / "arcface_resnet100.onnx")

_ALIGNED_SIZE = 112

# Toa do mau chuan (112x112) cho 5 diem moc ArcFace - dung chinh toa do da cong bo trong
# face_preprocess.py cua onnx/models/validated/vision/body_analysis/arcface (README chinh thuc).
_ARCFACE_REFERENCE_LANDMARKS = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)

# Xem doc-string dau file - gia tri tham khao, chua tinh chinh bang du lieu thuc te he thong nay.
MATCH_THRESHOLD = 0.35

_detector: "cv2.FaceDetectorYN | None" = None
_embedder: ort.InferenceSession | None = None


class NoFaceDetectedError(Exception):
    """Khong phat hien duoc khuon mat nao hop le trong anh - LOI NGHIEP VU (anh mo/qua toi/khong
    co mat), khac loi he thong, can tra ve thong bao ro rang cho nguoi dung thay vi 500 chung."""


def _get_detector() -> "cv2.FaceDetectorYN":
    global _detector
    if _detector is None:
        _detector = cv2.FaceDetectorYN.create(_DETECTOR_PATH, "", (320, 320), score_threshold=0.7)
    return _detector


def _get_embedder() -> ort.InferenceSession:
    global _embedder
    if _embedder is None:
        _embedder = ort.InferenceSession(_EMBEDDER_PATH, providers=["CPUExecutionProvider"])
    return _embedder


def _detect_best_face(image: np.ndarray) -> np.ndarray:
    """Tra ve 1 hang ket qua YuNet (15 gia tri: x,y,w,h,score,10 toa do 5 diem moc) co do tin cay
    cao nhat. Neu anh vo tinh chup nhieu nguoi, GIA DINH nguoi dang check-in la khuon mat ro
    net/tin cay nhat trong khung hinh (dung cho camera chup can, khong dung cho anh dong nguoi)."""
    detector = _get_detector()
    detector.setInputSize((image.shape[1], image.shape[0]))
    _, faces = detector.detect(image)
    if faces is None or len(faces) == 0:
        raise NoFaceDetectedError("Khong phat hien duoc khuon mat nao trong anh")
    return faces[np.argmax(faces[:, -1])]


def _align_face(image: np.ndarray, face_row: np.ndarray) -> np.ndarray:
    landmarks = face_row[4:14].reshape(5, 2).astype(np.float32)
    transform, _ = cv2.estimateAffinePartial2D(landmarks, _ARCFACE_REFERENCE_LANDMARKS)
    if transform is None:
        raise NoFaceDetectedError("Khong the can chinh khuon mat tu anh da chup")
    return cv2.warpAffine(image, transform, (_ALIGNED_SIZE, _ALIGNED_SIZE))


def _run_embedder(aligned_bgr: np.ndarray) -> list[float]:
    # 24/10/2026 (fix loi NGHIEM TRONG phat hien qua QA doc lap): README cong khai cua
    # onnx/models/.../arcface noi preprocessing la (x - 127.5) / 128, nhung do la mo ta cho 1 BAN
    # EXPORT KHAC (glintr100) - tu KIEM TRA LAI truc tiep graph cua CHINH file
    # arcfaceresnet100-8.onnx da tai (qua `onnx.load()`, xem lich su commit) xac nhan: graph TU
    # chua san 2 node Sub(127.5) roi Mul(1/128) NGAY o dau, TRUOC conv0 - nghia la model nay DA
    # TU chuan hoa noi bo, chi can dua PIXEL THO (0-255). Ap dung lai (x-127.5)/128 o code nay (ban
    # cu) la chuan hoa 2 LAN LIEN TIEP - nen gia tri dua vao conv0 bi nen gan nhu thanh 1 hang so
    # (~-0.99) BAT KE anh dau vao la gi, khien MOI khuon mat deu cho ra embedding gan giong nhau
    # (~0.9+ cosine similarity voi NGUOI KHAC, vuot han nguong 0.35) - tinh nang "verify" mat hoan
    # toan kha nang phan biet, luon bao "matched" bat ke dung sai nguoi. CHI can BGR->RGB->CHW,
    # KHONG tu chuan hoa gi them - de dung cho model tu lam.
    rgb = cv2.cvtColor(aligned_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    chw = np.transpose(rgb, (2, 0, 1))
    batch = np.expand_dims(chw, axis=0)

    embedder = _get_embedder()
    input_name = embedder.get_inputs()[0].name
    raw_embedding = embedder.run(None, {input_name: batch})[0][0]

    norm = float(np.linalg.norm(raw_embedding))
    if norm == 0:
        raise NoFaceDetectedError("Khong trich xuat duoc dac trung khuon mat hop le")
    return (raw_embedding / norm).tolist()


# 24/10/2026 (fix phat hien qua QA doc lap): gioi han kich thuoc anh THAT (sau khi giai ma, khong
# phai dung luong file) truoc khi dua vao detector - anh cang lon, YuNet (chay voi setInputSize
# bang CHINH kich thuoc anh goc, xem _detect_best_face) cang ton nhieu thoi gian/RAM mot cach
# khong can thiet (do dac thuc te: anh 8000x4492 mat ~25s/luot, bo nho RSS tang hang GB voi vai
# luot dong thoi) - anh chup tu camera trinh duyet (CheckInCamera.tsx) chua bao gio can do phan
# giai lon nhu vay de nhan dien duoc khuon mat. Thu nho ve chieu dai canh dai nhat <= gia tri nay
# TRUOC KHI lam bat ky buoc nao khac trong pipeline.
_MAX_IMAGE_DIMENSION = 640

# JPEG luon bat dau bang SOI (Start Of Image, 2 byte FF D8) va ket thuc bang EOI (End Of Image, 2
# byte FF D9). Anh bi cat cut giua duong (upload loi/mang ngat giua luc gui) THIEU EOI o cuoi -
# cv2.imdecode() voi du lieu nay KHONG tra ve None nhu ky vong, ma am tham giai ma mot phan, dien
# phan con thieu bang NOI DUNG CU con sot lai trong vung nho duoc tai su dung (phat hien qua QA
# doc lap: anh cua 1 nguoi dung co the "lo" sang ket qua cua nguoi dung KHAC trong cung tien
# trinh). Kiem tra tuong minh 2 marker nay truoc khi giai ma, tu choi ro rang (NoFaceDetectedError)
# thay vi giai ma "thanh cong" tren du lieu khong day du.
_JPEG_SOI = b"\xff\xd8"
_JPEG_EOI = b"\xff\xd9"


def _assert_image_bytes_complete(image_bytes: bytes) -> None:
    if len(image_bytes) < 4:
        raise NoFaceDetectedError("Du lieu anh qua ngan hoac trong")
    if image_bytes[:2] != _JPEG_SOI or image_bytes[-2:] != _JPEG_EOI:
        raise NoFaceDetectedError("Du lieu anh khong day du hoac bi hong (thieu marker JPEG)")


def _downscale_if_needed(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    longest_side = max(height, width)
    if longest_side <= _MAX_IMAGE_DIMENSION:
        return image
    scale = _MAX_IMAGE_DIMENSION / longest_side
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def extract_face_embedding(image_bytes: bytes) -> list[float]:
    """Pipeline day du: giai ma anh -> phat hien+can chinh khuon mat (YuNet) -> nhung dac trung
    512 chieu DA L2-normalize (ArcFace). Nem NoFaceDetectedError (loi nghiep vu ro rang) neu bat
    ky buoc nao khong thuc hien duoc - KHONG bao gio de loi mo ho bubble len thanh 500 chung."""
    _assert_image_bytes_complete(image_bytes)

    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise NoFaceDetectedError("Khong doc duoc du lieu anh")
    image = _downscale_if_needed(image)

    best_face = _detect_best_face(image)
    aligned = _align_face(image, best_face)
    return _run_embedder(aligned)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Ca 2 vector dau vao da duoc L2-normalize boi extract_face_embedding() (hoac tuong duong
    luc test) - ham nay van tu chia lai cho chuan de an toan ke ca khi goi voi vector tho."""
    vec_a = np.array(a, dtype=np.float32)
    vec_b = np.array(b, dtype=np.float32)
    denom = float(np.linalg.norm(vec_a) * np.linalg.norm(vec_b))
    if denom == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / denom)
