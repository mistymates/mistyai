import { AnimatePresence, motion } from "framer-motion";
import { Check, Circle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAssistant } from "@/lib/assistant-store";

type StartupItem = {
  label: string;
  duration: number;
};

const STARTUP_ITEMS: StartupItem[] = [
  { label: "Initializing Misty...", duration: 680 },
  { label: "Loading Gemini CLI", duration: 780 },
  { label: "Connecting ElevenLabs", duration: 720 },
  { label: "Starting Deepgram", duration: 760 },
  { label: "Initializing OpenWakeWord", duration: 860 },
  { label: "Loading Memory Systems", duration: 740 },
  { label: "Finalizing Interface", duration: 640 },
];

type BootState = "pending" | "active" | "done";

function getBootState(index: number, activeIndex: number): BootState {
  if (index < activeIndex) return "done";
  if (index === activeIndex) return "active";
  return "pending";
}

export function MistyStartupSequence() {
  const startupPhase = useAssistant((s) => s.startupPhase);
  const setStartupPhase = useAssistant((s) => s.setStartupPhase);
  const setStartupReady = useAssistant((s) => s.setStartupReady);
  const [activeIndex, setActiveIndex] = useState(0);
  const complete = startupPhase === "ready";

  useEffect(() => {
    if (startupPhase === "cold") {
      setStartupPhase("booting");
      setStartupReady(false);
    }
  }, [setStartupPhase, setStartupReady, startupPhase]);

  useEffect(() => {
    if (startupPhase !== "booting") return;

    const current = STARTUP_ITEMS[activeIndex];
    const timeout = window.setTimeout(() => {
      if (activeIndex >= STARTUP_ITEMS.length - 1) {
        setStartupReady(true);
        window.setTimeout(() => setStartupPhase("ready"), 520);
        return;
      }

      setActiveIndex((index) => index + 1);
    }, current.duration);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, setStartupPhase, setStartupReady, startupPhase]);

  useEffect(() => {
    if (startupPhase === "booting") return;
    setActiveIndex(0);
  }, [startupPhase]);

  const progress = useMemo(
    () => Math.min(100, ((activeIndex + (complete ? 1 : 0.45)) / STARTUP_ITEMS.length) * 100),
    [activeIndex, complete],
  );

  return (
    <AnimatePresence>
      {startupPhase === "booting" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-7 w-full max-w-[560px]"
          aria-live="polite"
        >
          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--accent)_10%,transparent),transparent_70%)] blur-2xl" />
            <div className="relative rounded-[28px] border border-border bg-card/30 px-5 py-5 text-left shadow-[0_18px_80px_-38px_color-mix(in_oklch,var(--accent)_22%,transparent)] backdrop-blur-2xl sm:px-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/90">
                    Startup
                  </p>
                  <p className="mt-2 text-sm text-foreground/82">Systems coming online</p>
                </div>
                <div className="h-10 w-10 rounded-full border border-accent/25 bg-accent/10 shadow-[0_0_28px_color-mix(in_oklch,var(--accent)_18%,transparent)]">
                  <div className="h-full w-full animate-pulse rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--accent)_24%,transparent),transparent_62%)]" />
                </div>
              </div>

              <div className="space-y-2.5">
                {STARTUP_ITEMS.map((item, index) => {
                  const state = getBootState(index, activeIndex);
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{
                        opacity: state === "pending" ? 0.36 : 1,
                        x: 0,
                      }}
                      transition={{ duration: 0.35, delay: index * 0.035 }}
                      className="grid grid-cols-[1.5rem_1fr_4.5rem] items-center gap-3"
                    >
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full border transition ${
                          state === "done"
                            ? "border-accent/60 bg-accent/15 text-accent"
                            : state === "active"
                              ? "border-accent/45 bg-accent/10 text-accent shadow-[0_0_18px_color-mix(in_oklch,var(--accent)_20%,transparent)]"
                              : "border-border text-muted-foreground"
                        }`}
                      >
                        {state === "done" ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Circle
                            className={`h-2.5 w-2.5 ${state === "active" ? "animate-pulse" : ""}`}
                          />
                        )}
                      </span>
                      <span className="min-w-0 text-sm text-foreground/88">{item.label}</span>
                      <span className="text-right text-[10px] uppercase text-muted-foreground">
                        {state === "done" ? "done" : state === "active" ? "active" : "queued"}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-7 h-px overflow-hidden bg-border">
                <motion.div
                  className="h-full bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_18px_var(--accent)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
