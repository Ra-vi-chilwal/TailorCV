import { useSyncExternalStore } from "react";

export type Route = "home" | "history" | "dashboard";

const parse = (): Route => {
  const h = location.hash.replace(/^#\/?/, "");
  return h === "history" || h === "dashboard" ? h : "home";
};

export const useRoute = () =>
  useSyncExternalStore(
    (cb) => { addEventListener("hashchange", cb); return () => removeEventListener("hashchange", cb); },
    parse,
  );

export const navigate = (r: Route) => { location.hash = r === "home" ? "#/" : `#/${r}`; scrollTo({ top: 0 }); };

/** Scroll to a landing section, switching back to the home route first if needed. */
export const go = (id: string) => () => {
  const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  if (parse() === "home") return scroll();
  location.hash = "#/";
  setTimeout(scroll, 120);
};
