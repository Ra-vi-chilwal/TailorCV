import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Bot, MessageCircle, Send, Sparkles } from "lucide-react";
import { profile } from "../profile";
import { Reveal } from "./ui";

/** Cycles through the suggested questions in a fake chat input, like someone typing. */
function Typewriter({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    const full = lines[i];
    if (n < full.length) {
      const t = setTimeout(() => setN(n + 1), 55);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setN(0); setI((i + 1) % lines.length); }, 1400);
    return () => clearTimeout(t);
  }, [n, i, lines]);
  return <span>{lines[i].slice(0, n)}<i className="caret" /></span>;
}

const pop = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { delay },
});

export function PortfolioCard() {
  return (
    <a className="pf glass" href={profile.url} target="_blank" rel="noopener noreferrer">
      <div className="pf-glow" />
      <div className="pf-left">
        <div className="pf-top">
          <div className="avatar"><span>{profile.initials}</span><i /></div>
          <div>
            <b>{profile.name}</b>
            <small>{profile.role}</small>
          </div>
        </div>
        <h3>Want to know who built this?<br /><span className="grad">Talk to my AI assistant.</span></h3>
        <p>Ask about my projects, skills and experience. It answers like a conversation, no digging through a CV.</p>
        <div className="pf-chips">
          {profile.prompts.map((p) => <span key={p}><Sparkles size={12} /> {p}</span>)}
        </div>
        <span className="btn lg pf-cta"><MessageCircle size={18} /> Chat with my assistant <ArrowUpRight size={18} /></span>
      </div>

      <div className="pf-chat" aria-hidden>
        <div className="pf-chat-bar"><Bot size={16} /> personal-assistant <em><i /> online</em></div>
        <div className="pf-msgs">
          <motion.div className="msg bot" {...pop(0.3)}>Hi! Ask me anything about {profile.name.split(" ")[0]} and their work.</motion.div>
          <motion.div className="msg me" {...pop(0.9)}>{profile.prompts[1]}</motion.div>
          <motion.div className="msg bot dots" {...pop(1.5)}><i /><i /><i /></motion.div>
        </div>
        <div className="pf-input">
          <Typewriter lines={profile.prompts} />
          <span className="send"><Send size={15} /></span>
        </div>
      </div>
    </a>
  );
}

export function Portfolio() {
  return (
    <section id="about" className="section">
      <div className="wrap">
        <Reveal className="shead center">
          <span className="eyebrow">Meet the developer</span>
          <h2>Built by a human. <span className="grad">Ask them anything.</span></h2>
        </Reveal>
        <Reveal><PortfolioCard /></Reveal>
      </div>
    </section>
  );
}

export const PortfolioPill = () => (
  <a className="pf-pill" href={profile.url} target="_blank" rel="noopener noreferrer">
    <Bot size={15} /> Chat with my AI <ArrowUpRight size={14} />
  </a>
);
