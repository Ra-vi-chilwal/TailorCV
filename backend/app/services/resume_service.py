"""The real work behind the endpoints (the "controller" layer). No FastAPI objects in here, so it is
easy to test and the routes stay thin."""
import threading
from contextlib import contextmanager

from app.core import messages
from app.core.config import settings
from app.core.errors import AppError
from app.core.limits import enforce
from app.db import bump_session_tailors, create_session, get_session
from app.graph import run_analysis, run_tailoring
from app.pdf_utils import extract_text_from_pdf
from app.schemas import AnalyzeResponse, ConfirmSkillsRequest, TailorResponse

PDF_TYPES = {"application/pdf", "application/x-pdf", "application/octet-stream", ""}

# At most this many LLM jobs run at once. Bursts are what trip per-minute token limits on free tiers.
_llm_slots = threading.BoundedSemaphore(3)


@contextmanager
def llm_slot():
    if not _llm_slots.acquire(blocking=False):
        raise AppError(429, messages.AI_BUSY, {"Retry-After": "30"})
    try:
        yield
    finally:
        _llm_slots.release()


def analyze_resume(data: bytes, filename: str, content_type: str, jd_text: str, client: str) -> AnalyzeResponse:
    # 1. Cheap checks first: they cost us nothing and don't use up the caller's quota.
    if (content_type or "") not in PDF_TYPES and not (filename or "").lower().endswith(".pdf"):
        raise AppError(415, messages.NOT_PDF)

    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise AppError(413, messages.TOO_BIG.format(mb=settings.max_upload_mb))

    jd_text = jd_text.strip()
    if len(jd_text) < settings.min_jd_chars:
        raise AppError(422, messages.JD_SHORT.format(min=settings.min_jd_chars))
    if len(jd_text) > settings.max_jd_chars:
        raise AppError(422, messages.JD_LONG.format(max=settings.max_jd_chars))

    resume_text = extract_text_from_pdf(data)         # raises PDFExtractionError with a friendly message

    # 2. Only now spend quota: per-caller and whole-app limits.
    enforce(client, "analyze")

    # 3. Analysis graph (the LLM calls happen here)
    with llm_slot():
        state = run_analysis(resume_text, jd_text)
    result = state["result"]

    # 4. Remember this analysis for the tailor step
    session_id = create_session({
        "resume_text": resume_text,
        "jd_text": jd_text,
        "resume_skills": state["resume"].skills,
        "missing_skills": [m.jd_skill for m in result.missing_skills],
    })
    return AnalyzeResponse(session_id=session_id, result=result)


def tailor_resume_for_session(body: ConfirmSkillsRequest, client: str) -> TailorResponse:
    session = get_session(body.session_id)
    if session is None:
        raise AppError(404, messages.SESSION_GONE)
    if session.get("_tailors", 0) >= settings.max_tailors_per_session:
        raise AppError(429, messages.TAILOR_LIMIT_SESSION.format(n=settings.max_tailors_per_session))

    enforce(client, "tailor")

    with llm_slot():
        report, attempts = run_tailoring(
            resume_text=session["resume_text"],
            jd_text=session["jd_text"],
            resume_skills=session["resume_skills"],
            missing_skills=session["missing_skills"],
            confirmed_skills=body.confirmed_skills,
        )
    bump_session_tailors(body.session_id)
    return TailorResponse(attempts=attempts, report=report)
