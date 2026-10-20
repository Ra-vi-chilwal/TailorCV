import { useEffect, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle, ArrowLeft, Clock, Copy, Info, ArrowRight, Check, CheckCircle2, CircleDashed, Download, FileText, Loader2, PartyPopper, RotateCcw,
  ShieldAlert, ShieldCheck, Sparkles, Target, UploadCloud, Wand2, XCircle,
} from "lucide-react";
import { analyze, ApiError, getLimits, resumePdf, tailor, type AnalyzeResponse, type Limits, type TailorResponse } from "../api";
import ScoreRing from "./ScoreRing";
import { GlowCard, Reveal } from "./ui";
import { markTailored, saveAnalysis } from "../history";

type Step = "input" | "report" | "done";
const STEPS: { id: Step; label: string }[] = [
  { id: "input", label: "Upload" },
  { id: "report", label: "Report" },
  { id: "done", label: "Download" },
];

const SAMPLE_JD = `We are hiring a Backend Engineer with 3+ years of experience building production services. You will design and ship REST APIs in Python using FastAPI, model data in PostgreSQL, and containerise services with Docker. Experience with Kubernetes and AWS is a strong plus. You will work with CI/CD pipelines, write automated tests, review code, and collaborate closely with product and frontend engineers to deliver reliable, well-monitored features to customers.`;

const PHASES: Record<string, string[]> = {
  analyze: ["Validating your PDF", "Parsing resume into structure", "Extracting job requirements", "Scoring keywords + meaning", "Checking years of experience"],
  tailor: ["Applying your confirmed skills", "Rewriting to match the JD", "Running the fact guardrail", "Rendering your PDF"],
};

const ease = [0.22, 1, 0.36, 1] as const;
const page = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.25 } },
};

