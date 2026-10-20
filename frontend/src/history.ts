import { useSyncExternalStore } from "react";
import type { Report } from "./api";

export interface HistoryEntry {
  id: string;
  at: number;
  fileName: string;
  jdTitle: string;
  score: number;
  threshold: number;
  selected: boolean;
  matched: string[];
  missing: string[];
  expHave: number;
  expNeed: number | null;
  tailored: boolean;
}

const KEY = "rb-history-v1";
const listeners = new Set<() => void>();
let cache: HistoryEntry[] | null = null;

function read(): HistoryEntry[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(next: HistoryEntry[]) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}

export const useHistory = () =>
  useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, read);

const title = (jd: string) => jd.trim().replace(/\s+/g, " ").slice(0, 70) + (jd.length > 70 ? "…" : "");

export function saveAnalysis(id: string, fileName: string, jd: string, r: Report) {
  write([
    {
      id, at: Date.now(), fileName, jdTitle: title(jd), score: r.score, threshold: r.threshold, selected: r.selected,
      matched: r.matched.map((m) => m.skill), missing: r.missing, expHave: r.experience.have, expNeed: r.experience.need, tailored: false,
    },
    ...read(),
  ].slice(0, 100));
}

export function markTailored(id: string) {
  write(read().map((e) => (e.id === id ? { ...e, tailored: true } : e)));
}

export const removeEntry = (id: string) => write(read().filter((e) => e.id !== id));
export const clearHistory = () => write([]);

/** Demo rows so the pages can be previewed without running the backend. */
export function loadDemo() {
  const jobs = ["Backend Engineer, fintech startup", "Senior Python Developer, SaaS", "Platform Engineer, logistics", "Full-stack Engineer, healthtech", "Data Engineer, e-commerce", "SRE, cloud infrastructure", "ML Engineer, adtech", "API Developer, travel"];
  const pool = ["Kubernetes", "AWS", "Terraform", "GraphQL", "Redis", "Kafka", "CI/CD", "Go", "Airflow", "Spark"];
  const have = ["Python", "FastAPI", "Docker", "PostgreSQL", "REST APIs", "Git", "Linux"];
  const scores = [42, 51, 58, 63, 61, 70, 74, 79];
  const demo: HistoryEntry[] = jobs.map((j, i) => ({
    id: `demo-${i}`, at: Date.now() - (jobs.length - i) * 86_400_000 * 1.7, fileName: "my_resume.pdf", jdTitle: j, score: scores[i], threshold: 60,
    selected: scores[i] >= 60, matched: have.slice(0, 3 + (i % 5)), missing: pool.slice(i % 4, (i % 4) + 2 + (i % 3)), expHave: 4.2, expNeed: 3 + (i % 3),
    tailored: scores[i] >= 60 && i % 2 === 0,
  }));
  write([...demo.reverse(), ...read().filter((e) => !e.id.startsWith("demo-"))]);
}
