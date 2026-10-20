import io
import zlib

import numpy as np
import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app import db, graph, scoring
from app.core.config import settings
from app.schemas import ExperienceEntry, ExtractedJD, ExtractedResume, TailoredResume


class FakeEmbedder:
    """Deterministic stand-in for fastembed: hashes character trigrams into a vector."""

    def embed(self, texts):
        for t in texts:
            v = np.zeros(256)
            t = f"  {t.lower()}  "
            for i in range(len(t) - 2):
                v[zlib.crc32(t[i:i + 3].encode()) % 256] += 1
            yield v

def make_pdf(text: str, pages: int = 1) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    for _ in range(pages):
        y = 800
        for line in text.split("\n"):
            c.drawString(40, y, line)
            y -= 16
        c.showPage()
    c.save()
    return buf.getvalue()


RESUME_TEXT = (
    "Asha Rao - Backend Developer\n"
    "Skills: Python, FastAPI, PostgreSQL, Docker, Git\n"
    "Acme 2021-2022: Built REST APIs with FastAPI serving 50 clients\n"
    "Beta 2023-now: Containerised services with Docker and wrote tests"
)
JD_TEXT = ("We need a backend engineer with 3 years of experience in Python, FastAPI, Postgres, Docker, "
           "Kubernetes and AWS. You will build and operate REST APIs, review code and ship features weekly. ") * 2


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    """No MongoDB, no real LLM, no model download, fresh counters for every test."""
    monkeypatch.setattr(settings, "mongodb_uri", "")
    monkeypatch.setattr(settings, "debug_errors", False)   # tests check what real users see
    db.get_db.cache_clear()
    db._mem_sessions.clear()
    db._mem_usage.clear()
    monkeypatch.setattr(scoring, "get_embedder", lambda: FakeEmbedder())

    monkeypatch.setattr(graph, "extract_resume", lambda text: ExtractedResume(
        skills=["Python", "FastAPI", "PostgreSQL", "Docker", "Git"], years_of_experience=2.0))
    monkeypatch.setattr(graph, "extract_jd", lambda text: ExtractedJD(
        skills=["Python", "FastAPI", "Postgres", "Docker", "Kubernetes", "AWS"], required_years=3.0))
    monkeypatch.setattr(graph, "tailor_resume", lambda **kw: TailoredResume(
        summary="Backend developer building Python APIs.",
        skills=["Python", "FastAPI", "Docker", "Kubernetes"],
        name="Asha Rao",
        experience=[ExperienceEntry(title="Backend Developer", company="Acme", dates="2021-2022",
                                    bullets=["Built REST APIs with FastAPI serving 50 clients"])],
        education=["BSc Computer Science"]))


@pytest.fixture
def client():
    return TestClient(__import__("app.main", fromlist=["app"]).app, raise_server_exceptions=False)


@pytest.fixture
def pdf():
    return make_pdf(RESUME_TEXT)


def post_analyze(client, pdf_bytes, jd=JD_TEXT, name="resume.pdf", ctype="application/pdf"):
    return client.post("/api/analyze", files={"resume": (name, pdf_bytes, ctype)}, data={"jd_text": jd})
