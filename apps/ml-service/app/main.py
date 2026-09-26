"""24/09/2026: entrypoint FastAPI cua ml-service - luc khoi dong: bootstrap schema (idempotent,
mirror schema-bootstrap.ts) roi khoi chay Kafka consumer nhu 1 background task cua chinh event
loop uvicorn (khong can tien trinh rieng) - luc tat: bao consumer dung lai gon gang."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import bootstrap_schema
from app.kafka_consumer import run_consumer_with_backoff
from app.routes import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("ml-service.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap_schema()
    stop_event = asyncio.Event()
    consumer_task = asyncio.create_task(run_consumer_with_backoff(stop_event))
    logger.info("ml-service da khoi dong - Kafka consumer chay nen.")
    try:
        yield
    finally:
        stop_event.set()
        consumer_task.cancel()
        try:
            await consumer_task
        except asyncio.CancelledError:
            pass
        logger.info("ml-service da dung Kafka consumer, tat gon gang.")


app = FastAPI(title="ML Service", lifespan=lifespan)
app.include_router(router)
