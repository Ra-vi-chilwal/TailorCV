"""One place that turns exceptions into friendly HTTP responses. Services raise; this file answers."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core import messages
from app.core.config import settings
from app.llm import LLMBusyError, LLMConfigError, LLMError
from app.pdf_utils import PDFExtractionError

logger = logging.getLogger(__name__)


class AppError(Exception):
    """A problem the user can understand and fix. `detail` is safe to show as-is."""

    def __init__(self, status_code: int, detail: str, headers: dict[str, str] | None = None):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.headers = headers


def _json(status: int, detail: str, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail}, headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return _json(exc.status_code, exc.detail, exc.headers)

    @app.exception_handler(PDFExtractionError)
    async def _pdf(request: Request, exc: PDFExtractionError):
        return _json(400, str(exc))

    @app.exception_handler(LLMBusyError)
    async def _llm_busy(request: Request, exc: LLMBusyError):
        logger.warning("LLM rate limit hit: %s", exc)
        return _json(429, messages.AI_BUSY, {"Retry-After": "60"})

    @app.exception_handler(LLMConfigError)
    async def _llm_config(request: Request, exc: LLMConfigError):
        logger.error("LLM configuration problem: %s", exc)
        return _json(503, messages.AI_KEY_MISSING)

    @app.exception_handler(LLMError)
    async def _llm(request: Request, exc: LLMError):
        logger.error("LLM failure: %s", exc)            # full details go to OUR logs...
        detail = f"{messages.AI_FAILED} [debug: {exc}]" if settings.debug_errors else messages.AI_FAILED
        return _json(502, detail)                        # ...users get a simple message (devs can opt in to more)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        return _json(422, "Invalid request. Please check your file and text and try again.")

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        logger.exception("Unhandled error: %s", exc)    # never leak internals to the user
        detail = f"{messages.SERVER_ERROR} [debug: {type(exc).__name__}: {exc}]" if settings.debug_errors else messages.SERVER_ERROR
        return _json(500, detail)
