import io
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

from app.schemas import FinalResume

# The built-in PDF fonts only know Windows-1252 characters. Anything else is drawn as a black square.
# So swap look-alike characters for plain ones first, then drop what still cannot be drawn.
_LOOKALIKES = str.maketrans({
    "‐": "-", "‑": "-", "‒": "-", "−": "-",                                  # special hyphens / minus
    " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", "​": "",     # odd spaces
    "●": "-", "▪": "-", "→": "->", "✓": "",                                  # bullets, arrow, tick
})


def _safe(text: str) -> str:
    text = text.translate(_LOOKALIKES)
    return text.encode("cp1252", errors="ignore").decode("cp1252")


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(_safe(text)), style)   # escape(): reportlab reads <b>, & etc. as markup


def pdf_filename(r: FinalResume) -> str:
    """'Ravindar_Chilwal_Resume.pdf'. Falls back to the newest job title, then a plain name."""
    base = r.name or (r.experience[0].title if r.experience else "")
    base = re.sub(r"[^A-Za-z0-9]+", "_", _safe(base)).strip("_")[:60]
    return f"{base}_Resume.pdf" if base else "Tailored_Resume.pdf"


def build_resume_pdf(r: FinalResume) -> bytes:
    """Draw the checked resume as a one-column, ATS-friendly PDF (plain text, no images)."""
    base = getSampleStyleSheet()["Normal"]
    body = ParagraphStyle("body", parent=base, fontName="Helvetica", fontSize=10, leading=13)
    name = ParagraphStyle("name", parent=body, fontName="Helvetica-Bold", fontSize=20, leading=24)
    contact = ParagraphStyle("contact", parent=body, textColor=colors.HexColor("#555555"))
    head = ParagraphStyle("head", parent=body, fontName="Helvetica-Bold", fontSize=11, spaceBefore=10, spaceAfter=2)
    job = ParagraphStyle("job", parent=body, fontName="Helvetica-Bold")

    def section(title: str):
        return [_p(title.upper(), head), HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#999999")), Spacer(1, 3)]

    def bullets(items: list[str]):
        items = [b for b in items if b.strip()]
        if not items:
            return []
        return [ListFlowable([ListItem(_p(b, body), leftIndent=12) for b in items], bulletType="bullet", start="•", leftIndent=12)]

    story = []
    if r.name:
        story.append(_p(r.name, name))
    if r.contact:
        story.append(_p("  |  ".join(r.contact), contact))
    if r.summary:
        story += section("Summary") + [_p(r.summary, body)]
    if r.skills:
        story += section("Skills") + [_p(", ".join(r.skills), body)]
    if r.experience:
        story += section("Experience")
        for j in r.experience:
            line = " - ".join(x for x in (j.title, j.company) if x)
            story.append(_p(f"{line}    {j.dates}".strip(), job))
            story += bullets(j.bullets) + [Spacer(1, 4)]
    if r.projects:
        story += section("Projects")
        for p in r.projects:
            story.append(_p(p.name, job))
            story += bullets(p.bullets) + [Spacer(1, 4)]
    if r.education:
        story += section("Education") + [_p(e, body) for e in r.education]
    if r.other:
        story += section("Other") + bullets(r.other)

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                      bottomMargin=16 * mm, title=_safe(r.name) or "Tailored resume").build(story)
    return buf.getvalue()
