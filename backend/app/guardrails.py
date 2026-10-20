import re

from app.core.config import settings
from app.schemas import FinalResume, GuardrailReport, TailoredResume
from app.scoring import clean_skills, sim_table

# Finds numbers like 5, 40, 3.5 (after we remove commas, so "1,000" becomes "1000")
NUMBER_PATTERN = re.compile(r"\d+(?:\.\d+)?")


def find_unsupported_skills(claimed: list[str], allowed: list[str]) -> list[str]:
    """Return skills in `claimed` that don't closely match anything in `allowed`."""
    claimed = clean_skills(claimed)
    allowed = clean_skills(allowed)
    if not claimed:
        return []
    if not allowed:
        return claimed

    best_scores = sim_table(claimed, allowed).max(axis=1)         # best match for each claimed skill

    return [
        skill
        for skill, score in zip(claimed, best_scores)
        if score < settings.guardrail_threshold
    ]


def extract_numbers(text: str) -> set[str]:
    return set(NUMBER_PATTERN.findall(text.replace(",", "")))


def find_invented_numbers(lines: list[str], original_text: str) -> list[str]:
    """Return lines that contain a number not found anywhere in the original resume."""
    original_numbers = extract_numbers(original_text)
    flagged = []
    for line in lines:
        if any(n not in original_numbers for n in extract_numbers(line)):
            flagged.append(line)
    return flagged


EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE = re.compile(r"(?<!\w)\+?\d[\d\s().-]{8,16}\d(?!\w)")
LINK = re.compile(r"(?:https?://|www\.)\S+|(?:linkedin\.com|github\.com)/\S+", re.I)


def extract_contact(original_text: str) -> list[str]:
    """Email, phone and links copied straight from the resume text. No LLM, so nothing can be invented."""
    found: list[str] = []
    for pattern in (EMAIL, PHONE, LINK):
        for m in pattern.findall(original_text):
            m = m.strip().rstrip(".,;)")
            if m and m not in found:
                found.append(m)
    return found[:6]


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def find_unknown_names(names: list[str], original_text: str) -> list[str]:
    """Company / school / project names that never appear in the original resume."""
    original = _norm(original_text)
    return [n for n in names if n.strip() and _norm(n) not in original]


def validate_confirmed_skills(confirmed: list[str], missing: list[str]) -> list[str]:
    """Keep only confirmed skills that were actually in the 'missing' list we showed."""
    missing_lower = {m.lower() for m in missing}
    return [s for s in clean_skills(confirmed) if s.lower() in missing_lower]


def check_tailored_resume(
    tailored: TailoredResume,
    original_text: str,
    resume_skills: list[str],
    confirmed_skills: list[str],
) -> GuardrailReport:
    """Run all checks on the LLM's output and return a report plus a cleaned resume."""
    allowed = resume_skills + confirmed_skills
    invented = find_unsupported_skills(tailored.skills, allowed)
    invented_lower = {s.lower() for s in invented}

    kept_skills = [s for s in tailored.skills if s.strip().lower() not in invented_lower]
    dates = [j.dates for j in tailored.experience]
    flagged = find_invented_numbers(
        [*tailored.bullet_lines(), *dates, *tailored.education], original_text
    )
    names = [j.company for j in tailored.experience] + [p.name for p in tailored.projects]
    flagged += [f"Not found in your resume: {n}" for n in find_unknown_names(names, original_text)]

    cleaned = FinalResume(
        **tailored.model_dump(exclude={"skills"}),
        skills=kept_skills,
        contact=extract_contact(original_text),
    )

    return GuardrailReport(
        passed=not invented and not flagged,
        removed_skills=invented,
        flagged_lines=flagged,
        cleaned_resume=cleaned,
    )