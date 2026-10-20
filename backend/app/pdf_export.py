import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import HRFlowable, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

from app.schemas import FinalResume


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text), style)       # escape(): reportlab reads <b>, & etc. as markup


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
                      bottomMargin=16 * mm, title=r.name or "Tailored resume").build(story)
    return buf.getvalue()
