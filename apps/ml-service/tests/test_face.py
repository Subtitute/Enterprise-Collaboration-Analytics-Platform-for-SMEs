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

# 26/10/2026: anh mau doi sang anh pham vi cong cong cua NASA (xem tests/face_fixtures.py).
_SAMPLE_PHOTO = _MODELS_DIR / "sample_crew_for_tests.jpg"

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
    sample_path = _SAMPLE_PHOTO
    if not sample_path.exists():
        pytest.skip("Thieu anh mau cuc bo - xem comment dau file.")
    truncated = sample_path.read_bytes()[: len(sample_path.read_bytes()) // 2]
    with pytest.raises(NoFaceDetectedError):
        extract_face_embedding(truncated)


@requires_models
def test_extract_face_embedding_anh_co_mat_that_tra_ve_vector_512_chieu_da_L2_normalize():
    # Anh mau (anh to bay NASA, pham vi cong cong - xem tests/face_fixtures.py) - khong commit vao git,
    # chi dung cuc bo khi co san o thu muc models/ (mirror dieu kien skip o tren).
    sample_path = _SAMPLE_PHOTO
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
    khong bi phat hien qua gate. Test nay dung chinh anh mau (nhieu khuon mat THAT) de lay 2 nguoi
    KHAC NHAU va xac nhan diem tuong dong THAP, khong vuot nguong MATCH_THRESHOLD."""
    sample_path = _SAMPLE_PHOTO
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


# ---------------------------------------------------------------------------------------------
# 26/10/2026: GD 0 (nap model 1 lan + semaphore 2 + khoa detector) va che do strict cho dang ky
# (Technical_Spec.md muc 27.10/27.12).

from concurrent.futures import ThreadPoolExecutor  # noqa: E402

from app import face as face_module  # noqa: E402
from app.face import analyze_enrollment_photo, classify_duplicate, preload_models  # noqa: E402
from tests import face_fixtures as ff  # noqa: E402


def test_classify_duplicate_2_nguong():
    assert classify_duplicate(0.95) == "block"
    assert classify_duplicate(0.5) == "block"
    assert classify_duplicate(0.49) == "warn"
    assert classify_duplicate(0.35) == "warn"
    assert classify_duplicate(0.34) is None


@requires_models
def test_preload_models_nap_dung_1_lan():
    assert preload_models() is True
    detector, embedder = face_module._detector, face_module._embedder
    assert preload_models() is True
    assert face_module._detector is detector and face_module._embedder is embedder


@pytest.mark.skipif(not ff.FIXTURES_AVAILABLE, reason="Thieu model/anh mau cuc bo.")
def test_10_luot_dong_thoi_cho_ket_qua_dung_nhu_chay_tuan_tu():
    """Detector dung chung + 2 luot dong thoi: ket qua cua moi anh phai GIONG HET khi chay 1 minh
    (truoc day setInputSize()/detect() xen ke giua 2 luong co the detect sai kich thuoc)."""
    images = [ff.person_a(), ff.person_b()]
    expected = [analyze_enrollment_photo(img).embedding for img in images]
    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(lambda i: (i % 2, analyze_enrollment_photo(images[i % 2])), range(10)))
    for idx, analysis in results:
        assert analysis.error_code is None
        assert cosine_similarity(analysis.embedding, expected[idx]) == pytest.approx(1.0, abs=1e-4)


@pytest.mark.skipif(not ff.FIXTURES_AVAILABLE, reason="Thieu model/anh mau cuc bo.")
def test_strict_phan_loai_anh_va_ma_hoa_lai_mat_EXIF():
    assert analyze_enrollment_photo(ff.two_faces()).error_code == "FACE_MULTIPLE"
    assert analyze_enrollment_photo(ff.no_face()).error_code == "FACE_NONE"
    assert analyze_enrollment_photo(ff.small_face()).error_code == "FACE_TOO_SMALL"
    assert analyze_enrollment_photo(ff.png_bytes()).error_code == "FACE_INVALID_IMAGE"
    assert analyze_enrollment_photo(ff.blurred_face()).low_quality is True
    good = analyze_enrollment_photo(ff.with_exif(ff.person_a()))
    assert good.error_code is None and good.face_count == 1 and good.face_height >= 80
    assert b"Exif" not in good.normalized_jpeg and good.normalized_jpeg[:2] == b"\xff\xd8"
    assert cosine_similarity(good.embedding, analyze_enrollment_photo(ff.person_a_variant()).embedding) >= 0.5
    assert cosine_similarity(good.embedding, analyze_enrollment_photo(ff.person_b()).embedding) < 0.35
