import { useEffect, useRef, useState } from "react";
import { motion, useScroll } from "motion/react";
import {
  ArrowRight, BadgeCheck, Ban, Braces, CalendarClock, CheckCircle2, ClipboardCheck, Database, Dices, Download, Eye, FileCheck2,
  FileSearch, FileText, Gauge, Handshake, Moon, Network, Plus, Repeat, ScanText, ShieldCheck, Sparkles, Sun, Target, TriangleAlert,
  Wand2, Zap, Atom, Server, ArrowUpRight, Bot, type LucideIcon,
} from "lucide-react";
import ScoreRing from "./ScoreRing";
import { profile } from "../profile";
import { PortfolioPill } from "./Portfolio";
import { CountUp, GlowCard, Reveal, Tilt } from "./ui";

import { go, navigate, useRoute } from "../router";

/* ---------------------------------------------------------------- Nav */
function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (document.documentElement.dataset.theme as "dark" | "light") || "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch { /* storage blocked */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))] as const;
}

export function Nav() {
  const [theme, toggle] = useTheme();
  const route = useRoute();
  return (
    <motion.nav className="nav" initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
      <div className="navin">
        <div className="brand" onClick={() => navigate("home")}>
          <div className="logo"><FileCheck2 size={17} /></div> Resume Builder
        </div>
        <div className="navlinks">
          <a onClick={go("problem")}>Problem</a>
          <a onClick={go("how")}>How it works</a>
          <a onClick={go("why")}>Why us</a>
          <a onClick={go("faq")}>FAQ</a>
          <a onClick={go("about")}>About</a>
          <span className="navsep" />
          <a className={route === "history" ? "cur" : ""} onClick={() => navigate("history")}>History</a>
          <a className={route === "dashboard" ? "cur" : ""} onClick={() => navigate("dashboard")}>Dashboard</a>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="iconbtn" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a className="btn ghost sm navpf" href={profile.url} target="_blank" rel="noopener noreferrer"><Bot size={15} /> Portfolio <ArrowUpRight size={14} /></a>
          <button className="btn sm" onClick={go("tool")}>Try it free <ArrowRight size={15} /></button>
        </div>
      </div>
    </motion.nav>
  );
}

/* ---------------------------------------------------------------- Hero */
function HeroMockup() {
  const hit = ["Python", "FastAPI", "Docker", "PostgreSQL", "REST APIs"];
  const miss = ["Kubernetes", "AWS"];
  return (
    <Tilt>
      <div className="mockwrap">
        <div className="mock" aria-hidden>
          <div className="mock-bar"><i /><i /><i /><span>match-report.json</span></div>
          <div className="mock-body">
            <div className="mock-top">
              <ScoreRing score={78} threshold={60} size={118} />
              <div>
                <span className="badge good"><BadgeCheck size={13} /> Shortlisted</span>
                <p>5 of 7 skills matched</p>
                <small>Example report · 4.2 yrs experience</small>
              </div>
            </div>
            <div className="mock-chips">
              {hit.map((k, i) => (
                <motion.span key={k} className="chip ok" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9 + i * 0.09, type: "spring", stiffness: 300, damping: 18 }}>
                  <CheckCircle2 size={13} /> {k}
                </motion.span>
              ))}
              {miss.map((k, i) => (
                <motion.span key={k} className="chip no" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.4 + i * 0.09, type: "spring", stiffness: 300, damping: 18 }}>
                  <Ban size={13} /> {k}
                </motion.span>
              ))}
            </div>
            <div className="mock-line"><FileText size={14} /> “Built REST APIs with FastAPI serving 50 clients”</div>
          </div>
        </div>
        <motion.div className="float f1" animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
          <ShieldCheck size={17} /> Facts verified
        </motion.div>
        <motion.div className="float f2" animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
          <Zap size={17} /> 3 AI calls only
        </motion.div>
      </div>
    </Tilt>
  );
}

const stack: [string, LucideIcon][] = [
  ["FastAPI", Server], ["LangGraph", Network], ["LangChain", Braces], ["MongoDB", Database], ["React", Atom], ["Embeddings", Sparkles],
];

