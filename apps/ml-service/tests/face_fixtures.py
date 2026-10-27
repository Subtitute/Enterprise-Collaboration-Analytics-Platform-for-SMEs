"""26/10/2026: anh test SINH BANG CODE tu anh mau - khong commit anh nguoi that nao (Technical_Spec.md
muc 27.13). Chon khuon mat theo TOA DO (khong theo thu tu diem tin cay - 2 mat co the hoa diem tren nen
tang khac).

26/10/2026 (kiem thu A4): doi anh mau tu largest_selfie.jpg cua opencv_zoo (la anh DAU RA cua YuNet - mat
da bi ve khung/diem moc) sang anh chan dung to bay STS-130 cua NASA (tac pham cua chinh phu My = PHAM VI
CONG CONG, Wikimedia Commons "STS-130 Official Crew Photo.jpg"), tai theo URL + SHA256 ghim san - xem
job ml-service-test trong .github/workflows/ci.yml. Ten tep moi de ban cu con trong models/ khong bi dung nham."""

from __future__ import annotations

import struct
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
SAMPLE_PHOTO = MODELS_DIR / "sample_crew_for_tests.jpg"
SAMPLE_PHOTO_URL = "https://upload.wikimedia.org/wikipedia/commons/4/4b/STS-130_Official_Crew_Photo.jpg"
SAMPLE_PHOTO_SHA256 = "7321cb1afaa4140569e27bf99f602140cd78791bb1c2ef7ffe4367517e8c796b"
MODELS_PRESENT = (MODELS_DIR / "face_detection_yunet.onnx").exists() and (MODELS_DIR / "arcface_resnet100.onnx").exists()
FIXTURES_AVAILABLE = MODELS_PRESENT and SAMPLE_PHOTO.exists()

# Tam khuon mat (pixel) trong anh mau 3000x2400: 2 nguoi khac nhau + 2 nguoi dung sat nhau (anh 2 mat).
_PERSON_A = (441, 1102)
_PERSON_B = (2190, 1277)
_PAIR = ((871, 1314), (1141, 1033))


@lru_cache(maxsize=1)
def _sample():
    image = cv2.imread(str(SAMPLE_PHOTO))
    detector = cv2.FaceDetectorYN.create(str(MODELS_DIR / "face_detection_yunet.onnx"), "", (320, 320), score_threshold=0.7)
    detector.setInputSize((image.shape[1], image.shape[0]))
    _, faces = detector.detect(image)
    return image, faces


def _face_near(point):
    _, faces = _sample()
    centers = faces[:, 0:2] + faces[:, 2:4] / 2
    return faces[int(np.argmin(np.linalg.norm(centers - np.array(point), axis=1)))]


def _crop(point, margin: float, longest: int) -> np.ndarray:
    return _crop_faces([point], margin, longest)


def _crop_faces(points, margin: float, longest: int) -> np.ndarray:
    """Cat vung bao cac khuon mat gan cac diem cho truoc (them le theo kich thuoc mat), roi doi co anh."""
    image, _ = _sample()
    boxes = [_face_near(p)[:4] for p in points]
    w = max(b[2] for b in boxes)
    h = max(b[3] for b in boxes)
    x0 = int(max(0, min(b[0] for b in boxes) - margin * w))
    y0 = int(max(0, min(b[1] for b in boxes) - margin * h))
    x1 = int(min(image.shape[1], max(b[0] + b[2] for b in boxes) + margin * w))
    y1 = int(min(image.shape[0], max(b[1] + b[3] for b in boxes) + margin * h))
    region = image[y0:y1, x0:x1]
    scale = longest / max(region.shape[:2])
    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
    return cv2.resize(region, (round(region.shape[1] * scale), round(region.shape[0] * scale)), interpolation=interpolation)


def _jpeg(image: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 92])
    assert ok
    return buf.tobytes()


def person_a() -> bytes:
    return _jpeg(_crop(_PERSON_A, 0.5, 480))


def person_a_variant() -> bytes:
    """Cung nguoi A, khung cat/kich thuoc khac - dung cho kiem tra trung 1:N."""
    return _jpeg(cv2.flip(_crop(_PERSON_A, 0.5, 520), 1))


def person_b() -> bytes:
    return _jpeg(_crop(_PERSON_B, 0.5, 480))


def two_faces() -> bytes:
    return _jpeg(_crop_faces(_PAIR, 0.5, 640))


def small_face() -> bytes:
    return _jpeg(_crop(_PERSON_A, 0.5, 120))


def no_face() -> bytes:
    return _jpeg(np.full((300, 300, 3), 255, dtype=np.uint8))


def png_bytes() -> bytes:
    ok, buf = cv2.imencode(".png", _crop(_PERSON_A, 0.5, 480))
    assert ok
    return buf.tobytes()


def with_trailing_data(jpeg: bytes) -> bytes:
    return jpeg + b"du-lieu-thua-sau-EOI"


def blurred_face() -> bytes:
    return _jpeg(cv2.GaussianBlur(_crop(_PERSON_A, 0.5, 480), (0, 0), 3))


def with_exif(jpeg: bytes, orientation: int = 1) -> bytes:
    """Chen 1 doan APP1 Exif (TIFF little-endian, IFD0 co 1 the Orientation) ngay sau SOI. Luu y:
    cv2.imdecode TU AP DUNG Orientation (vd 6 = xoay 90 do) - client da chuan hoa truoc khi gui."""
    entry = struct.pack("<HHIHH", 0x0112, 3, 1, orientation, 0)
    tiff = b"II*\x00" + struct.pack("<I", 8) + struct.pack("<H", 1) + entry + struct.pack("<I", 0)
    payload = b"Exif\x00\x00" + tiff
    segment = b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload
    return jpeg[:2] + segment + jpeg[2:]
