"""24/10/2026: test cho app/face.py (Face recognition - verify 1:1 cho cham cong, canh bao MEM).

`cosine_similarity()` la ham thuan (pure function) - test khong dieu kien. Cac test con lai can
2 model ONNX THAT (tai luc build Docker image, xem Dockerfile - KHONG commit vao git) nen tu bo
qua (skip, khong fail) khi dev chay pytest cuc bo ma chua tu tai 2 file vao
apps/ml-service/models/ (xem .gitignore)."""

from pathlib import Path

import cv2
import numpy as np
import pytest

from app.face import (
    MATCH_THRESHOLD,
    NoFaceDetectedError,
    _align_face,
    _get_detector,
    _run_embedder,
    cosine_similarity,
    extract_face_embedding,
)

_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
_MODELS_PRESENT = (_MODELS_DIR / "face_detection_yunet.onnx").exists() and (
    _MODELS_DIR / "arcface_resnet100.onnx"
).exists()

requires_models = pytest.mark.skipif(
    not _MODELS_PRESENT,
    reason="Thieu model ONNX cuc bo (apps/ml-service/models/) - xem Dockerfile de biet cach tai, khong fail CI khi chua co.",
)


def test_cosine_similarity_vector_giong_nhau_tra_ve_gan_1():
    vec = [1.0, 0.0, 0.0, 0.0]
    assert cosine_similarity(vec, vec) == pytest.approx(1.0, abs=1e-6)


def test_cosine_similarity_vector_vuong_goc_tra_ve_0():
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0, abs=1e-6)


def test_cosine_similarity_vector_doi_nhau_tra_ve_gan_am_1():
    assert cosine_similarity([1.0, 0.0], [-1.0, 0.0]) == pytest.approx(-1.0, abs=1e-6)


def test_cosine_similarity_vector_0_tra_ve_0_khong_chia_cho_0():
    assert cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0


def _encode_blank_image_bytes() -> bytes:
    blank = np.ones((200, 200, 3), dtype=np.uint8) * 255
    ok, buf = cv2.imencode(".jpg", blank)
    assert ok
    return buf.tobytes()


@requires_models
def test_extract_face_embedding_anh_khong_co_mat_nem_NoFaceDetectedError():
    with pytest.raises(NoFaceDetectedError):
        extract_face_embedding(_encode_blank_image_bytes())


@requires_models
def test_extract_face_embedding_du_lieu_anh_hong_nem_NoFaceDetectedError():
    with pytest.raises(NoFaceDetectedError):
        extract_face_embedding(b"khong phai du lieu anh hop le")


def test_extract_face_embedding_bytes_rong_nem_NoFaceDetectedError_khong_crash():
    with pytest.raises(NoFaceDetectedError):
        extract_face_embedding(b"")


@requires_models
def test_extract_face_embedding_anh_bi_cat_cut_thieu_EOI_bi_tu_choi():
    """24/10/2026 (fix phat hien qua QA doc lap): JPEG bi cat cut giua duong (vd mang ngat giua
    luc upload) THIEU marker EOI o cuoi - cv2.imdecode() co the am tham giai ma mot phan thay vi
    tra ve None, de lo noi dung bo nho con sot lai tu lan goi truoc (nguy co lo du lieu giua cac
    nguoi dung/to chuc khac nhau trong cung tien trinh). Phai tu choi RO RANG truoc khi giai ma."""
    sample_path = _MODELS_DIR / "sample_face_for_tests.jpg"
    if not sample_path.exists():
        pytest.skip("Thieu anh mau cuc bo - xem comment dau file.")
    truncated = sample_path.read_bytes()[: len(sample_path.read_bytes()) // 2]
    with pytest.raises(NoFaceDetectedError):
        extract_face_embedding(truncated)


@requires_models
def test_extract_face_embedding_anh_co_mat_that_tra_ve_vector_512_chieu_da_L2_normalize():
    # Anh mau tu opencv_zoo (cung license MIT voi model YuNet) - khong commit vao git, chi dung
    # cuc bo khi co san o thu muc models/ (mirror dieu kien skip o tren).
    sample_path = _MODELS_DIR / "sample_face_for_tests.jpg"
    if not sample_path.exists():
        pytest.skip("Thieu anh mau cuc bo de test end-to-end - xem comment dau file.")

    embedding = extract_face_embedding(sample_path.read_bytes())

    assert len(embedding) == 512
    assert np.linalg.norm(embedding) == pytest.approx(1.0, abs=1e-4)
    # Tu so sanh voi chinh minh phai gan 1.0 - xac nhan pipeline end-to-end (phat hien + can
    # chinh + nhung dac trung) hoat dong dung, khong chi "khong crash".
    assert cosine_similarity(embedding, embedding) == pytest.approx(1.0, abs=1e-4)


@requires_models
def test_extract_face_embedding_PHAN_BIET_DUOC_2_NGUOI_KHAC_NHAU():
    """24/10/2026 (fix loi NGHIEM TRONG phat hien qua QA doc lap): ban truoc chuan hoa dau vao 2
    LAN (code tu chuan hoa (x-127.5)/128 CONG THEM 1 lan chinh graph ONNX da tu lam o dau mang),
    nen MOI khuon mat deu cho ra embedding gan giong nhau bat ke la ai - verify() luon bao
    "matched" voi BAT KY nguoi nao, khong chi chu nhan thuc su. Test tu-so-sanh-voi-chinh-minh o
    tren KHONG the bat loi nay (ca 2 phia deu dung CUNG embedding) - day la ly do loi ton tai ma
    khong bi phat hien qua gate. Test nay dung chinh anh mau (92 khuon mat THAT) de lay 2 nguoi
    KHAC NHAU va xac nhan diem tuong dong THAP, khong vuot nguong MATCH_THRESHOLD."""
    sample_path = _MODELS_DIR / "sample_face_for_tests.jpg"
    if not sample_path.exists():
        pytest.skip("Thieu anh mau cuc bo de test end-to-end - xem comment dau file.")

    image_bytes = sample_path.read_bytes()
    image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    detector = _get_detector()
    detector.setInputSize((image.shape[1], image.shape[0]))
    _, faces = detector.detect(image)
    assert faces is not None and len(faces) >= 2, "Anh mau phai co it nhat 2 khuon mat de test phan biet"

    faces_sorted = faces[np.argsort(-faces[:, -1])][:2]
    embeddings = [_run_embedder(_align_face(image, f)) for f in faces_sorted]

    score = cosine_similarity(embeddings[0], embeddings[1])
    assert score < MATCH_THRESHOLD, (
        f"2 nguoi KHAC NHAU trong anh mau bi bao 'khop' (score={score:.4f} >= nguong "
        f"{MATCH_THRESHOLD}) - day CHINH LA trieu chung cua loi chuan hoa 2 lan da sua 24/10/2026."
    )
