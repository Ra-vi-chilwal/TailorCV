from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.db import get_or_compute
from app.guardrails import check_tailored_resume, validate_confirmed_skills
from app.llm import extract_jd, extract_resume, tailor_resume
from app.schemas import (
    ExtractedJD,
    ExtractedResume,
    GuardrailReport,
    MatchResult,
    TailoredResume,
)
from app.scoring import score_resume

MAX_TAILOR_ATTEMPTS = 2   # first try + 1 retry


# =====================================================================
# Graph 1: Analyze
# =====================================================================

class AnalyzeState(TypedDict, total=False):
    resume_text: str
    jd_text: str
    resume: ExtractedResume
    jd: ExtractedJD
    result: MatchResult


def extract_resume_node(state: AnalyzeState) -> dict:
    resume = get_or_compute("resume", state["resume_text"], ExtractedResume, extract_resume)
    return {"resume": resume}


def extract_jd_node(state: AnalyzeState) -> dict:
    jd = get_or_compute("jd", state["jd_text"], ExtractedJD, extract_jd)
    return {"jd": jd}


def score_node(state: AnalyzeState) -> dict:
    resume, jd = state["resume"], state["jd"]
    result = score_resume(
        jd_skills=jd.skills,
        resume_skills=resume.skills,
        resume_years=resume.years_of_experience,
        required_years=jd.required_years,
    )
    return {"result": result}


def build_analyze_graph():
    g = StateGraph(AnalyzeState)
    g.add_node("extract_resume", extract_resume_node)
    g.add_node("extract_jd", extract_jd_node)
    g.add_node("score", score_node)

    g.add_edge(START, "extract_resume")                 # both start together...
    g.add_edge(START, "extract_jd")
    g.add_edge(["extract_resume", "extract_jd"], "score")  # ...score waits for BOTH
    g.add_edge("score", END)
    return g.compile()


analyze_graph = build_analyze_graph()


# =====================================================================
# Graph 2: Tailor with guardrail retry loop
# =====================================================================

class TailorState(TypedDict, total=False):
    resume_text: str
    jd_text: str
    resume_skills: list[str]
    confirmed_skills: list[str]
    attempts: int
    feedback: str
    tailored: TailoredResume
    report: GuardrailReport


def tailor_node(state: TailorState) -> dict:
    tailored = tailor_resume(
        resume_text=state["resume_text"],
        jd_text=state["jd_text"],
        confirmed_skills=state["confirmed_skills"],
        feedback=state.get("feedback", ""),
    )
    return {"tailored": tailored, "attempts": state.get("attempts", 0) + 1}


def build_feedback(report: GuardrailReport) -> str:
    """Turn guardrail problems into clear instructions for the LLM's next attempt."""
    parts = []
    if report.removed_skills:
        parts.append(
            "Do NOT list these skills, they are not in the resume: "
            + ", ".join(report.removed_skills)
        )
    if report.flagged_lines:
        parts.append(
            "These lines contain numbers that are not in the original resume. "
            "Rewrite them without inventing numbers:\n- "
            + "\n- ".join(report.flagged_lines)
        )
    return "\n".join(parts)


def guardrail_node(state: TailorState) -> dict:
    report = check_tailored_resume(
        tailored=state["tailored"],
        original_text=state["resume_text"],
        resume_skills=state["resume_skills"],
        confirmed_skills=state["confirmed_skills"],
    )
    return {"report": report, "feedback": build_feedback(report)}


def route_after_guardrail(state: TailorState) -> str:
    """The decision diamond: finish or try again?"""
    if state["report"].passed:
        return "done"
    if state["attempts"] >= MAX_TAILOR_ATTEMPTS:
        return "done"          # give up retrying; the report will carry the warnings
    return "retry"


def build_tailor_graph():
    g = StateGraph(TailorState)
    g.add_node("tailor", tailor_node)
    g.add_node("guardrail", guardrail_node)

    g.add_edge(START, "tailor")
    g.add_edge("tailor", "guardrail")
    g.add_conditional_edges(
        "guardrail",
        route_after_guardrail,
        {"retry": "tailor", "done": END},
    )
    return g.compile()


tailor_graph = build_tailor_graph()


# =====================================================================
# Simple entry points for main.py
# =====================================================================

def run_analysis(resume_text: str, jd_text: str) -> AnalyzeState:
    return analyze_graph.invoke({"resume_text": resume_text, "jd_text": jd_text})


def run_tailoring(
    resume_text: str,
    jd_text: str,
    resume_skills: list[str],
    missing_skills: list[str],
    confirmed_skills: list[str],
) -> tuple[GuardrailReport, int]:
    confirmed = validate_confirmed_skills(confirmed_skills, missing_skills)
    final = tailor_graph.invoke({
        "resume_text": resume_text,
        "jd_text": jd_text,
        "resume_skills": resume_skills,
        "confirmed_skills": confirmed,
        "attempts": 0,
        "feedback": "",
    })
    return final["report"], final["attempts"]