function Busy({ kind }: { kind: "analyze" | "tailor" }) {
  const phases = PHASES[kind];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(v + 1, phases.length - 1)), kind === "analyze" ? 2600 : 3200);
    return () => clearInterval(t);
  }, [kind, phases.length]);
  return (
    <motion.div className="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="busy-in">
        <div className="orb"><i /><i /><i /></div>
        <h4>{kind === "analyze" ? "Analysing your match" : "Tailoring your resume"}</h4>
        <ul className="bsteps">
          {phases.map((p, n) => (
            <li key={p} className={n < i ? "fin" : n === i ? "act" : ""}>
              {n < i ? <CheckCircle2 size={18} /> : n === i ? <Loader2 size={18} /> : <CircleDashed size={18} />}
              {p}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function Stepper({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="stepper" aria-label="Progress">
      {STEPS.map((s, n) => (
        <div key={s.id} style={{ display: "contents" }}>
          <div className={`s ${n === idx ? "on" : n < idx ? "done" : ""}`}>
            <i>{n < idx ? <Check size={14} strokeWidth={3} /> : n + 1}</i>
            <em style={{ fontStyle: "normal" }}>{s.label}</em>
          </div>
          {n < STEPS.length - 1 && <div className="bar"><span style={{ transform: `scaleX(${n < idx ? 1 : 0})` }} /></div>}
        </div>
      ))}
    </div>
  );
}

export default function Tool() {
  const [step, setStep] = useState<Step>("input");
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState<"analyze" | "tailor" | null>(null);
  const [error, setError] = useState<{ msg: string; limit: boolean } | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { getLimits().then(setLimits).catch(() => {}); }, []);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [final, setFinal] = useState<TailorResponse | null>(null);

  const words = jd.trim() ? jd.trim().split(/\s+/).length : 0;
  const minJd = limits?.min_jd_chars ?? 100;
  const jdLongEnough = jd.trim().length >= minJd;
  const maxMb = limits?.max_upload_mb ?? 2;
  const maxJd = limits?.max_jd_chars ?? 6000;
  const fileTooBig = !!file && file.size > maxMb * 1024 * 1024;
  const notPdf = !!file && !/\.pdf$/i.test(file.name) && file.type !== "application/pdf";
  const jdTooLong = jd.length > maxJd;
  const canSubmit = !!file && !fileTooBig && !notPdf && jdLongEnough && !jdTooLong && !busy;

  async function run<T>(kind: "analyze" | "tailor", fn: () => Promise<T>, then: (v: T) => void) {
    setBusy(kind);
    setError(null);
    try {
      then(await fn());
    } catch (e) {
      setError({ msg: e instanceof Error ? e.message : "Something went wrong. Please try again.", limit: e instanceof ApiError && e.isLimit });
    } finally {
      setBusy(null);
    }
  }

  const onAnalyze = () =>
    run("analyze", () => analyze(file!, jd), (r) => {
      saveAnalysis(r.thread_id, file!.name, jd, r.report);
      setResult(r);
      setTicked(new Set());
      setStep("report");
    });

  const onTailor = () =>
    run("tailor", () => tailor(result!.thread_id, [...ticked]), (r) => {
      markTailored(r.thread_id);
      setFinal(r);
      setStep("done");
    });

  const reset = () => {
    setStep("input");
    setResult(null);
    setFinal(null);
    setError(null);
  };

  const toggle = (s: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const asText = (f: TailorResponse) => {
    const r = f.resume;
    const out: string[] = [];
    if (r.name) out.push(r.name);
    if (r.contact.length) out.push(r.contact.join(" | "));
    out.push("", "SUMMARY", r.summary, "", "SKILLS", r.skills.join(", "));
    if (r.experience.length) {
      out.push("", "EXPERIENCE");
      r.experience.forEach((j) => out.push([j.title, j.company].filter(Boolean).join(" - ") + (j.dates ? `  (${j.dates})` : ""), ...j.bullets.map((b) => "- " + b), ""));
    }
    if (r.projects.length) {
      out.push("PROJECTS");
      r.projects.forEach((p) => out.push(p.name, ...p.bullets.map((b) => "- " + b), ""));
    }
    if (r.education.length) out.push("EDUCATION", ...r.education, "");
    if (r.other.length) out.push("OTHER", ...r.other.map((o) => "- " + o), "");
    return out.join("\n");
  };
  const copyText = async (f: TailorResponse) => {
    try { await navigator.clipboard.writeText(asText(f)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState("");
  const savePdf = async (f: TailorResponse) => {
    setPdfBusy(true); setPdfErr("");
    try {
      const url = URL.createObjectURL(await resumePdf(f.resume));
      Object.assign(document.createElement("a"), { href: url, download: "tailored_resume.pdf" }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfErr(e instanceof ApiError ? e.message : "Could not create the PDF. Please try again.");
    } finally {
      setPdfBusy(false);
    }
  };

  const report = result?.report;

  return (
    <section id="tool" className="tool">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">Try it now</span>
          <h2>Get your <span className="grad">match report</span>.</h2>
          <p>Your file goes straight to the analyser. Nothing is added to your resume without your approval.</p>
        </Reveal>

        <Reveal>
          <div className="glass toolshell">
            <div className="toolbar">
              <h3><FileText size={16} /> resume-analyser</h3>
              <Stepper step={step} />
            </div>

            <div className="toolbody">
              <AnimatePresence>{busy && <Busy kind={busy} />}</AnimatePresence>

              <AnimatePresence>
                {error && (
                  <motion.div className={`alert ${error.limit ? "soft" : ""}`} role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    {error.limit ? <Clock size={18} /> : <AlertCircle size={18} />} {error.msg}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {step === "input" && (
                  <motion.div key="input" {...page}>
                    <div className="grid2">
                      <div>
                        <div className="label"><div><span className="n">1</span>Your resume</div><span>PDF · ≤ {maxMb} MB · ≤ {limits?.max_pdf_pages ?? 3} pages</span></div>
                        <label
                          className={`drop ${file ? "has" : ""} ${over ? "over" : ""}`}
                          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                          onDragLeave={() => setOver(false)}
                          onDrop={onDrop}
                        >
                          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                          <div className="upico">{file ? <FileText size={28} /> : <UploadCloud size={28} />}</div>
                          {file ? (
                            <>
                              <strong>{file.name}</strong>
                              <span>{(file.size / 1024).toFixed(0)} KB</span>
                              <span className="swap">click or drop to replace</span>
                            </>
                          ) : (
                            <>
                              <strong>Drop your resume here</strong>
                              <span>or click to browse · text-based PDFs only</span>
                            </>
                          )}
                        </label>
                      </div>
                      <div>
                        <div className="label">
                          <div><span className="n">2</span>Job description</div>
                          <button className="sample" onClick={() => setJd(SAMPLE_JD)} type="button">use sample</button>
                        </div>
                        <div className="ta">
                          <textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job description here…" />
                        </div>
                        <div className={`meter ${jdLongEnough ? "ok" : ""}`}><span style={{ width: `${Math.min(100, (jd.trim().length / minJd) * 100)}%` }} /></div>
                        <div className={`count ${jdLongEnough ? "ok" : ""}`}>
                          <span>{words} words</span><span>{jdLongEnough ? "looks good" : jd.trim() ? "a little more detail needed" : `min ${minJd} characters`}</span>
                        </div>
                      </div>
                    </div>
                    {(fileTooBig || notPdf || jdTooLong) && (
                      <div className="alert" role="alert" style={{ marginTop: 18, marginBottom: 0 }}>
                        <AlertCircle size={18} />
                        {notPdf ? "Please upload a PDF file (.pdf)." : fileTooBig ? `That file is larger than ${maxMb} MB. Please upload a smaller PDF.` : `The job description is too long (max ${maxJd.toLocaleString()} characters). Please paste only the role and requirements.`}
                      </div>
                    )}
                    <div className="freenote">
                      <Info size={16} />
                      <span>
                        <b>Free demo.</b> To keep it free for everyone, each person can run {limits?.analyses_per_hour ?? 5} analyses per hour
                        ({limits?.analyses_per_day ?? 15} per day). Your resume is kept for 24 hours so you can tailor it, then deleted.
                      </span>
                    </div>
                    <div className="submitrow">
                      <small><ShieldCheck size={16} /> Facts on your resume are never altered.</small>
                      <button className="btn lg" disabled={!canSubmit} onClick={onAnalyze}>
                        <Sparkles size={18} /> Check my chances
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "report" && report && (
                  <motion.div key="report" {...page}>
                    <div className={`report-hero glass ${report.selected ? "pass" : "fail"}`}>
                      <ScoreRing score={report.score} threshold={report.threshold} />
                      <div>
                        <span className={`badge ${report.selected ? "good" : "bad"}`}>
                          {report.selected ? <><CheckCircle2 size={14} /> Likely to be shortlisted</> : <><XCircle size={14} /> Likely to be rejected</>}
                        </span>
                        <h2>{report.selected ? "Your resume passes the keyword screen" : "Your resume is too weak for this job"}</h2>
                        <p>
                          {report.matched.length} of {report.matched.length + report.missing.length} required skills found. You need {report.threshold}% to clear the screen.
                        </p>
                        <div className="kpis">
                          <div className="kpi"><Target size={16} /> Skills <b>{report.matched.length}/{report.matched.length + report.missing.length}</b></div>
                          <div className={`kpi ${report.experience.ok ? "ok" : "no"}`}>
                            {report.experience.ok ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
                            Experience <b>{report.experience.have} yrs</b>
                            {report.experience.need != null && <>of <b>{report.experience.need}</b> needed</>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rgrid">
                      <GlowCard className="panel">
                        <h3>Matched skills <em>{report.matched.length}</em></h3>
                        <p>Each match shows the line in your resume that proves it.</p>
                        <motion.ul className="list" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05, delayChildren: 0.3 } } }}>
                          {report.matched.map((m) => (
                            <motion.li key={m.skill} className="item" variants={{ h: { opacity: 0, x: -14 }, s: { opacity: 1, x: 0 } }}>
                              <div className="row">
                                <b><CheckCircle2 size={16} /> {m.skill}</b>
                                <span className="tag">{m.how}</span>
                              </div>
                              <q>{m.evidence}</q>
                              <div className="sim"><motion.span initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.round(m.similarity * 100))}%` }} transition={{ duration: 1, delay: 0.5, ease }} /></div>
                            </motion.li>
                          ))}
                          {report.matched.length === 0 && <li className="empty"><XCircle size={22} />No skills matched.</li>}
                        </motion.ul>
                      </GlowCard>

                      <GlowCard className="panel">
                        <h3>Missing skills <em>{report.missing.length}</em></h3>
                        <p>
                          {report.selected && report.missing.length > 0
                            ? "Tick only the ones you genuinely have. They will be added to your resume."
                            : report.missing.length > 0 ? "Build or learn these before applying to this role." : "Nothing missing."}
                        </p>
                        <motion.ul className="list" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05, delayChildren: 0.4 } } }}>
                          {report.missing.length === 0 && <li className="empty"><PartyPopper size={26} />You cover every required skill.</li>}
                          {report.missing.map((s) => (
                            <motion.li key={s} variants={{ h: { opacity: 0, x: 14 }, s: { opacity: 1, x: 0 } }}>
                              {report.selected ? (
                                <button type="button" className={`pick ${ticked.has(s) ? "on" : ""}`} onClick={() => toggle(s)} aria-pressed={ticked.has(s)}>
                                  <span>{s}</span>
                                  <span className="box"><Check size={14} strokeWidth={3.5} /></span>
                                </button>
                              ) : (
                                <div className="pick static"><span>{s}</span><XCircle size={18} /></div>
                              )}
                            </motion.li>
                          ))}
                        </motion.ul>
                      </GlowCard>
                    </div>

                    <div className="actions">
                      <button className="btn ghost" onClick={reset}><ArrowLeft size={16} /> Start over</button>
                      {report.selected && (
                        <button className="btn lg" disabled={!!busy} onClick={onTailor}>
                          <Wand2 size={18} /> Tailor my resume{ticked.size > 0 && ` (+${ticked.size})`} <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {step === "done" && final && (
                  <motion.div key="done" {...page}>
                    <div className="donehead">
                      <h2><span className="ico green"><CheckCircle2 size={22} /></span> Your tailored resume</h2>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn ghost" onClick={() => copyText(final)}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy text</>}</button>
                        <button className="btn" disabled={pdfBusy} onClick={() => savePdf(final)}><Download size={16} /> {pdfBusy ? "Creating PDF..." : "Download PDF"}</button>
                      </div>
                    </div>
                    {(!final.verified || final.removed_skills.length > 0) && (
                      <div className="alert soft" role="status">
                        <Info size={18} />
                        <span>
                          {final.removed_skills.length > 0 && <>We removed {final.removed_skills.join(", ")} because {final.removed_skills.length > 1 ? "they are" : "it is"} not on your resume or confirmed list. </>}
                          {final.flagged_lines.length > 0 && <>Please double-check the highlighted lines: they contain numbers we could not find in your original resume.</>}
                        </span>
                      </div>
                    )}
                    {pdfErr && <div className="alert" role="alert"><AlertCircle size={18} /><span>{pdfErr}</span></div>}
                    <div className="paper">
                      {final.resume.name && <h3>{final.resume.name}</h3>}
                      {final.resume.contact.length > 0 && <div className="contact">{final.resume.contact.join("  |  ")}</div>}
                      <h4>Summary</h4>
                      <p>{final.resume.summary}</p>
                      <h4>Skills</h4>
                      <div className="chips">{final.resume.skills.map((s) => <span key={s}>{s}</span>)}</div>
                      {final.resume.experience.length > 0 && <h4>Experience</h4>}
                      {final.resume.experience.map((j, i) => (
                        <div className="job" key={i}>
                          <b>{[j.title, j.company].filter(Boolean).join(" - ")}</b> <small>{j.dates}</small>
                          <ul>{j.bullets.map((b, k) => <li key={k} className={final.flagged_lines.includes(b) ? "flag" : ""}>{b}</li>)}</ul>
                        </div>
                      ))}
                      {final.resume.projects.length > 0 && <h4>Projects</h4>}
                      {final.resume.projects.map((p, i) => (
                        <div className="job" key={i}>
                          <b>{p.name}</b>
                          <ul>{p.bullets.map((b, k) => <li key={k} className={final.flagged_lines.includes(b) ? "flag" : ""}>{b}</li>)}</ul>
                        </div>
                      ))}
                      {final.resume.education.length > 0 && <><h4>Education</h4>{final.resume.education.map((e, i) => <p key={i} style={{ margin: "2px 0" }}>{e}</p>)}</>}
                      {final.resume.other.length > 0 && <><h4>Other</h4><ul>{final.resume.other.map((o, i) => <li key={i}>{o}</li>)}</ul></>}
                    </div>
                    <div className="actions">
                      <button className="btn ghost" onClick={reset}><RotateCcw size={16} /> Try another job</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
