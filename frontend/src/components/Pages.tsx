import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight, BarChart3, CheckCircle2, ChevronDown, Clock, Download, FileText, FlaskConical, History as HistoryIcon, Search, Target,
  Trash2, TrendingUp, Trophy, XCircle,
} from "lucide-react";
import { clearHistory, loadDemo, removeEntry, useHistory, type HistoryEntry } from "../history";
import { navigate } from "../router";
import { CountUp, GlowCard, Reveal } from "./ui";

const ease = [0.22, 1, 0.36, 1] as const;
const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function PageHead({ icon, eyebrow, title, children }: { icon: ReactNode; eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="pagehead">
      <Reveal>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </Reveal>
      <div className="pagehead-r">{children}</div>
      <span className="pagehead-ico">{icon}</span>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <Reveal>
      <GlowCard className="bigempty">
        <div className="ico violet"><FlaskConical size={26} /></div>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="cta" style={{ justifyContent: "center", marginTop: 22 }}>
          <button className="btn" onClick={() => navigate("home")}>Analyse a resume <ArrowRight size={16} /></button>
          <button className="btn ghost" onClick={loadDemo}>Load demo data</button>
        </div>
      </GlowCard>
    </Reveal>
  );
}

/* ---------------------------------------------------------------- History */
type Filter = "all" | "pass" | "fail";

export function HistoryPage() {
  const all = useHistory();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(
    () => all.filter((e) => (f === "all" || (f === "pass") === e.selected) && (e.jdTitle + e.fileName).toLowerCase().includes(q.toLowerCase())),
    [all, q, f],
  );

  return (
    <main className="page wrap">
      <PageHead icon={<HistoryIcon size={120} />} eyebrow="History" title={<>Your past <span className="grad">analyses</span></>}>
        {all.length > 0 && (
          <button className="btn ghost sm" onClick={() => confirm("Delete all saved analyses from this browser?") && clearHistory()}>
            <Trash2 size={15} /> Clear all
          </button>
        )}
      </PageHead>

      {all.length === 0 ? (
        <Empty title="Nothing here yet" text="Every analysis you run is saved in this browser so you can compare roles and track your progress." />
      ) : (
        <>
          <div className="toolrow">
            <div className="search">
              <Search size={16} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by job or file…" />
            </div>
            <div className="seg" role="tablist">
              {([["all", "All"], ["pass", "Shortlisted"], ["fail", "Rejected"]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)} role="tab" aria-selected={f === k}>
                  {f === k && <motion.i layoutId="seg" className="seg-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="hist">
            <AnimatePresence initial={false}>
              {rows.map((e) => <HistoryRow key={e.id} e={e} open={open === e.id} toggle={() => setOpen(open === e.id ? null : e.id)} />)}
            </AnimatePresence>
            {rows.length === 0 && <div className="empty"><Search size={22} />No analyses match your filters.</div>}
          </div>
        </>
      )}
    </main>
  );
}

function MiniRing({ score, pass }: { score: number; pass: boolean }) {
  const r = 20, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 50 50" className="minir" aria-label={`${score}%`}>
      <circle cx="25" cy="25" r={r} className="t" />
      <motion.circle cx="25" cy="25" r={r} className="b" style={{ stroke: pass ? "var(--good)" : "var(--bad)" }} strokeDasharray={c} transform="rotate(-90 25 25)"
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }} transition={{ duration: 1.1, ease }} />
      <text x="25" y="29" textAnchor="middle">{Math.round(score)}</text>
    </svg>
  );
}

