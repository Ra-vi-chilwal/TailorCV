"""Free-tier abuse protection: per-caller and whole-app limits, checked before any LLM call is made."""
import hashlib
import logging
import time

from fastapi import Request

from app.core import messages
from app.core.config import settings
from app.core.errors import AppError
from app.db import hit

logger = logging.getLogger(__name__)

HOUR, DAY = 3600, 86_400


def client_id(request: Request) -> str:
    """A short anonymous fingerprint of the caller's IP (we never store the raw address)."""
    ip = request.client.host if request.client else "unknown"
    if settings.trust_proxy:
        # Behind a proxy the real client is the LAST entry the proxy appended; earlier ones can be forged.
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            ip = fwd.split(",")[-1].strip() or ip
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


def _reject(template: str, window: int) -> AppError:
    wait = window - int(time.time() % window)        # seconds until this window resets
    return AppError(429, template.format(wait=messages.human_wait(wait)), {"Retry-After": str(wait)})


def enforce(who: str, kind: str) -> None:
    """Raise AppError(429) if this caller (or the whole app) is over its limits for `kind`.

    Order matters: per-caller checks first, the global cap last, so a blocked caller
    never burns the shared daily budget.
    """
    per_hour = getattr(settings, f"ip_{kind}_per_hour")
    per_day = getattr(settings, f"ip_{kind}_per_day")
    global_cap = getattr(settings, f"daily_{kind}_cap")

    if hit(f"ip:{who}:{kind}:h", HOUR) > per_hour:
        raise _reject(messages.LIMIT_HOUR, HOUR)
    if hit(f"ip:{who}:{kind}:d", DAY) > per_day:
        raise _reject(messages.LIMIT_DAY, DAY)
    if hit(f"all:{kind}:d", DAY) > global_cap:
        logger.warning("Global daily cap reached for %s", kind)
        raise _reject(messages.LIMIT_GLOBAL, DAY)