export function Hero() {
  const item = (i: number) => ({
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
  });
  return (
    <header className="hero">
      <div className="wrap">
        <div className="herogrid">
          <div>
            <motion.div {...item(0)}>
              <span className="pill"><span className="dotlive" /> Honest by design <b>ATS match</b></span>
              <PortfolioPill />
            </motion.div>
            <motion.h1 {...item(1)}>
              Know if your resume gets <span className="grad">shortlisted</span> before you apply.
            </motion.h1>
            <motion.p className="lead" {...item(2)}>
              Upload your resume, paste the job description, and see exactly which skills you match, which you miss, and whether you
              clear the 60% screen. Then get a tailored PDF that never invents a single fact.
            </motion.p>
            <motion.div className="cta" {...item(3)}>
              <button className="btn lg" onClick={go("tool")}>Check my resume <ArrowRight size={18} /></button>
              <button className="btn ghost lg" onClick={go("how")}>See how it works</button>
            </motion.div>
            <motion.ul className="trust" {...item(4)}>
              <li><CheckCircle2 size={16} /> Every match shows its evidence</li>
              <li><CheckCircle2 size={16} /> Facts never change</li>
              <li><CheckCircle2 size={16} /> You approve every skill</li>
            </motion.ul>
          </div>
          <motion.div initial={{ opacity: 0, y: 50, rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 1.1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <HeroMockup />
          </motion.div>
        </div>

        <div className="marquee">
          <small>Built on a production-grade stack</small>
          <div className="track">
            {[...stack, ...stack, ...stack, ...stack].map(([n, I], i) => (
              <span key={i}><I size={20} /> {n}</span>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------- Problem */
const problems: { Icon: LucideIcon; tone: string; title: string; text: string }[] = [
  { Icon: Ban, tone: "red", title: "Rejected before a human reads it", text: "Most companies filter applications by keyword match first. If the job's required skills are not in your resume, nobody ever sees it." },
  { Icon: Dices, tone: "amber", title: "You are guessing what to change", text: "Applying to 50 jobs with one generic resume means you never learn which skills were actually missing for each role." },
  { Icon: TriangleAlert, tone: "violet", title: "AI rewriters make things up", text: "Many tools happily add skills, metrics and titles you do not have. That backfires the moment an interviewer asks about them." },
];

export function Problem() {
  return (
    <section id="problem" className="section">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">The problem</span>
          <h2>Good candidates get filtered out for <span className="grad">fixable</span> reasons.</h2>
          <p>Ten minutes of targeted edits is often all that stands between you and an interview.</p>
        </Reveal>
        <div className="cols3">
          {problems.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.1}>
              <GlowCard className="feat" style={{ height: "100%" }}>
                <div className={`ico ${p.tone}`}><p.Icon size={24} /></div>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </GlowCard>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="glass stats">
            <div className="stat"><b className="grad"><CountUp to={10} /></b><span>traceable steps, start to PDF</span></div>
            <div className="stat"><b><CountUp to={3} /></b><span>AI calls per analysis</span></div>
            <div className="stat"><b><CountUp to={60} suffix="%" /></b><span>keyword + meaning pass mark</span></div>
            <div className="stat"><b><CountUp to={0} /></b><span>invented facts, enforced in code</span></div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Pipeline */
const stepIcons: LucideIcon[] = [ClipboardCheck, ScanText, FileSearch, Gauge, CalendarClock, Target, Handshake, Wand2, ShieldCheck, Download];
const steps: [string, string, string][] = [
  ["Validate", "Checks it is a text-based PDF, under 2 MB and 3 pages, and that the JD has enough detail. Bad input is rejected instantly, at no cost.", "No AI"],
  ["Parse your resume", "AI turns the PDF into structured data: experience, education, skills, projects. Cached, so the same resume is never parsed twice.", "AI"],
  ["Read the job description", "AI extracts the concrete skills, tools and the minimum years of experience the role asks for.", "AI"],
  ["Score the skills", "Keyword match (60%) plus meaning match (40%) using local embeddings, so “Postgres” still counts as “PostgreSQL”. Every matched skill shows the resume line that proves it.", "No AI"],
  ["Check experience", "Your total years are calculated from your job dates, with overlapping jobs counted once, and compared to the requirement.", "No AI"],
  ["Pass or fail gate", "Score of 60% or more and enough experience: you are selected. Otherwise you get a clear report of the score, missing skills and experience gap.", "No AI"],
  ["You confirm skills", "You see the missing skills and tick only the ones you genuinely have. Nothing is added without your say-so.", "You"],
  ["Tailor the resume", "AI rewrites your summary, skills and bullets to match the JD's wording, using only your real experience plus the skills you confirmed.", "AI"],
  ["Fact guardrail", "Code checks that companies, titles, dates, degrees and numbers are unchanged. If not, it retries once, then restores the original facts.", "No AI"],
  ["Download", "A clean, single-column, ATS-friendly PDF is generated and saved, ready to submit.", "Result"],
];
const tagClass = (t: string) => (t === "AI" ? "ai" : t === "You" ? "you" : t === "Result" ? "res" : "");

export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  return (
    <section id="how" className="section">
      <div className="wrap pipeline">
        <Reveal className="shead">
          <span className="eyebrow">How it works</span>
          <h2>Ten steps. <span className="grad">Three</span> use AI.</h2>
          <p>Scoring, dates and the pass/fail gate are plain code, so the same input always gives the same result, and every step can be checked.</p>
          <div className="legend">
            <span className="tag2 ai">AI</span><span className="tag2">No AI</span><span className="tag2 you">You</span><span className="tag2 res">Result</span>
          </div>
        </Reveal>
        <ol className="timeline" ref={ref}>
          <motion.div className="tl-fill" style={{ scaleY: scrollYProgress }} />
          {steps.map(([title, text, tag], i) => {
            const I = stepIcons[i];
            return (
              <Reveal as="li" key={title} y={20}>
                <div className="dot"><I size={20} /><b>{i + 1}</b></div>
                <div>
                  <h3>{title} <span className={`tag2 ${tagClass(tag)}`}>{tag}</span></h3>
                  <p>{text}</p>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Why */
export function Why() {
  return (
    <section id="why" className="section">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">Why use it</span>
          <h2>Built to be <span className="grad">trusted</span>, not just impressive.</h2>
        </Reveal>
        <div className="bento">
          <Reveal className="b-lg">
            <GlowCard className="" style={{ height: "100%" }}>
              <div className="ico violet"><Eye size={24} /></div>
              <h3>Explained, not a black box</h3>
              <p>Each matched skill links to the exact line in your resume. Each missing one is listed by name.</p>
              <div className="demo-line">
                <mark>FastAPI</mark> ← “Built REST APIs with <mark>FastAPI</mark> serving 50 clients”<br />
                <mark>Postgres</mark> ≈ <mark>PostgreSQL</mark> <span style={{ opacity: 0.6 }}>(meaning match, 0.91)</span>
              </div>
            </GlowCard>
          </Reveal>
          <Reveal className="b-lg" delay={0.08}>
            <GlowCard style={{ height: "100%" }}>
              <div className="ico green"><ShieldCheck size={24} /></div>
              <h3>Honest tailoring</h3>
              <p>A guardrail blocks changed employers, dates, degrees, invented numbers and unconfirmed skills.</p>
              <div className="demo-line">
                Senior Engineer, Acme · 2021–2024 <mark>✓ unchanged</mark><br />
                Increased revenue by <s>300%</s> <span style={{ color: "var(--bad)" }}>✗ blocked, restored</span>
              </div>
            </GlowCard>
          </Reveal>
          {([
            [Gauge, "cyan", "See the score first", "Know your chances in seconds, before spending an hour on an application."],
            [Repeat, "pink", "Consistent results", "Scoring and dates are plain code. The same resume and JD give the same score every time."],
            [Zap, "amber", "Fast and cheap", "Resumes and JDs are cached by content hash, so repeats make no extra AI calls."],
          ] as [LucideIcon, string, string, string][]).map(([I, tone, t, d], i) => (
            <Reveal key={t} className="b-md" delay={0.05 * i}>
              <GlowCard style={{ height: "100%" }}>
                <div className={`ico ${tone}`}><I size={24} /></div>
                <h3>{t}</h3>
                <p>{d}</p>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- FAQ */
const faqs = [
  ["Does a score above 60% guarantee an interview?", "No. It estimates how well your resume matches the keywords in the JD. Real employers use different filters, so treat it as a strong signal, not a promise."],
  ["Will it lie on my resume?", "No. It only rewrites wording using what is already in your resume plus skills you explicitly tick. Facts are checked in code afterwards."],
  ["What if my score is below 60%?", "You get a report showing the score, missing skills and any experience gap, so you know what to build or learn before applying."],
  ["Is my resume stored?", "The parsed resume and results are saved to your own MongoDB database so repeats are fast. Nothing is shared elsewhere."],
  ["Which files work?", "Text-based PDFs up to 2 MB and 3 pages. Scanned image PDFs are rejected with a clear message."],
];

export function Faq() {
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">FAQ</span>
          <h2>Questions, answered.</h2>
        </Reveal>
        <div className="faq">
          {faqs.map(([q, a], i) => (
            <Reveal key={q} delay={i * 0.05}>
              <GlowCard as="details">
                <summary>{q} <Plus size={20} /></summary>
                <p>{a}</p>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Footer */
export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <Reveal>
          <div className="glass cta-card">
            <h2>Ready to see <span className="grad">your score?</span></h2>
            <p>Takes about 20 seconds. No sign-up.</p>
            <button className="btn lg" onClick={go("tool")}>Check my resume <ArrowRight size={18} /></button>
          </div>
        </Reveal>
        <div className="foot">
          <span>© {new Date().getFullYear()} Resume Builder</span>
          <a className="stack" href={profile.url} target="_blank" rel="noopener noreferrer">Built by {profile.name} ↗</a>
          <span className="stack">FastAPI · LangGraph · LangChain · MongoDB · React</span>
        </div>
      </div>
    </footer>
  );
}
