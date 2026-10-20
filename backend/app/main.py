"""App assembly only: middleware, error handlers, routes, and serving the built frontend."""
import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core import messages
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.db import get_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the DB connection and the embedding model in the background so the first user isn't slow.
    def warm():
        try:
            get_db()
            from app.scoring import get_embedder
            get_embedder()
            logger.info("Warm-up finished.")
        except Exception as e:                    # never block startup on this
            logger.warning("Warm-up failed: %s", e)

    threading.Thread(target=warm, daemon=True).start()
    if not settings.groq_api_key:
        logger.error("GROQ_API_KEY is not set: /api/analyze will fail until it is added to .env")
    yield


app = FastAPI(
    title="Resume Analyzer & Tailor",
    description="Score a resume against a job description and tailor it honestly.",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Reject oversized request bodies before they are read into memory (upload limit + room for the form).
MAX_BODY = (settings.max_upload_mb + 1) * 1024 * 1024


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    declared = request.headers.get("content-length")
    if request.method == "POST" and declared and declared.isdigit() and int(declared) > MAX_BODY:
        return JSONResponse(status_code=413, content={"detail": messages.TOO_BIG.format(mb=settings.max_upload_mb)})
    return await call_next(request)


register_error_handlers(app)
app.include_router(router)

# Serve the built React app from the same server (production). In dev, Vite serves it instead.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    logger.info("frontend/dist not found: serving the API only (use the Vite dev server for the UI).")
