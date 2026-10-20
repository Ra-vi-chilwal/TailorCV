import hashlib
import logging
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from pydantic import BaseModel
from pymongo import MongoClient
from pymongo.database import Database
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from app.core.config import settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 7 * 24 * 60 * 60      # keep cache entries for 7 days
SESSION_TTL_SECONDS = 24 * 60 * 60        # keep sessions for 1 day


@lru_cache(maxsize=1)
def get_db() -> Database | None:
    """Connect once. Return None if MongoDB isn't configured or reachable."""
    if not settings.mongodb_uri:
        logger.warning("MONGODB_URI not set - running without cache.")
        return None
    try:
        client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        db = client[settings.mongodb_db]
        # TTL indexes: MongoDB auto-deletes documents after the given seconds
        db.cache.create_index("created_at", expireAfterSeconds=CACHE_TTL_SECONDS)
        db.sessions.create_index("created_at", expireAfterSeconds=SESSION_TTL_SECONDS)
        db.usage.create_index("expires_at", expireAfterSeconds=0)
        return db
    except PyMongoError as e:
        logger.warning("MongoDB unavailable - running without cache: %s", e)
        return None


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Cache ----------

def make_key(kind: str, text: str) -> str:
    """A short, unique fingerprint for (kind + model + text)."""
    raw = f"{kind}|{settings.llm_model}|{text}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def cache_get(key: str) -> dict | None:
    db = get_db()
    if db is None:
        return None
    try:
        doc = db.cache.find_one({"_id": key})
        return doc["data"] if doc else None
    except PyMongoError as e:
        logger.warning("Cache read failed: %s", e)
        return None


def cache_set(key: str, data: dict) -> None:
    db = get_db()
    if db is None:
        return
    try:
        db.cache.replace_one(
            {"_id": key},
            {"_id": key, "data": data, "created_at": now_utc()},
            upsert=True,
        )
    except PyMongoError as e:
        logger.warning("Cache write failed: %s", e)


def get_or_compute(kind: str, text: str, schema: type[BaseModel], compute):
    """Return a cached result if we have one; otherwise run `compute(text)` and save it."""
    key = make_key(kind, text)
    cached = cache_get(key)
    if cached is not None:
        return schema.model_validate(cached)

    result = compute(text)
    cache_set(key, result.model_dump())
    return result


# ---------- Sessions ----------
# Stored in MongoDB when available, otherwise in this process's memory (lost on restart).

_mem_sessions: dict[str, tuple[float, dict]] = {}
_mem_lock = threading.Lock()


def _purge_memory() -> None:
    cutoff = time.time() - SESSION_TTL_SECONDS
    for k in [k for k, (t, _) in _mem_sessions.items() if t < cutoff]:
        del _mem_sessions[k]
    now = time.time()
    for k in [k for k, (_, exp) in _mem_usage.items() if exp < now]:
        del _mem_usage[k]


def create_session(data: dict) -> str:
    """Save data for a multi-step flow and return a new session id."""
    session_id = uuid.uuid4().hex
    db = get_db()
    if db is not None:
        try:
            db.sessions.insert_one({"_id": session_id, "data": data, "tailors": 0, "created_at": now_utc()})
            return session_id
        except PyMongoError as e:
            logger.warning("Session write failed, using memory: %s", e)
    with _mem_lock:
        _purge_memory()
        if len(_mem_sessions) > 2000:          # hard stop so memory can't be filled by spam
            raise RuntimeError("Too many active sessions.")
        _mem_sessions[session_id] = (time.time(), {**data, "_tailors": 0})
    return session_id


def get_session(session_id: str) -> dict | None:
    db = get_db()
    if db is not None:
        try:
            doc = db.sessions.find_one({"_id": session_id})
            if doc:
                return {**doc["data"], "_tailors": doc.get("tailors", 0)}
        except PyMongoError as e:
            logger.warning("Session read failed: %s", e)
    with _mem_lock:
        item = _mem_sessions.get(session_id)
        return dict(item[1]) if item else None


def bump_session_tailors(session_id: str) -> None:
    db = get_db()
    if db is not None:
        try:
            db.sessions.update_one({"_id": session_id}, {"$inc": {"tailors": 1}})
        except PyMongoError as e:
            logger.warning("Session counter failed: %s", e)
    with _mem_lock:
        if session_id in _mem_sessions:
            _mem_sessions[session_id][1]["_tailors"] += 1


# ---------- Usage counters (rate limits) ----------
# Fixed-window counters. `hit()` adds one and returns the new count for that window.

_mem_usage: dict[str, tuple[int, float]] = {}


def hit(key: str, window_seconds: int) -> int:
    """Count one use of `key` in the current fixed window and return how many uses that is."""
    bucket = int(time.time() // window_seconds)
    full_key = f"{key}:{bucket}"
    expires = datetime.now(timezone.utc) + timedelta(seconds=window_seconds * 2)
    db = get_db()
    if db is not None:
        try:
            doc = db.usage.find_one_and_update(
                {"_id": full_key},
                {"$inc": {"n": 1}, "$setOnInsert": {"expires_at": expires}},
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
            return int(doc["n"])
        except PyMongoError as e:
            logger.warning("Usage counter failed, using memory: %s", e)
    with _mem_lock:
        _purge_memory()
        n, exp = _mem_usage.get(full_key, (0, time.time() + window_seconds * 2))
        _mem_usage[full_key] = (n + 1, exp)
        return n + 1