function HistoryRow({ e, open, toggle }: { e: HistoryEntry; open: boolean; toggle: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.45, ease }}>
      <GlowCard className="hrow">
        <button className="hrow-main" onClick={toggle} aria-expanded={open}>
          <MiniRing score={e.score} pass={e.selected} />
          <div className="hrow-t">
            <b>{e.jdTitle}</b>
            <span><FileText size={13} /> {e.fileName} <Clock size={13} /> {fmt(e.at)}</span>
          </div>
          <div className="hrow-badges">
            <span className={`badge ${e.selected ? "good" : "bad"}`}>{e.selected ? "Shortlisted" : "Rejected"}</span>
            {e.tailored && <span className="tag2 ai">Tailored</span>}
          </div>
          <ChevronDown size={18} className={`chev ${open ? "up" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div className="hrow-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease }}>
              <div className="hrow-grid">
                <div>
                  <h4>Matched ({e.matched.length})</h4>
                  <div className="mock-chips">{e.matched.map((s) => <span key={s} className="chip ok"><CheckCircle2 size={13} />{s}</span>)}</div>
                </div>
                <div>
                  <h4>Missing ({e.missing.length})</h4>
                  <div className="mock-chips">
                    {e.missing.length ? e.missing.map((s) => <span key={s} className="chip no"><XCircle size={13} />{s}</span>) : <span className="muted">None</span>}
                  </div>
                </div>
              </div>
              <div className="hrow-foot">
                <span className="muted">Experience {e.expHave} yrs{e.expNeed != null && ` of ${e.expNeed} needed`} · pass mark {e.threshold}%</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost sm" onClick={() => removeEntry(e.id)}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlowCard>
    </motion.div>
  );
}

/* -------------------------------------------------------------- Dashboard */
function TrendChart({ data }: { data: HistoryEntry[] }) {
  const W = 640, H = 240, P = { l: 36, r: 16, t: 16, b: 28 };
  const pts = [...data].reverse().slice(-14);
  const [hover, setHover] = useState<number | null>(null);
  const x = (i: number) => P.l + (pts.length < 2 ? (W - P.l - P.r) / 2 : (i / (pts.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score)}`).join(" ");
  const area = pts.length ? `${line} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";
  const thr = pts[pts.length - 1]?.threshold ?? 60;
  const h = hover != null ? pts[hover] : null;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Score over time" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="tfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--brand)" stopOpacity=".35" /><stop offset="1" stopColor="var(--brand)" stopOpacity="0" /></linearGradient>
          <linearGradient id="tline" x1="0" x2="1"><stop offset="0" stopColor="var(--brand-3)" /><stop offset="1" stopColor="var(--brand-2)" /></linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="gl" /><text x={P.l - 8} y={y(v) + 4} textAnchor="end" className="ax">{v}</text></g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(thr)} y2={y(thr)} className="thr" />
        <text x={W - P.r} y={y(thr) - 6} textAnchor="end" className="ax thrt">pass mark {thr}%</text>
        <motion.path d={area} fill="url(#tfill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }} />
        <motion.path d={line} fill="none" stroke="url(#tline)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease }} />
        {pts.map((p, i) => (
          <g key={p.id} onMouseEnter={() => setHover(i)}>
            <circle cx={x(i)} cy={y(p.score)} r="14" fill="transparent" />
            <motion.circle cx={x(i)} cy={y(p.score)} r={hover === i ? 6 : 4} className="pt" style={{ stroke: p.selected ? "var(--good)" : "var(--bad)" }}
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 + i * 0.05, type: "spring" }} />
          </g>
        ))}
        {h && (
          <g pointerEvents="none" transform={`translate(${Math.min(Math.max(x(hover!), 70), W - 70)},${Math.max(y(h.score) - 50, 4)})`}>
            <rect x="-62" width="124" height="38" rx="9" className="tip" />
            <text y="16" textAnchor="middle" className="tipb">{h.score}% · {fmt(h.at)}</text>
            <text y="30" textAnchor="middle" className="ax">{h.jdTitle.slice(0, 22)}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

export function DashboardPage() {
  const all = useHistory();
  const s = useMemo(() => {
    const n = all.length;
    const avg = n ? all.reduce((a, e) => a + e.score, 0) / n : 0;
    const best = n ? Math.max(...all.map((e) => e.score)) : 0;
    const pass = all.filter((e) => e.selected).length;
    const miss = new Map<string, number>();
    all.forEach((e) => e.missing.forEach((m) => miss.set(m, (miss.get(m) ?? 0) + 1)));
    const top = [...miss].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const recent = all.slice(0, 5).reduce((a, e) => a + e.score, 0) / Math.max(1, Math.min(5, n));
    const older = all.slice(5, 10);
    const delta = older.length ? recent - older.reduce((a, e) => a + e.score, 0) / older.length : null;
    return { n, avg, best, pass, top, delta };
  }, [all]);

  return (
    <main className="page wrap">
      <PageHead icon={<BarChart3 size={120} />} eyebrow="Dashboard" title={<>How you're <span className="grad">trending</span></>} />
      {s.n === 0 ? (
        <Empty title="No data to chart yet" text="Run a few analyses and your score trend, shortlist rate and most-missed skills show up here." />
      ) : (
        <>
          <div className="kgrid">
            {([
              [<Target size={20} />, "Analyses", <CountUp to={s.n} />, "violet"],
              [<TrendingUp size={20} />, "Average score", <CountUp to={s.avg} suffix="%" />, "cyan"],
              [<Trophy size={20} />, "Best score", <CountUp to={s.best} suffix="%" />, "amber"],
              [<CheckCircle2 size={20} />, "Shortlist rate", <CountUp to={(s.pass / s.n) * 100} suffix="%" />, "green"],
            ] as [ReactNode, string, ReactNode, string][]).map(([ic, label, val, tone], i) => (
              <Reveal key={label} delay={i * 0.07}>
                <GlowCard className="kcard">
                  <div className={`ico ${tone}`}>{ic}</div>
                  <span>{label}</span>
                  <b>{val}</b>
                </GlowCard>
              </Reveal>
            ))}
          </div>

          <div className="dgrid">
            <Reveal>
              <GlowCard className="panel">
                <h3>Score over time {s.delta != null && <em className={s.delta >= 0 ? "up" : "dn"}>{s.delta >= 0 ? "▲" : "▼"} {Math.abs(s.delta).toFixed(0)} pts vs earlier</em>}</h3>
                <p>Last {Math.min(14, s.n)} analyses. Green dots cleared the pass mark.</p>
                <TrendChart data={all} />
              </GlowCard>
            </Reveal>
            <Reveal delay={0.1}>
              <GlowCard className="panel">
                <h3>Most-missed skills</h3>
                <p>Learn these to lift your score across roles.</p>
                <ul className="bars">
                  {s.top.length === 0 && <li className="empty">No gaps recorded.</li>}
                  {s.top.map(([name, n], i) => (
                    <li key={name}>
                      <div><b>{name}</b><span className="mono">{n}×</span></div>
                      <div className="bar-t"><motion.span initial={{ width: 0 }} animate={{ width: `${(n / s.top[0][1]) * 100}%` }} transition={{ duration: 0.9, delay: 0.3 + i * 0.08, ease }} /></div>
                    </li>
                  ))}
                </ul>
              </GlowCard>
            </Reveal>
          </div>
        </>
      )}
    </main>
  );
}
