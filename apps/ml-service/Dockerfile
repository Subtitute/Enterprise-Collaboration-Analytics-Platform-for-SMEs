# 24/09/2026: service Python dau tien cua du an (Layer 3 Anomaly Detection) - mirror TINH THAN
# multi-stage cua Dockerfile cac service Node (builder cai/build, runner gon nhe, user khong phai
# root, chi EXPOSE+CMD o cuoi), khong copy y het duoc buoc npm-workspace vi day la he sinh thai
# khac (pip, khong co "workspace" dung chung).
FROM python:3.12-slim AS builder
WORKDIR /workspace
COPY apps/ml-service/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# 24/10/2026: Face recognition - tai 2 model ONNX pretrained LUC BUILD IMAGE (khong commit 261MB+
# 232KB nhi phan vao git repo, se phinh vinh vien lich su git). Ca 2 duoc luu qua Git LFS cua
# GitHub nen PHAI qua endpoint media.githubusercontent.com (raw.githubusercontent.com chi tra ve
# con trich dan LFS dang text, khong phai noi dung nhi phan thuc) - xem app/face.py cho chi tiet
# pipeline su dung 2 model nay. License: YuNet (opencv_zoo) MIT, ArcFace ResNet100 (onnx/models
# chinh thuc) Apache-2.0 - ca 2 deu dung duoc cho muc dich hoc thuat/thuong mai.
#
# 24/10/2026 (fix phat hien qua QA doc lap): GHIM commit SHA cu the (khong dung `main` - 1 nhanh
# TROI, co the doi noi dung bat ky luc nao ma build khong he bao, mirror dung tinh than "ghim
# digest sha256 thay vi tag :latest troi" da ap dung cho 6 image Docker khac tu 22/08/2026) +
# kiem tra SHA256 sau khi tai (phat hien hong/bi doi noi dung giua duong, khong chi tin ma HTTP
# 200 la du).
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /workspace/models \
    && curl -fL -o /workspace/models/face_detection_yunet.onnx "https://media.githubusercontent.com/media/opencv/opencv_zoo/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/face_detection_yunet/face_detection_yunet_2023mar.onnx" \
    && curl -fL -o /workspace/models/arcface_resnet100.onnx "https://media.githubusercontent.com/media/onnx/models/c5cae0f1942c8d7727372c7b1f6b485aa39e4421/validated/vision/body_analysis/arcface/model/arcfaceresnet100-8.onnx" \
    && echo "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4  /workspace/models/face_detection_yunet.onnx" | sha256sum -c - \
    && echo "f3a6bc281e72f88862f5748b53be3d76b3b48f8f1ab1f4a537941bdc4e1b01da  /workspace/models/arcface_resnet100.onnx" | sha256sum -c -

FROM python:3.12-slim AS runner
WORKDIR /workspace
ENV PYTHONUNBUFFERED=1 \
    PATH=/home/appuser/.local/bin:$PATH \
    PYTHONPATH=/workspace

# libglib2.0-0/libgl1 - phu thuoc runtime toi thieu cua opencv-python-headless tren Debian slim
# (khong co man hinh/GUI nao duoc dung - CHI de doc buffer anh/chay suy luan model).
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 1000 appuser
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local
COPY --from=builder --chown=appuser:appuser /workspace/models ./models
COPY --chown=appuser:appuser apps/ml-service/app ./app

USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
