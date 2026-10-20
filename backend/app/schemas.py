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

class ExperienceEntry(BaseModel):
    title: str = Field(default="", description="Job title, copied exactly from the resume.")
    company: str = Field(default="", description="Company name, copied exactly from the resume.")
    dates: str = Field(default="", description="Date range, copied exactly from the resume, e.g. 'Jan 2021 - Present'.")
    bullets: list[str] = Field(default_factory=list, description="Achievements for this job, rewritten to fit the job description.")


class ProjectEntry(BaseModel):
    name: str = Field(default="", description="Project name, copied exactly from the resume.")
    bullets: list[str] = Field(default_factory=list)


class TailoredResume(BaseModel):
    """What the LLM writes. Contact details are NOT here: we copy them from the PDF ourselves."""
    name: str = Field(default="", description="Candidate's full name exactly as written in the resume. Empty if there is none.")
    summary: str
    skills: list[str]
    experience: list[ExperienceEntry] = Field(default_factory=list, description="Every job in the resume, newest first.")
    projects: list[ProjectEntry] = Field(default_factory=list, description="Every project in the resume.")
    education: list[str] = Field(default_factory=list, description="Each degree/school line, copied exactly from the resume.")
    other: list[str] = Field(default_factory=list, description="Certifications, awards or other lines, copied exactly.")

    def bullet_lines(self) -> list[str]:
        """Every free-text line the LLM wrote (used by the fact checker)."""
        lines = [self.summary]
        for job in self.experience:
            lines += job.bullets
        for proj in self.projects:
            lines += proj.bullets
        return lines


class FinalResume(TailoredResume):
    """The checked resume we show and turn into a PDF."""
    contact: list[str] = Field(default_factory=list, max_length=10)


class GuardrailReport(BaseModel):
    """What the fact-checker found in the tailored resume."""
    passed: bool
    removed_skills: list[str] = Field(default_factory=list)   # skills not backed by the resume
    flagged_lines: list[str] = Field(default_factory=list)    # lines containing invented numbers / companies
    cleaned_resume: FinalResume


# ---------- API responses ----------

class AnalyzeResponse(BaseModel):
    session_id: str
    result: MatchResult


class TailorResponse(BaseModel):
    attempts: int
    report: GuardrailReport
