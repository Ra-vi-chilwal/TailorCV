import { useEffect, useRef } from "react";

/** Interactive constellation: drifting nodes link up when close and are pushed away by the cursor. */
export default function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const mouse = { x: -999, y: -999 };
    type P = { x: number; y: number; vx: number; vy: number; r: number };
    let pts: P[] = [];

    const resize = () => {
      w = innerWidth; h = innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(90, Math.floor((w * h) / 17000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: Math.random() * 1.6 + 0.6,
      }));
    };
    const move = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };

    const tick = () => {
      const light = document.documentElement.dataset.theme === "light";
      const rgb = light ? "79,70,229" : "165,160,255";
      const link = 130;
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 140 && d > 0) { p.x += (dx / d) * (140 - d) * 0.02; p.y += (dy / d) * (140 - d) * 0.02; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < link) {
            ctx.strokeStyle = `rgba(${rgb},${(1 - d / link) * (light ? 0.28 : 0.34)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        // brighter links to the cursor
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < 170) {
          ctx.strokeStyle = `rgba(${rgb},${(1 - md / 170) * 0.7})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = `rgba(${rgb},${light ? 0.55 : 0.8})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    addEventListener("resize", resize);
    addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { removeEventListener("resize", resize); removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  return <canvas ref={ref} className="particles" aria-hidden />;
}
