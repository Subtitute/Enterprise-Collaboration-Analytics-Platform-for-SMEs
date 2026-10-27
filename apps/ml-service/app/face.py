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

import ctypes
import logging
import threading
from dataclasses import dataclass
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

# 26/10/2026: sua 2 loi co san (Technical_Spec.md muc 27.12 GD 0). (1) Khoi tao luoi KHONG khoa:
# 2 request dau tien den gan nhu dong thoi co the cung thay `_embedder is None` va nap 2 lan model
# ArcFace 261MB duoi mem_limit 1g -> OOM; nay nap 1 lan luc khoi dong (preload_models() trong
# lifespan) va van giu double-checked lock cho truong hop goi truc tiep (test). (2) Detector YuNet
# dung chung: setInputSize() + detect() khong nguyen tu - 2 luong xen ke se detect voi kich thuoc
# cua anh kia -> khoa rieng quanh cap lenh nay; toan pipeline gioi han 2 luot dong thoi (semaphore)
# de RAM/CPU khong tang theo so request.
_init_lock = threading.Lock()
_detector_lock = threading.Lock()
_INFERENCE_SLOTS = threading.Semaphore(2)


class NoFaceDetectedError(Exception):
    """Khong phat hien duoc khuon mat nao hop le trong anh - LOI NGHIEP VU (anh mo/qua toi/khong
    co mat), khac loi he thong, can tra ve thong bao ro rang cho nguoi dung thay vi 500 chung.

    26/10/2026: them `error_code` (FACE_INVALID_IMAGE/FACE_NONE/FACE_MULTIPLE/FACE_TOO_SMALL) de
    route tra ve `{ detail, errorCode }` cho web dich qua i18n."""

    def __init__(self, message: str, error_code: str = "FACE_NONE"):
        super().__init__(message)
        self.error_code = error_code


def _get_detector() -> "cv2.FaceDetectorYN":
    global _detector
    if _detector is None:
        with _init_lock:
            if _detector is None:
                _detector = cv2.FaceDetectorYN.create(_DETECTOR_PATH, "", (320, 320), score_threshold=0.7)
    return _detector


def _get_embedder() -> ort.InferenceSession:
    global _embedder
    if _embedder is None:
        with _init_lock:
            if _embedder is None:
                _embedder = ort.InferenceSession(_EMBEDDER_PATH, providers=["CPUExecutionProvider"])
    return _embedder


def preload_models() -> bool:
    """26/10/2026: nap ca 2 model 1 lan luc khoi dong (goi tu lifespan, app/main.py). Thieu file
    (dev cuc bo chua tai model) -> chi canh bao, khong chan service (Anomaly Detection van chay)."""
    if not (Path(_DETECTOR_PATH).exists() and Path(_EMBEDDER_PATH).exists()):
        logger.warning("Thieu model ONNX trong %s - bo qua nap truoc, tinh nang khuon mat se loi khi goi.", _MODELS_DIR)
        return False
    _get_detector()
    _get_embedder()
    _release_freed_memory()
    logger.info("Da nap san model YuNet + ArcFace.")
    return True


def _release_freed_memory() -> None:
    """26/10/2026: glibc GIU LAI vung nho da free sau khi onnxruntime phan tich model 261MB - do trong
    image that: RSS 642MB -> ~380MB sau malloc_trim(0), suy luan khong cham di. Quan trong voi
    mem_limit 1g + 2 luot suy luan dong thoi. Khong phai glibc (Windows/macOS khi dev) -> bo qua."""
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass


def _detect_faces(image: np.ndarray) -> np.ndarray | None:
    detector = _get_detector()
    with _detector_lock:
        detector.setInputSize((image.shape[1], image.shape[0]))
        _, faces = detector.detect(image)
    return faces


