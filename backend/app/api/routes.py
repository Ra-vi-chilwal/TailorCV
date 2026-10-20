"""HTTP layer only: read the request, call a service, return the response."""
from fastapi import APIRouter, File, Form, Request, Response, UploadFile

from app.core.config import settings
from app.core.limits import client_id
from app.pdf_export import build_resume_pdf
from app.schemas import AnalyzeResponse, ConfirmSkillsRequest, FinalResume, TailorResponse
from app.services import resume_service

# All API routes live under /api, so the React app (served from "/") and the API share one address.
router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/limits")
def limits():
    """Lets the UI show the same numbers the server enforces."""
    return {
        "max_upload_mb": settings.max_upload_mb,
        "max_pdf_pages": settings.max_pdf_pages,
        "min_jd_chars": settings.min_jd_chars,
        "max_jd_chars": settings.max_jd_chars,
        "analyses_per_hour": settings.ip_analyze_per_hour,
        "analyses_per_day": settings.ip_analyze_per_day,
        "pass_threshold": settings.pass_threshold,
    }


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    request: Request,
    resume: UploadFile = File(..., description="Resume as a PDF"),
    jd_text: str = Form(...),
):
    data = resume.file.read(settings.max_upload_mb * 1024 * 1024 + 1)   # read at most 1 byte over the limit
    return resume_service.analyze_resume(
        data=data,
        filename=resume.filename or "",
        content_type=resume.content_type or "",
        jd_text=jd_text,
        client=client_id(request),
    )


@router.post("/tailor", response_model=TailorResponse)
def tailor(request: Request, body: ConfirmSkillsRequest):
    return resume_service.tailor_resume_for_session(body, client=client_id(request))


@router.post("/resume-pdf")
def resume_pdf(body: FinalResume):
    """Turn the tailored resume the UI already has into a PDF. No LLM call, so it costs no tokens."""
    return Response(
        content=build_resume_pdf(body),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="tailored_resume.pdf"'},
    )
