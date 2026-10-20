import re

from app.core.config import settings
from app.schemas import GuardrailReport, TailoredResume
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
    flagged = find_invented_numbers(
        [tailored.summary, *tailored.experience_bullets], original_text
    )

    cleaned = tailored.model_copy(update={"skills": kept_skills})

    return GuardrailReport(
        passed=not invented and not flagged,
        removed_skills=invented,
        flagged_lines=flagged,
        cleaned_resume=cleaned,
    )