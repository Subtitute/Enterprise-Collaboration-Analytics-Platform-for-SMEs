# 24/09/2026: service Python dau tien cua du an (Layer 3 Anomaly Detection) - mirror TINH THAN
# multi-stage cua Dockerfile cac service Node (builder cai/build, runner gon nhe, user khong phai
# root, chi EXPOSE+CMD o cuoi), khong copy y het duoc buoc npm-workspace vi day la he sinh thai
# khac (pip, khong co "workspace" dung chung).
FROM python:3.12-slim AS builder
WORKDIR /workspace
COPY apps/ml-service/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim AS runner
WORKDIR /workspace
ENV PYTHONUNBUFFERED=1 \
    PATH=/home/appuser/.local/bin:$PATH \
    PYTHONPATH=/workspace

RUN useradd --create-home --uid 1000 appuser
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local
COPY --chown=appuser:appuser apps/ml-service/app ./app

USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
