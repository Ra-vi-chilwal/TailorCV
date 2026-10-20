import { useEffect, useRef, useState, type ElementType, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from "motion/react";

/** Fade + rise on scroll into view. */
export function Reveal({
  children, delay = 0, y = 28, className, as = "div",
}: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "section" }) {
  const M = motion[as] as typeof motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </M>
  );
}

/** Surface whose border + inner glow follow the cursor. */
export function GlowCard({
  children, className = "", as: Tag = "div", ...rest
}: { children: ReactNode; as?: ElementType } & HTMLAttributes<HTMLElement>) {
  const onMove = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
  };
  return (
    <Tag className={`glass glow ${className}`} onMouseMove={onMove} {...rest}>
      {children}
    </Tag>
  );
}

/** Number that counts up when scrolled into view. */
export function CountUp({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v.toFixed(decimals)}{suffix}</span>;
}

/** Subtle 3D tilt toward the cursor. */
export function Tilt({ children, max = 4 }: { children: ReactNode; max?: number }) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), { stiffness: 140, damping: 16 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), { stiffness: 140, damping: 16 });
  return (
    <motion.div
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => { px.set(0); py.set(0); }}
    >
      {children}
    </motion.div>
  );
}
