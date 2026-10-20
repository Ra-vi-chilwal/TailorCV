import { AnimatePresence, motion } from "motion/react";
import Background from "./components/Background";
import { Faq, Footer, Hero, HowItWorks, Nav, Problem, Why } from "./components/Landing";
import { DashboardPage, HistoryPage } from "./components/Pages";
import Tool from "./components/Tool";
import { Portfolio } from "./components/Portfolio";
import { useRoute } from "./router";

export default function App() {
  const route = useRoute();
  return (
    <>
      <Background />
      <Nav />
      <AnimatePresence mode="wait">
        <motion.div
          key={route}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
        >
          {route === "home" && (
            <>
              <Hero />
              <Problem />
              <HowItWorks />
              <Tool />
              <Why />
              <Faq />
              <Portfolio />
            </>
          )}
          {route === "history" && <HistoryPage />}
          {route === "dashboard" && <DashboardPage />}
          <Footer />
        </motion.div>
      </AnimatePresence>
    </>
  );
}
