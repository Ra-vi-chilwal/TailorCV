import { useEffect, useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import Particles from "./Particles";

/** Fixed aurora + grid + noise layers, with a spotlight that eases toward the cursor. */
export default function Background() {
  const spot = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  useEffect(() => {
    const el = spot.current;
    if (!el || matchMedia("(pointer: coarse)").matches) return;
    let tx = innerWidth / 2, ty = innerHeight * 0.3, x = tx, y = ty, raf = 0;
    const move = (e: PointerEvent) => { tx = e.clientX; ty = e.clientY; };
    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      raf = requestAnimationFrame(tick);
    };
    addEventListener("pointermove", move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <motion.div className="scroll-progress" style={{ scaleX }} />
      <div className="bg" aria-hidden>
        <div className="aurora a1" />
        <div className="aurora a2" />
        <div className="aurora a3" />
        <div className="beam" />
        <div className="bg-grid" />
        <Particles />
        <div className="orbit o1" /><div className="orbit o2" />
        <div className="spotlight" ref={spot} />
        <div className="bg-noise" />
      </div>
    </>
  );
}
