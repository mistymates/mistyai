import { motion, AnimatePresence } from "framer-motion";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import {
  PanelRight,
  X,
  Sparkles,
  Mic,
  History,
  Lightbulb,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  CalendarPlus,
  ListTodo,
} from "lucide-react";
import { useAssistant } from "@/lib/assistant-store";
import { dispatchAssistantIntent } from "@/lib/assistant-intents";
import logo from "@/assets/misty-orb.png";

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/app/dashboard": [
    "Summarize my day in one breath",
    "What should I focus on first?",
    "Move evening yoga earlier",
  ],
  "/app/tasks": [
    "Prioritize today's tasks for me",
    "What's blocking my biggest task?",
    "Draft a plan for the next 2 hours",
  ],
  "/app/calendar": [
    "Find a free hour this afternoon",
    "Reschedule meetings around deep work",
    "Summarize tomorrow's agenda",
  ],
  "/app/journal": [
    "Reflect on today in three sentences",
    "What was a small win today?",
    "Suggest a gentle prompt for tonight",
  ],
  "/app/notes": [
    "Tidy up my latest note",
    "Find notes about product",
    "Turn this note into a checklist",
  ],
  "/app/projects": [
    "Status on Misty v1",
    "Break this project into milestones",
    "Suggest next 3 tasks",
  ],
  "/app/health": [
    "How am I trending this week?",
    "Recommend a recovery routine",
    "Build a sleep wind-down plan",
  ],
};

const fallbackSuggestions = [
  "What can you help me with here?",
  "Show me something useful",
  "Plan the next hour",
];

export function AssistantSidePanel() {
  const open = useAssistant((s) => s.sidePanelOpen);
  const setSidePanelOpen = useAssistant((s) => s.setSidePanelOpen);
  const messages = useAssistant((s) => s.messages);
  const setOpen = useAssistant((s) => s.setOpen);
  const status = useAssistant((s) => s.status);
  const route = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const suggestions = PAGE_SUGGESTIONS[route] ?? fallbackSuggestions;

  const triggerAssistant = () => {
    setOpen(true);
  };

  const runIntent = (intent: "open_task_create" | "open_event_create" | "search_mode") => {
    if (intent === "open_task_create") {
      if (route !== "/app/tasks") {
        void navigate({ to: "/app/tasks" });
      }
      window.setTimeout(() => dispatchAssistantIntent({ type: "open_task_create" }), 0);
      return;
    }

    if (intent === "open_event_create") {
      if (route !== "/app/calendar") {
        void navigate({ to: "/app/calendar" });
      }
      window.setTimeout(() => dispatchAssistantIntent({ type: "open_event_create" }), 0);
      return;
    }

    dispatchAssistantIntent({ type: "search_mode" });
  };

  const recent = [...messages]
    .filter((m) => m.text.trim())
    .slice(-6)
    .reverse();

  return (
    <>
      {/* Persistent toggle handle on the right edge */}
      <motion.button
        onClick={() => setSidePanelOpen(!open)}
        aria-label="Toggle assistant panel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed top-1/2 -translate-y-1/2 z-30 h-20 w-7 rounded-l-xl border border-r-0 border-white/10 bg-background/60 backdrop-blur-xl grid place-items-center transition-all hover:bg-white/[0.08] ${
          open ? "right-[360px]" : "right-0"
        }`}
      >
        <PanelRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.aside
            key="aside"
            initial={{ x: 380, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 380, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="fixed top-0 right-0 bottom-0 z-30 w-[360px] max-w-[90vw] border-l border-white/5 bg-background/70 backdrop-blur-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <div className="relative h-8 w-8 shrink-0">
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[color:var(--violet)] to-[color:var(--cyan)] blur-md opacity-60" />
                <img src={logo} alt="" className="relative h-8 w-8 rounded-full" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-sm font-semibold leading-tight">Assistant</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {status === "idle" ? "Standing by" : status}
                </div>
              </div>
              <button
                onClick={() => setSidePanelOpen(false)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/5 transition"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* Hero CTA */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 relative overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[color:var(--violet)]/25 blur-3xl" />
                <div className="relative">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">
                    Right now
                  </div>
                  <p className="text-sm leading-snug">
                    I'm here, watching the page quietly. Ask me anything about{" "}
                    <span className="text-gradient font-medium">
                      {route.split("/").pop() || "this view"}
                    </span>
                    .
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={triggerAssistant}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black text-xs font-medium hover:opacity-90 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Open chat
                    </button>
                    <button
                      onClick={triggerAssistant}
                      className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
                      aria-label="Voice"
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Quick actions */}
              <Section icon={Plus} title="Quick actions">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: ListTodo, label: "New task", intent: "open_task_create" as const },
                    {
                      icon: CalendarPlus,
                      label: "New event",
                      intent: "open_event_create" as const,
                    },
                    { icon: Search, label: "Find anything", intent: "search_mode" as const },
                    { icon: Sparkles, label: "Plan my day", action: "assist" as const },
                  ].map((a) => {
                    const Icon = a.icon;
                    const body = (
                      <span className="flex items-center gap-2 text-xs">
                        <Icon className="h-3.5 w-3.5 text-[color:var(--violet)]" />
                        {a.label}
                      </span>
                    );
                    return (
                      <button
                        key={a.label}
                        onClick={() => {
                          if ("intent" in a && a.intent) runIntent(a.intent);
                          else {
                            dispatchAssistantIntent({
                              type: "ask_with_prompt",
                              prompt: "Plan my day from my current tasks and calendar.",
                            });
                          }
                        }}
                        className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition text-left"
                      >
                        {body}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* Suggestions */}
              <Section icon={Lightbulb} title="Suggestions for this page">
                <div className="space-y-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        dispatchAssistantIntent({ type: "ask_with_prompt", prompt: s })
                      }
                      className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.07] border border-white/5 transition flex items-center justify-between group"
                    >
                      <span>{s}</span>
                      <Sparkles className="h-3 w-3 text-[color:var(--violet)] opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  ))}
                </div>
              </Section>

              {/* Recent activity */}
              <Section icon={History} title="Recent">
                {recent.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic px-1 py-3 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    No assistant activity yet.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {recent.map((m) => (
                      <div
                        key={m.id}
                        className="text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-start gap-2"
                      >
                        {m.role === "user" ? (
                          <span className="text-[10px] uppercase tracking-wider text-[color:var(--cyan)] mt-0.5 shrink-0">
                            You
                          </span>
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-[color:var(--violet)] mt-0.5 shrink-0" />
                        )}
                        <span className="text-muted-foreground line-clamp-2">{m.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      {children}
    </div>
  );
}
