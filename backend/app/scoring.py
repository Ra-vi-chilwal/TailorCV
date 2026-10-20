from functools import lru_cache

import numpy as np
from fastembed import TextEmbedding

from app.core.config import settings
from app.schemas import MatchResult, SkillMatch


@lru_cache(maxsize=1)
def get_embedder() -> TextEmbedding:
    """Load the embedding model once and reuse it."""
    return TextEmbedding(model_name=settings.embed_model)


def clean_skills(skills: list[str]) -> list[str]:
    """Trim spaces, drop blanks, remove duplicates (ignoring case), keep order."""
    seen = set()
    result = []
    for skill in skills:
        s = skill.strip()
        if s and s.lower() not in seen:
            seen.add(s.lower())
            result.append(s)
    return result


# Common abbreviations / spellings that mean the same thing. Embeddings alone can't be trusted for
# these (e.g. "k8s" vs "Kubernetes" scores only 0.67), so we treat them as exact matches.
ALIASES = {
    "k8s": "kubernetes", "postgres": "postgresql", "psql": "postgresql", "js": "javascript", "ts": "typescript",
    "golang": "go", "node": "node.js", "nodejs": "node.js", "react.js": "react", "reactjs": "react",
    "vue.js": "vue", "vuejs": "vue", "amazon web services": "aws", "gcp": "google cloud", "mongo": "mongodb",
    "ci_cd": "ci/cd", "ci-cd": "ci/cd", "cicd": "ci/cd", "ml": "machine learning", "rest": "rest api",
    "rest apis": "rest api", "restful api": "rest api", "restful apis": "rest api", "scikit-learn": "sklearn",
}


def normalize(skill: str) -> str:
    s = skill.strip().lower()
    return ALIASES.get(s, s)


def sim_table(a: list[str], b: list[str]) -> np.ndarray:
    """Similarity of every item in `a` to every item in `b` (rows = a). Same normalised name = 1.0."""
    table = embed(a) @ embed(b).T
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            if normalize(x) == normalize(y):
                table[i, j] = 1.0
    return table


def embed(texts: list[str]) -> np.ndarray:
    """Turn a list of texts into a table of vectors (one row per text), each of length 1."""
    vectors = np.array(list(get_embedder().embed(texts)))
    lengths = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / lengths


def match_skills(jd_skills: list[str], resume_skills: list[str]) -> list[SkillMatch]:
    """Compare every JD skill to every resume skill and keep the best match for each."""
    if not jd_skills:
        return []

    if not resume_skills:
        return [SkillMatch(jd_skill=s, similarity=0.0, matched=False) for s in jd_skills]

    # Similarity table: rows = JD skills, columns = resume skills
    table = sim_table(jd_skills, resume_skills)

    results = []
    for i, jd_skill in enumerate(jd_skills):
        best_j = int(np.argmax(table[i]))                      # column of the highest score
        score = float(np.clip(table[i, best_j], 0.0, 1.0))      # keep it between 0 and 1
        results.append(
            SkillMatch(
                jd_skill=jd_skill,
                best_resume_skill=resume_skills[best_j],
                similarity=round(score, 3),
                matched=score >= settings.semantic_threshold,
            )
        )
    return results


def experience_score(resume_years: float, required_years: float) -> float:
    """Full marks if you meet the requirement; partial credit if you're short."""
    if required_years <= 0:
        return 1.0
    return min(resume_years / required_years, 1.0)


def score_resume(
    jd_skills: list[str],
    resume_skills: list[str],
    resume_years: float,
    required_years: float,
) -> MatchResult:
    """The main function other files will call."""
    jd_skills = clean_skills(jd_skills)
    resume_skills = clean_skills(resume_skills)

    matches = match_skills(jd_skills, resume_skills)
    matched = [m for m in matches if m.matched]
    missing = [m for m in matches if not m.matched]

    skill = len(matched) / len(matches) if matches else 1.0
    exp = experience_score(resume_years, required_years)
    overall = settings.skill_weight * skill + settings.experience_weight * exp

    return MatchResult(
        resume_years=resume_years,
        required_years=required_years,
        pass_threshold=settings.pass_threshold,
        passed=overall >= settings.pass_threshold,
        overall_score=round(overall, 3),
        skill_score=round(skill, 3),
        experience_score=round(exp, 3),
        matched_skills=matched,
        missing_skills=missing,
    )