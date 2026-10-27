"""24/09/2026: entrypoint FastAPI cua ml-service - luc khoi dong: bootstrap schema (idempotent,
mirror schema-bootstrap.ts) roi khoi chay Kafka consumer nhu 1 background task cua chinh event
loop uvicorn (khong can tien trinh rieng) - luc tat: bao consumer dung lai gon gang.

26/10/2026: them (1) nap san 2 model khuon mat truoc khi nhan request (GD 0 - tranh nap 2 lan model
261MB khi 2 request dau den dong thoi), (2) handler loi `{ detail, errorCode }` cua /ml/face/*,
(3) job hang gio huy ban anh cho xac nhan qua 30 ngay + xoa nhat ky qua 1 nam (Technical_Spec.md muc 27)."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app import face_store
from app.db import SessionLocal, bootstrap_schema
from app.errors import FaceError
from app.face import preload_models
from app.face_routes import router as face_router
from app.kafka_consumer import run_consumer_with_backoff
from app.routes import router
from app.storage import storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("ml-service.main")

_EXPIRY_INTERVAL_SECONDS = 3600


def expire_pending_once() -> int:
    session = SessionLocal()
    try:
        keys = face_store.expire_pending_and_prune(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
    storage.remove_quietly(keys)
    return len(keys)


async def _run_expiry_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            expired = await asyncio.to_thread(expire_pending_once)
            if expired:
                logger.info("Da huy %s anh nhan dien cho xac nhan qua han.", expired)
        except Exception as err:  # noqa: BLE001
            logger.error("Job huy anh cho xac nhan qua han loi: %s", err)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=_EXPIRY_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap_schema()
    await asyncio.to_thread(preload_models)
    stop_event = asyncio.Event()
    consumer_task = asyncio.create_task(run_consumer_with_backoff(stop_event))
    expiry_task = asyncio.create_task(_run_expiry_loop(stop_event))
    logger.info("ml-service da khoi dong - Kafka consumer + job anh cho xac nhan chay nen.")
    try:
        yield
    finally:
        stop_event.set()
        for task in (consumer_task, expiry_task):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        logger.info("ml-service da dung Kafka consumer, tat gon gang.")


app = FastAPI(title="ML Service", lifespan=lifespan)


@app.exception_handler(FaceError)
async def _face_error_handler(_request: Request, exc: FaceError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, "errorCode": exc.error_code})


app.include_router(router)
app.include_router(face_router)
