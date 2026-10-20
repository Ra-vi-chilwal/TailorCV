import { useEffect, useState } from "react";
import { animate, motion } from "motion/react";

export default function ScoreRing({ score, threshold, size = 190 }: { score: number; threshold: number; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pass = score >= threshold;
  const color = pass ? "var(--good)" : "var(--bad)";
  const [n, setN] = useState(0);

  useEffect(() => {
    const ctl = animate(0, score, { duration: 1.6, delay: 0.2, ease: [0.22, 1, 0.36, 1], onUpdate: setN });
    return () => ctl.stop();
  }, [score]);

  // threshold marker position
  const a = (threshold / 100) * 2 * Math.PI - Math.PI / 2;
  const x1 = 60 + (r - 8) * Math.cos(a), y1 = 60 + (r - 8) * Math.sin(a);
  const x2 = 60 + (r + 8) * Math.cos(a), y2 = 60 + (r + 8) * Math.sin(a);

  return (
    <svg className="ring" style={{ width: size, height: size }} viewBox="0 0 120 120" role="img" aria-label={`Score ${score}%`}>
      <circle cx="60" cy="60" r={r} className="ring-track" />
      <motion.circle
        cx="60" cy="60" r={r} className="ring-glow" stroke={color} strokeDasharray={c} transform="rotate(-90 60 60)"
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(score, 100) / 100) }}
        transition={{ duration: 1.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx="60" cy="60" r={r} className="bar" stroke={color} style={{ color }}
        strokeDasharray={c} transform="rotate(-90 60 60)"
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(score, 100) / 100) }}
        transition={{ duration: 1.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      />
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="tick" />
      <text x="60" y="66" textAnchor="middle" className="num">{Math.round(n)}%</text>
      <text x="60" y="82" textAnchor="middle" className="sub">need {threshold}%</text>
    </svg>
  );
}
