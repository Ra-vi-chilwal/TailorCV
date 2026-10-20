from app.core import messages
from app.core.config import settings
from app.guardrails import find_invented_numbers
from tests.conftest import JD_TEXT, make_pdf, post_analyze


# ---------- happy path ----------

def test_analyze_then_tailor(client, pdf):
    r = post_analyze(client, pdf)
    assert r.status_code == 200, r.text
    body = r.json()
    res = body["result"]
    assert 0 <= res["overall_score"] <= 1 and "passed" in res
    missing = {m["jd_skill"] for m in res["missing_skills"]}
    assert {"Kubernetes", "AWS"} <= missing

    t = client.post("/api/tailor", json={"session_id": body["session_id"], "confirmed_skills": ["Kubernetes"]})
    assert t.status_code == 200, t.text
    skills = t.json()["report"]["cleaned_resume"]["skills"]
    assert "Kubernetes" in skills               # confirmed, so allowed


def test_unconfirmed_skill_is_stripped(client, pdf):
    sid = post_analyze(client, pdf).json()["session_id"]
    t = client.post("/api/tailor", json={"session_id": sid, "confirmed_skills": []})
    rep = t.json()["report"]
    assert "Kubernetes" not in rep["cleaned_resume"]["skills"]
    assert "Kubernetes" in rep["removed_skills"]


def test_invented_numbers_flagged():
    assert find_invented_numbers(["Grew revenue 300%"], "Built APIs for 50 clients") == ["Grew revenue 300%"]
    assert find_invented_numbers(["Served 50 clients"], "Built APIs for 50 clients") == []


# ---------- input validation (friendly messages, no quota used) ----------

def test_rejects_non_pdf(client):
    r = post_analyze(client, b"hello world, not a pdf at all " * 10, name="x.txt", ctype="text/plain")
    assert r.status_code == 415 and r.json()["detail"] == messages.NOT_PDF


def test_rejects_fake_pdf(client):
    r = post_analyze(client, b"this is not really a pdf" * 20)
    assert r.status_code == 400 and r.json()["detail"] == messages.BAD_PDF


def test_rejects_oversize(client):
    r = post_analyze(client, b"%PDF-" + b"0" * (settings.max_upload_mb * 1024 * 1024 + 10))
    assert r.status_code == 413


def test_rejects_too_many_pages(client):
    r = post_analyze(client, make_pdf("Python developer with lots of experience in many tools", pages=settings.max_pdf_pages + 1))
    assert r.status_code == 400 and "pages" in r.json()["detail"]


def test_rejects_short_and_long_jd(client, pdf):
    assert post_analyze(client, pdf, jd="too short").status_code == 422
    assert post_analyze(client, pdf, jd="x" * (settings.max_jd_chars + 1)).status_code == 422


def test_bad_session_id_rejected(client):
    assert client.post("/api/tailor", json={"session_id": "nope", "confirmed_skills": []}).status_code == 422
    r = client.post("/api/tailor", json={"session_id": "a" * 32, "confirmed_skills": []})
    assert r.status_code == 404 and r.json()["detail"] == messages.SESSION_GONE


def test_too_many_confirmed_skills_rejected(client, pdf):
    sid = post_analyze(client, pdf).json()["session_id"]
    r = client.post("/api/tailor", json={"session_id": sid, "confirmed_skills": [f"s{i}" for i in range(31)]})
    assert r.status_code == 422


# ---------- abuse protection ----------

def test_per_ip_hourly_limit(client, pdf):
    for _ in range(settings.ip_analyze_per_hour):
        assert post_analyze(client, pdf).status_code == 200
    r = post_analyze(client, pdf)
    assert r.status_code == 429
    assert "hourly limit" in r.json()["detail"]
    assert int(r.headers["retry-after"]) > 0


def test_global_daily_cap(client, pdf, monkeypatch):
    monkeypatch.setattr(settings, "daily_analyze_cap", 2)
    monkeypatch.setattr(settings, "ip_analyze_per_hour", 99)
    monkeypatch.setattr(settings, "ip_analyze_per_day", 99)
    assert post_analyze(client, pdf).status_code == 200
    assert post_analyze(client, pdf).status_code == 200
    r = post_analyze(client, pdf)
    assert r.status_code == 429 and "capacity for all users" in r.json()["detail"]


def test_invalid_requests_do_not_use_quota(client, pdf):
    for _ in range(settings.ip_analyze_per_hour + 3):
        post_analyze(client, pdf, jd="too short")          # all rejected before the limiter
    assert post_analyze(client, pdf).status_code == 200


def test_tailor_cap_per_session(client, pdf, monkeypatch):
    monkeypatch.setattr(settings, "ip_tailor_per_hour", 99)
    monkeypatch.setattr(settings, "ip_tailor_per_day", 99)
    sid = post_analyze(client, pdf).json()["session_id"]
    for _ in range(settings.max_tailors_per_session):
        assert client.post("/api/tailor", json={"session_id": sid, "confirmed_skills": []}).status_code == 200
    r = client.post("/api/tailor", json={"session_id": sid, "confirmed_skills": []})
    assert r.status_code == 429


def test_provider_rate_limit_becomes_friendly_429(client, pdf, monkeypatch):
    from app import graph
    from app.llm import LLMBusyError

    def boom(text):
        raise LLMBusyError("groq 429")
    monkeypatch.setattr(graph, "extract_jd", boom)
    r = post_analyze(client, pdf)
    assert r.status_code == 429 and r.json()["detail"] == messages.AI_BUSY


def test_unexpected_error_hides_details(client, pdf, monkeypatch):
    from app import graph

    def boom(text):
        raise ValueError("secret internal detail")
    monkeypatch.setattr(graph, "extract_resume", boom)
    r = post_analyze(client, pdf)
    assert r.status_code == 500 and "secret" not in r.text


def test_health_and_limits(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/limits").json()["max_upload_mb"] == settings.max_upload_mb


def test_full_resume_has_contact_and_checked_companies():
    from app.guardrails import check_tailored_resume
    from app.schemas import ExperienceEntry, TailoredResume
    original = "Asha Rao asha@example.com +91 98765 43210 linkedin.com/in/asha\nAcme 2021-2022 built APIs"
    t = TailoredResume(
        name="Asha Rao", summary="Dev.", skills=["Python"],
        experience=[ExperienceEntry(title="Dev", company="Acme", dates="2021-2022", bullets=["Built APIs"]),
                    ExperienceEntry(title="Lead", company="Google", dates="2025", bullets=[])])
    rep = check_tailored_resume(t, original, ["Python"], [])
    c = rep.cleaned_resume.contact
    assert "asha@example.com" in c and any("98765" in x for x in c) and any("linkedin.com" in x for x in c)
    assert any("Google" in line for line in rep.flagged_lines)        # invented company is caught
    assert not any("Acme" in line for line in rep.flagged_lines)      # real one is fine
    assert not rep.passed


def test_resume_pdf_endpoint(client):
    body = {"name": "Asha Rao", "summary": "Dev & <b>builder</b>.", "skills": ["Python"], "contact": ["a@b.co"],
            "experience": [{"title": "Dev", "company": "Acme", "dates": "2021-2022", "bullets": ["Built APIs"]}],
            "education": ["BSc"]}
    r = client.post("/api/resume-pdf", json=body)
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF-")
