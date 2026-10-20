from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated

# A skill name typed by a user: short, no essays
SkillName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


# ---------- Scoring results (filled by scoring.py) ----------

class SkillMatch(BaseModel):
    """How one JD skill compared against the resume."""
    jd_skill: str                                # skill asked for in the JD, e.g. "Docker"
    best_resume_skill: str | None = None         # closest skill found in resume (None = nothing close)
    similarity: float = Field(ge=0.0, le=1.0)    # 0 = unrelated, 1 = identical meaning
    matched: bool                                # True if similarity >= threshold


class MatchResult(BaseModel):
    """The full analysis we send back to the user."""
    overall_score: float = Field(ge=0.0, le=1.0)
    skill_score: float = Field(ge=0.0, le=1.0)
    experience_score: float = Field(ge=0.0, le=1.0)
    resume_years: float = 0.0
    required_years: float = 0.0
    pass_threshold: float = 0.6
    passed: bool = False
    matched_skills: list[SkillMatch] = Field(default_factory=list)
    missing_skills: list[SkillMatch] = Field(default_factory=list)


# ---------- Step 2: user confirms skills ----------

class ConfirmSkillsRequest(BaseModel):
    """User tells us which 'missing' skills they actually have."""
    session_id: str = Field(pattern=r"^[0-9a-f]{32}$")     # which analysis this belongs to
    confirmed_skills: list[SkillName] = Field(default_factory=list, max_length=30)


class ExtractedResume(BaseModel):
    """Facts pulled out of a resume."""
    skills: list[str] = Field(
        description="Technical and professional skills explicitly mentioned in the resume, "
                    "e.g. 'Python', 'React', 'MongoDB'. Short names only."
    )
    years_of_experience: float = Field(
        ge=0,
        description="Total years of professional work experience. 0 if unclear.",
    )


class ExtractedJD(BaseModel):
    """Requirements pulled out of a job description."""
    skills: list[str] = Field(
        description="Skills the job asks for, both required and preferred. Short names only."
    )
    required_years: float = Field(
        ge=0,
        description="Minimum years of experience required. 0 if not stated.",
    )


# ---------- Step 3: tailored resume (filled by llm.py) ----------

class TailoredResume(BaseModel):
    summary: str
    skills: list[str]
    experience_bullets: list[str]


class GuardrailReport(BaseModel):
    """What the fact-checker found in the tailored resume."""
    passed: bool
    removed_skills: list[str] = Field(default_factory=list)   # skills not backed by the resume
    flagged_lines: list[str] = Field(default_factory=list)    # lines containing invented numbers
    cleaned_resume: TailoredResume


# ---------- API responses ----------

class AnalyzeResponse(BaseModel):
    session_id: str
    result: MatchResult


class TailorResponse(BaseModel):
    attempts: int
    report: GuardrailReport
