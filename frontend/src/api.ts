/** UI-facing types. The backend's shapes are mapped into these in analyze() / tailor() below. */
export interface Matched {
  skill: string;
  how: "keyword" | "semantic";
  similarity: number;
  evidence: string;
}

export interface Report {
  selected: boolean;
  score: number;      // 0-100
  threshold: number;  // 0-100
  matched: Matched[];
  missing: string[];
  experience: { have: number; need: number | null; ok: boolean };
}

export interface AnalyzeResponse {
  thread_id: string;   // the backend's session_id
  status: "needs_confirmation" | "rejected";
  report: Report;
}

export interface Job { title: string; company: string; dates: string; bullets: string[] }
export interface Project { name: string; bullets: string[] }

/** Same shape as the backend's FinalResume, so it can be sent straight back to build the PDF. */
export interface TailoredResume {
  name: string;
  contact: string[];
  summary: string;
  skills: string[];
  experience: Job[];
  projects: Project[];
  education: string[];
  other: string[];
}

export interface TailorResponse {
  thread_id: string;
  attempts: number;
  verified: boolean;          // false = some lines could not be fully fact-checked
  removed_skills: string[];   // skills dropped because they are not on the resume
  flagged_lines: string[];    // lines with numbers that are not in the resume
  resume: TailoredResume;
}

export interface Limits {
  max_upload_mb: number;
  max_pdf_pages: number;
  min_jd_chars: number;
  max_jd_chars: number;
  analyses_per_hour: number;
  analyses_per_day: number;
}

/** Error with the HTTP status so the UI can treat "you hit a limit" differently from "something broke". */
export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) {
    super(message);
  }
  get isLimit() { return this.status === 429; }
}

const NETWORK = "Can't reach the server. Check your connection and try again.";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(NETWORK, 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : `Something went wrong (${res.status}). Please try again.`;
    const ra = Number(res.headers.get("retry-after"));
    throw new ApiError(detail, res.status, Number.isFinite(ra) && ra > 0 ? ra : undefined);
  }
  return res.json();
}

interface RawSkill { jd_skill: string; best_resume_skill: string | null; similarity: number; matched: boolean }
interface RawAnalyze {
  session_id: string;
  result: {
    overall_score: number; experience_score: number; resume_years: number; required_years: number;
    pass_threshold: number; passed: boolean; matched_skills: RawSkill[]; missing_skills: RawSkill[];
  };
}

export async function analyze(file: File, jd: string): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("resume", file);
  form.append("jd_text", jd);
  const raw = await request<RawAnalyze>("/api/analyze", { method: "POST", body: form });
  const r = raw.result;
  return {
    thread_id: raw.session_id,
    status: r.passed ? "needs_confirmation" : "rejected",
    report: {
      selected: r.passed,
      score: Math.round(r.overall_score * 100),
      threshold: Math.round(r.pass_threshold * 100),
      matched: r.matched_skills.map((m) => ({
        skill: m.jd_skill,
        how: m.similarity >= 0.999 ? "keyword" : "semantic",
        similarity: m.similarity,
        evidence: m.best_resume_skill ? `Matched with "${m.best_resume_skill}" on your resume` : "Found on your resume",
      })),
      missing: r.missing_skills.map((m) => m.jd_skill),
      experience: { have: r.resume_years, need: r.required_years > 0 ? r.required_years : null, ok: r.experience_score >= 1 },
    },
  };
}

interface RawTailor {
  attempts: number;
  report: {
    passed: boolean; removed_skills: string[]; flagged_lines: string[];
    cleaned_resume: TailoredResume;
  };
}

export async function tailor(sessionId: string, skills: string[]): Promise<TailorResponse> {
  const raw = await request<RawTailor>("/api/tailor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, confirmed_skills: skills }),
  });
  return {
    thread_id: sessionId,
    attempts: raw.attempts,
    verified: raw.report.passed,
    removed_skills: raw.report.removed_skills,
    flagged_lines: raw.report.flagged_lines,
    resume: raw.report.cleaned_resume,
  };
}

/** Ask the server to draw the resume as a PDF (no AI call, so no tokens). */
export async function resumePdf(resume: TailoredResume): Promise<{ blob: Blob; filename: string }> {
  let res: Response;
  try {
    res = await fetch("/api/resume-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resume) });
  } catch {
    throw new ApiError(NETWORK, 0);
  }
  if (!res.ok) throw new ApiError(`Could not create the PDF (${res.status}). Please try again.`, res.status);
  const filename = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "Tailored_Resume.pdf";
  return { blob: await res.blob(), filename };
}

export const getLimits = () => request<Limits>("/api/limits");