def _detect_best_face(image: np.ndarray) -> np.ndarray:
    """Tra ve 1 hang ket qua YuNet (15 gia tri: x,y,w,h,score,10 toa do 5 diem moc) co do tin cay
    cao nhat. Neu anh vo tinh chup nhieu nguoi, GIA DINH nguoi dang check-in la khuon mat ro
    net/tin cay nhat trong khung hinh (dung cho camera chup can, khong dung cho anh dong nguoi)."""
    faces = _detect_faces(image)
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
        raise NoFaceDetectedError("Du lieu anh qua ngan hoac trong", "FACE_INVALID_IMAGE")
    if image_bytes[:2] != _JPEG_SOI or image_bytes[-2:] != _JPEG_EOI:
        raise NoFaceDetectedError("Du lieu anh khong day du hoac bi hong (thieu marker JPEG)", "FACE_INVALID_IMAGE")


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
    ky buoc nao khong thuc hien duoc - KHONG bao gio de loi mo ho bubble len thanh 500 chung.

    26/10/2026: chi con dung cho VERIFY (che do mem - lay mat ro nhat); moi luong DANG KY dung
    analyze_enrollment_photo() (che do strict) ben duoi."""
    with _INFERENCE_SLOTS:
        image = _decode_and_downscale(image_bytes)
        best_face = _detect_best_face(image)
        aligned = _align_face(image, best_face)
        return _run_embedder(aligned)


def _decode_and_downscale(image_bytes: bytes) -> np.ndarray:
    _assert_image_bytes_complete(image_bytes)
    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise NoFaceDetectedError("Khong doc duoc du lieu anh", "FACE_INVALID_IMAGE")
    return _downscale_if_needed(image)


# 26/10/2026: che do STRICT cho moi luong dang ky (tu dang ky, tai ho, nhap Excel) - Technical_Spec.md
# muc 27.10. Verify van giu hanh vi mem cu (extract_face_embedding). Nguong do net la gia tri THAM
# KHAO (chua tinh chinh bang du lieu that) nen chi la CANH BAO, khong chan.
STRICT_PRIMARY_SCORE = 0.9
STRICT_SECONDARY_SCORE = 0.7
STRICT_SECONDARY_WIDTH_RATIO = 0.25
MIN_FACE_HEIGHT_PX = 80
# Phuong sai Laplacian tren mat DA CAN CHINH 112x112: anh mau ro net do duoc ~750-920, cung anh lam
# mo Gaussian sigma 3 ~65 -> nguong 100.
LOW_SHARPNESS_THRESHOLD = 100.0
# Trung 1:N trong to chuc (Q5): >= 0,5 chan; 0,35-0,5 canh bao.
DUPLICATE_BLOCK_THRESHOLD = 0.5
DUPLICATE_WARN_THRESHOLD = MATCH_THRESHOLD


@dataclass
class FaceAnalysis:
    """Ket qua kiem tra 1 anh dang ky. `error_code` khac None = anh bi chan (khong co embedding)."""

    face_count: int = 0
    face_height: int = 0
    score: float = 0.0
    sharpness: float = 0.0
    low_quality: bool = False
    error_code: str | None = None
    error_detail: str | None = None
    embedding: list[float] | None = None
    # Anh da thu ve <= 640px va MA HOA LAI JPEG bang cv2.imencode -> mat toan bo EXIF/GPS (Q1).
    normalized_jpeg: bytes | None = None


def analyze_enrollment_photo(image_bytes: bytes) -> FaceAnalysis:
    with _INFERENCE_SLOTS:
        try:
            image = _decode_and_downscale(image_bytes)
        except NoFaceDetectedError as err:
            return FaceAnalysis(error_code=err.error_code, error_detail=str(err))

        faces = _detect_faces(image)
        if faces is None or len(faces) == 0:
            return FaceAnalysis(error_code="FACE_NONE", error_detail="Khong phat hien duoc khuon mat nao trong anh")
        faces = faces[np.argsort(-faces[:, -1])]
        primary = faces[0]
        result = FaceAnalysis(face_count=len(faces), face_height=int(round(primary[3])), score=float(primary[-1]))
        if primary[-1] < STRICT_PRIMARY_SCORE:
            result.error_code, result.error_detail = "FACE_NONE", "Khong co khuon mat du ro trong anh"
            return result
        others = [f for f in faces[1:] if f[-1] >= STRICT_SECONDARY_SCORE and f[2] >= STRICT_SECONDARY_WIDTH_RATIO * primary[2]]
        result.face_count = 1 + len(others)
        if others:
            result.error_code, result.error_detail = "FACE_MULTIPLE", "Anh co nhieu hon 1 khuon mat"
            return result
        if primary[3] < MIN_FACE_HEIGHT_PX:
            result.error_code, result.error_detail = "FACE_TOO_SMALL", "Khuon mat qua nho trong anh"
            return result

        try:
            aligned = _align_face(image, primary)
            result.embedding = _run_embedder(aligned)
        except NoFaceDetectedError as err:
            result.error_code, result.error_detail = err.error_code, str(err)
            return result
        result.sharpness = float(cv2.Laplacian(cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
        result.low_quality = result.sharpness < LOW_SHARPNESS_THRESHOLD
        ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if not ok:
            result.error_code, result.error_detail = "FACE_INVALID_IMAGE", "Khong ma hoa lai duoc anh"
            result.embedding = None
            return result
        result.normalized_jpeg = buf.tobytes()
        return result


def classify_duplicate(score: float) -> str | None:
    """'block' (>= 0,5) | 'warn' (0,35-0,5) | None - ham thuan de test 2 nguong doc lap."""
    if score >= DUPLICATE_BLOCK_THRESHOLD:
        return "block"
    if score >= DUPLICATE_WARN_THRESHOLD:
        return "warn"
    return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Ca 2 vector dau vao da duoc L2-normalize boi extract_face_embedding() (hoac tuong duong
    luc test) - ham nay van tu chia lai cho chuan de an toan ke ca khi goi voi vector tho."""
    vec_a = np.array(a, dtype=np.float32)
    vec_b = np.array(b, dtype=np.float32)
    denom = float(np.linalg.norm(vec_a) * np.linalg.norm(vec_b))
    if denom == 0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / denom)
