import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import {
  Cloud,
  Droplets,
  Flame,
  Moon,
  Activity,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Plus,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Circle,
  Coffee,
  Brain,
  Quote,
  Settings2,
  Eye,
  EyeOff,
  GripVertical,
  Check,
  RotateCcw,
  Loader2,
  RefreshCw,
  Target,
  Zap,
  Sun,
  Calendar,
  MessageSquareText,
  Ear,
  EarOff,
  Wallet,
  CheckCheck,
  X,
} from "lucide-react";
import { useAssistant } from "@/lib/assistant-store";
import { useReviewMemory, useToggleHabit } from "@/lib/hooks/use-mutations";
import {
  useTasks,
  useHabits,
  useAgenda,
  useJournalEntries,
  useWeather,
  useLiveInsights,
  useUsageSummary,
  useDailyMemoryDigest,
} from "@/lib/hooks/use-data";
import { useSpotifyStatus } from "@/lib/hooks/use-spotify-status";
import { useSpotifyPlayer } from "@/lib/spotify-player";
import { SpotifyAuth, type SpotifyTrack } from "@/lib/spotify";
import { QUOTES } from "@/lib/constants";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Misty" }] }),
  component: Dashboard,
});

const card = "glass-card p-5";

type WidgetId =
  | "agenda"
  | "weather"
  | "mood"
  | "tasks"
  | "habits"
  | "focus"
  | "sleep"
  | "water"
  | "workout"
  | "music"
  | "quote"
  | "quickai"
  | "usage"
  | "memorydigest";

type WidgetMeta = { id: WidgetId; label: string; span: string };

const ALL_WIDGETS: WidgetMeta[] = [
  { id: "agenda", label: "Agenda", span: "col-span-12 lg:col-span-6 row-span-2" },
  { id: "weather", label: "Weather", span: "col-span-6 lg:col-span-3" },
  { id: "mood", label: "Mood", span: "col-span-6 lg:col-span-3" },
  { id: "tasks", label: "Tasks", span: "col-span-12 lg:col-span-3 row-span-2" },
  { id: "habits", label: "Habits", span: "col-span-12 lg:col-span-3 row-span-2" },
  { id: "focus", label: "Focus", span: "col-span-6 lg:col-span-3" },
  { id: "sleep", label: "Sleep", span: "col-span-6 lg:col-span-3" },
  { id: "water", label: "Water", span: "col-span-6 lg:col-span-3" },
  { id: "workout", label: "Workout", span: "col-span-6 lg:col-span-3" },
  { id: "music", label: "Music", span: "col-span-12 lg:col-span-6" },
  { id: "quote", label: "Quote", span: "col-span-12 lg:col-span-6" },
  { id: "usage", label: "Token Cost", span: "col-span-12 lg:col-span-6" },
  { id: "memorydigest", label: "Memory Digest", span: "col-span-12 lg:col-span-6 row-span-2" },
  { id: "quickai", label: "Quick AI", span: "col-span-12" },
];

const LS_ORDER = "misty.dashboard.order";
const LS_HIDDEN = "misty.dashboard.hidden";
const LS_QUOTE_ROTATION = "misty.dashboard.quote-rotation";
const QUOTE_ROTATION_MS = 30 * 60 * 1000;

function getRotationSlot(now: number) {
  return Math.floor(now / QUOTE_ROTATION_MS);
}

function getInitialQuoteIndex() {
  if (typeof window === "undefined" || QUOTES.length === 0) return 0;

  const now = Date.now();
  const currentSlot = getRotationSlot(now);

  try {
    const raw = localStorage.getItem(LS_QUOTE_ROTATION);
    if (!raw) {
      localStorage.setItem(LS_QUOTE_ROTATION, JSON.stringify({ slot: currentSlot, index: 0 }));
      return 0;
    }

    const saved = JSON.parse(raw) as { slot?: number; index?: number };
    const savedIndex = Number.isFinite(saved.index) ? Number(saved.index) : 0;
    const savedSlot = Number.isFinite(saved.slot) ? Number(saved.slot) : currentSlot;
    const slotDiff = Math.max(0, currentSlot - savedSlot);
    const nextIndex = (savedIndex + slotDiff) % QUOTES.length;
    localStorage.setItem(
      LS_QUOTE_ROTATION,
      JSON.stringify({ slot: currentSlot, index: nextIndex }),
    );
    return nextIndex;
  } catch {
    return currentSlot % QUOTES.length;
  }
}

function useLayout() {
  const [order, setOrder] = useState<WidgetId[]>(() => {
    if (typeof window === "undefined") return ALL_WIDGETS.map((w) => w.id);
    try {
      const saved = JSON.parse(localStorage.getItem(LS_ORDER) || "null") as WidgetId[] | null;
      if (saved && Array.isArray(saved)) {
        const known = saved.filter((id) => ALL_WIDGETS.some((w) => w.id === id));
        const missing = ALL_WIDGETS.map((w) => w.id).filter((id) => !known.includes(id));
        return [...known, ...missing];
      }
    } catch {
      /* ignore */
    }
    return ALL_WIDGETS.map((w) => w.id);
  });

  const [hidden, setHidden] = useState<WidgetId[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(LS_HIDDEN) || "[]") as WidgetId[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_ORDER, JSON.stringify(order));
  }, [order]);
  useEffect(() => {
    localStorage.setItem(LS_HIDDEN, JSON.stringify(hidden));
  }, [hidden]);

  const reset = () => {
    setOrder(ALL_WIDGETS.map((w) => w.id));
    setHidden([]);
  };

  return { order, setOrder, hidden, setHidden, reset };
}

function Dashboard() {
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Still up"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : hour < 22
            ? "Good evening"
            : "Winding down";
  const [quoteIndex, setQuoteIndex] = useState(() => getInitialQuoteIndex());
  const quote = QUOTES[quoteIndex] ?? QUOTES[0];
  const openAssistant = useAssistant((s) => s.setOpen);
  const wakeWordEnabled = useAssistant((s) => s.wakeWordEnabled);
  const setWakeWordEnabled = useAssistant((s) => s.setWakeWordEnabled);
  const [editing, setEditing] = useState(false);
  const { order, setOrder, hidden, setHidden, reset } = useLayout();
  const { mutate: toggleHabit } = useToggleHabit();
  const {
    isConnected: spotifyConnected,
    currentTrack,
    loading: spotifyLoading,
  } = useSpotifyStatus();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: habits = [], isLoading: habitsLoading } = useHabits();
  const { data: journal = [], isLoading: journalLoading } = useJournalEntries();
  const { data: weather, isLoading: weatherLoading } = useWeather();
  const { data: agenda = [], isLoading: agendaLoading } = useAgenda();
  const {
    data: liveData,
    isLoading: insightsLoading,
    refetch: refetchInsights,
    isFetching: insightsFetching,
  } = useLiveInsights(false);
  const { data: usageSummary } = useUsageSummary();
  const { data: memoryDigest } = useDailyMemoryDigest();
  const { mutate: reviewMemory, isPending: reviewPending } = useReviewMemory();

  const isLoading = tasksLoading || habitsLoading || journalLoading || agendaLoading;

  useEffect(() => {
    if (QUOTES.length <= 1 || typeof window === "undefined") return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const rotateQuote = () => {
      setQuoteIndex((prev) => {
        const next = (prev + 1) % QUOTES.length;
        localStorage.setItem(
          LS_QUOTE_ROTATION,
          JSON.stringify({ slot: getRotationSlot(Date.now()), index: next }),
        );
        return next;
      });
    };

    const now = Date.now();
    const msUntilNextSlot = QUOTE_ROTATION_MS - (now % QUOTE_ROTATION_MS);

    timeoutId = setTimeout(() => {
      rotateQuote();
      intervalId = setInterval(rotateQuote, QUOTE_ROTATION_MS);
    }, msUntilNextSlot);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const moodWeek = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { day: days[d.getDay()], date: d.toISOString().split("T")[0], mood: 5 };
    });

    journal.forEach((entry) => {
      const entryDate = new Date(entry.created_at).toISOString().split("T")[0];
      const found = last7Days.find((d) => d.date === entryDate);
      if (found && entry.mood) {
        found.mood = parseInt(entry.mood) || 5;
      }
    });

    return last7Days;
  }, [journal]);

  const visibleWidgets = order
    .map((id) => ALL_WIDGETS.find((w) => w.id === id))
    .filter((w): w is WidgetMeta => !!w && !hidden.includes(w.id));

  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Brain,
    Activity,
    Coffee,
    Target,
    Zap,
    Flame,
    Droplets,
    Moon,
    Sun,
    Calendar,
    MessageSquareText,
  };

  if (isLoading && !editing) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
            {greeting}, <span className="text-gradient">Louis</span>.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs border transition ${
              wakeWordEnabled
                ? "bg-[color:var(--violet)]/20 border-[color:var(--violet)]/40 text-[color:var(--violet)]"
                : "bg-white/5 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground"
            }`}
            title={wakeWordEnabled ? "Wake word is enabled" : "Wake word is off"}
          >
            {wakeWordEnabled ? <Ear className="h-3.5 w-3.5" /> : <EarOff className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Wake word</span>
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs border transition ${
              editing
                ? "bg-white/10 border-white/20"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
            {editing ? "Done" : "Customize"}
          </button>
          <Link
            to="/app/chat"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium hover:opacity-90 transition"
          >
            <Sparkles className="h-3.5 w-3.5" /> Ask Misty
          </Link>
        </div>
      </motion.div>

      {/* Edit toolbar */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Personalize
                  </p>
                  <p className="text-sm mt-0.5">
                    Drag to reorder · toggle visibility · layout saves automatically
                  </p>
                </div>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_WIDGETS.map((w) => {
                  const isHidden = hidden.includes(w.id);
                  return (
                    <button
                      key={w.id}
                      onClick={() =>
                        setHidden(isHidden ? hidden.filter((id) => id !== w.id) : [...hidden, w.id])
                      }
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                        isHidden
                          ? "bg-transparent border-white/10 text-muted-foreground"
                          : "bg-white/10 border-white/15 text-foreground"
                      }`}
                    >
                      {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {w.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Briefing */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${card} relative overflow-hidden`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--violet)]/10 via-transparent to-[color:var(--cyan)]/10 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--violet)] opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--violet)]" />
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Daily briefing
              </span>
            </div>
            <p className="font-display text-base sm:text-lg leading-snug">
              {insightsLoading ? (
                <span className="animate-pulse bg-white/10 rounded h-6 w-3/4 block" />
              ) : liveData?.briefing ? (
                liveData.briefing
              ) : (
                "A calm, focused day is ahead — start with deep work, then ease into meetings."
              )}
            </p>
            <div className="mt-3 grid sm:grid-cols-3 gap-2">
              {insightsLoading
                ? Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                  ))
                : liveData?.insights?.map((i, idx) => {
                    const Icon = iconMap[i.icon] || Zap;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + idx * 0.08 }}
                        className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5"
                      >
                        <Icon
                          className={`h-3.5 w-3.5 mt-0.5 shrink-0 text-[color:var(--${i.color})]`}
                        />
                        <span className="text-xs text-muted-foreground leading-relaxed">
                          {i.text}
                        </span>
                      </motion.div>
                    );
                  })}
            </div>
          </div>
          <div className="shrink-0 flex flex-col gap-2">
            <button
              onClick={() => {
                void refetchInsights();
              }}
              disabled={insightsFetching}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${insightsFetching ? "animate-spin" : ""}`} />
              Refresh briefing
            </button>
            <button
              onClick={() => openAssistant(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs bg-white/5 hover:bg-white/10 border border-white/10 transition"
            >
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--violet)]" />
              Brief me by voice
            </button>
          </div>
        </div>
      </motion.div>

      {/* Bento grid */}
      <Reorder.Group
        axis="y"
        values={visibleWidgets.map((w) => w.id)}
        onReorder={(next) => {
          const reordered: WidgetId[] = [];
          const nextSet = new Set(next);
          // Walk original order, but replace visible IDs with next sequence
          const visibleIter = next[Symbol.iterator]();
          for (const id of order) {
            if (hidden.includes(id) || !nextSet.has(id)) {
              reordered.push(id);
            } else {
              const v = visibleIter.next();
              if (!v.done) reordered.push(v.value);
            }
          }
          setOrder(reordered);
        }}
        as="div"
        className="grid grid-cols-12 gap-4 auto-rows-[minmax(120px,auto)]"
        layoutScroll
      >
        <AnimatePresence>
          {visibleWidgets.map((w, i) => (
            <DashboardWidget
              key={w.id}
              widget={w}
              index={i}
              editing={editing}
              onHide={() => setHidden((current) => [...current, w.id])}
            >
              <WidgetBody
                id={w.id}
                quote={quote}
                usageSummary={usageSummary}
                memoryDigest={memoryDigest}
                reviewMemory={reviewMemory}
                reviewPending={reviewPending}
                toggleHabit={toggleHabit}
                agenda={agenda}
                tasks={tasks}
                habits={habits}
                moodWeek={moodWeek}
                weather={weather}
                weatherLoading={weatherLoading}
                currentTrack={currentTrack}
                spotifyConnected={spotifyConnected}
                spotifyLoading={spotifyLoading}
              />
            </DashboardWidget>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {visibleWidgets.length === 0 && (
        <div className="glass-card p-10 text-center">
          <Sparkles className="h-6 w-6 text-[color:var(--violet)] mx-auto mb-3" />
          <p className="font-display text-lg">Your dashboard is clear.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Turn widgets back on from the Customize toolbar above.
          </p>
        </div>
      )}
    </div>
  );
}

function DashboardWidget({
  widget,
  index,
  editing,
  onHide,
  children,
}: {
  widget: WidgetMeta;
  index: number;
  editing: boolean;
  onHide: () => void;
  children: React.ReactNode;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={widget.id}
      as="div"
      drag={editing ? "y" : false}
      dragListener={false}
      dragControls={dragControls}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: editing ? 0 : index * 0.02, duration: editing ? 0.18 : 0.28 }}
      whileDrag={{ scale: 1.015, zIndex: 30 }}
      className={`${widget.span} relative`}
    >
      {editing && (
        <div className="absolute -top-2 -right-2 z-10 flex gap-1">
          <button
            onClick={onHide}
            className="h-7 w-7 grid place-items-center rounded-full bg-background/80 border border-white/15 backdrop-blur-xl hover:bg-white/10 transition"
            aria-label="Hide widget"
          >
            <EyeOff className="h-3 w-3" />
          </button>
          <button
            type="button"
            onPointerDown={(event) => dragControls.start(event)}
            className="h-7 w-7 grid place-items-center rounded-full bg-background/80 border border-white/15 backdrop-blur-xl cursor-grab active:cursor-grabbing hover:bg-white/10 transition touch-none"
            aria-label="Drag widget"
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
      {children}
    </Reorder.Item>
  );
}

function WidgetBody({
  id,
  quote,
  usageSummary,
  memoryDigest,
  reviewMemory,
  reviewPending,
  toggleHabit,
  agenda = [],
  tasks = [],
  habits = [],
  moodWeek = [],
  weather,
  weatherLoading,
  currentTrack,
  spotifyConnected,
  spotifyLoading,
}: {
  id: WidgetId;
  quote: { quote: string; author: string };
  usageSummary?: {
    gemini: { inputTokens: number; outputTokens: number; totalTokens: number; costIdr: number };
    elevenlabs: { charactersUsed: number; costIdr: number };
  };
  memoryDigest?: {
    totals: { learnedToday: number; pending: number; approved: number; rejected: number };
    pending: Array<{
      id: string;
      content: string;
      category: string;
      importance: number;
      metadata: Record<string, unknown>;
      created_at: string;
    }>;
  };
  reviewMemory?: (input: { id: string; action: "approve" | "reject" }) => void;
  reviewPending?: boolean;
  toggleHabit?: unknown;
  agenda?: unknown[];
  tasks?: unknown[];
  habits?: unknown[];
  moodWeek?: unknown[];
  weather?: unknown;
  weatherLoading?: boolean;
  currentTrack?: SpotifyTrack | null;
  spotifyConnected?: boolean;
  spotifyLoading?: boolean;
}) {
  const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
  const spotifyPlayer = useSpotifyPlayer();
  const activeTrack = spotifyPlayer.currentTrack ?? currentTrack ?? null;
  const progressRatio =
    spotifyPlayer.duration > 0 ? Math.min(1, spotifyPlayer.position / spotifyPlayer.duration) : 0;
  const spotifyControlsDisabled =
    spotifyPlayer.connecting || (!spotifyConnected && !spotifyPlayer.connected);
  const progressTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };
  switch (id) {
    case "agenda":
      return (
        <div className={`${card} h-full`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Today's agenda</h2>
              <p className="text-xs text-muted-foreground">{agenda.length} things on your mind</p>
            </div>
            <Plus className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer" />
          </div>
          <div className="space-y-2.5">
            {agenda.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-4">No events scheduled.</div>
            )}
            {agenda.map((a) => {
              const date = new Date(a.start_time);
              const isValidDate = !isNaN(date.getTime());
              const time = isValidDate
                ? date.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                : "--:--";

              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition group"
                >
                  <div className="text-xs font-mono text-muted-foreground w-12">{time}</div>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      a.type === "focus"
                        ? "bg-[color:var(--violet)]"
                        : a.type === "meeting"
                          ? "bg-[color:var(--cyan)]"
                          : a.type === "break"
                            ? "bg-[color:var(--mint)]"
                            : "bg-[color:var(--rose)]"
                    }`}
                  />
                  <div className="flex-1 text-sm">{a.title}</div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider opacity-0 group-hover:opacity-100 transition">
                    {a.type}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    case "weather":
      return (
        <div className={`${card} h-full relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--cyan)]/20 to-transparent" />
          <div className="relative">
            <Cloud className="h-6 w-6 text-[color:var(--cyan)]" />
            <div className="mt-3">
              {weatherLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-3xl font-display font-semibold">
                    {weather?.temperature != null ? Math.round(weather.temperature) : "--"}°
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    Local weather · {weather?.city || "Detecting..."}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    case "mood":
      return (
        <div className={`${card} h-full`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Mood this week</span>
            <Brain className="h-3.5 w-3.5 text-[color:var(--rose)]" />
          </div>
          <div className="flex items-end gap-1 h-12">
            {moodWeek.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-[color:var(--rose)] to-[color:var(--violet)]"
                  style={{ height: `${d.mood * 10}%` }}
                />
                <span className="text-[9px] text-muted-foreground">{d.day[0]}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "tasks":
      return (
        <div className={`${card} h-full`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold">Tasks</h2>
            <Link to="/app/tasks" className="text-xs text-muted-foreground hover:text-foreground">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-4">All caught up!</div>
            )}
            {tasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-start gap-2 text-sm group cursor-pointer">
                {t.done ? (
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--mint)] shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-foreground transition" />
                )}
                <span className={t.done ? "line-through text-muted-foreground" : ""}>
                  {t.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    case "habits":
      return (
        <div className={`${card} h-full`}>
          <h2 className="font-display font-semibold mb-3">Habits</h2>
          <div className="space-y-3">
            {habits.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-4">No habits tracked.</div>
            )}
            {habits.map((h) => (
              <div
                key={h.id}
                onClick={() => toggleHabit?.({ id: h.id, done: !h.done })}
                className="cursor-pointer"
              >
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <Flame className={`h-3.5 w-3.5 text-[color:var(--${h.color || "violet"})]`} />
                    {h.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{h.streak}d</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-[color:var(--${h.color || "violet"})]`}
                    style={{ width: `${Math.min(100, (h.streak / (h.target || 7)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    case "focus":
      return (
        <div className={`${card} h-full`}>
          <Coffee className="h-5 w-5 text-[color:var(--amber)]" />
          <div className="mt-3">
            <div className="text-2xl font-display font-semibold">2h 14m</div>
            <div className="text-xs text-muted-foreground">Focus today</div>
          </div>
        </div>
      );
    case "sleep":
      return (
        <div className={`${card} h-full`}>
          <Moon className="h-5 w-5 text-[color:var(--violet)]" />
          <div className="mt-3">
            <div className="text-2xl font-display font-semibold">7h 42m</div>
            <div className="text-xs text-muted-foreground">Slept · 92% quality</div>
          </div>
        </div>
      );
    case "water":
      return (
        <div className={`${card} h-full`}>
          <Droplets className="h-5 w-5 text-[color:var(--cyan)]" />
          <div className="mt-3">
            <div className="text-2xl font-display font-semibold">1.4 / 2.5L</div>
            <div className="mt-2 flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < 5 ? "bg-[color:var(--cyan)]" : "bg-white/10"}`}
                />
              ))}
            </div>
          </div>
        </div>
      );
    case "workout":
      return (
        <div className={`${card} h-full`}>
          <Activity className="h-5 w-5 text-[color:var(--mint)]" />
          <div className="mt-3">
            <div className="text-2xl font-display font-semibold">42 min</div>
            <div className="text-xs text-muted-foreground">Yoga · 312 cal</div>
          </div>
        </div>
      );
    case "music":
      return (
        <div className={`${card} h-full relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[color:var(--cyan)]/14 via-transparent to-[color:var(--violet)]/12 pointer-events-none" />
          <div className="relative flex items-start gap-3">
            {activeTrack?.album?.images?.[0] ? (
              <img
                src={activeTrack.album.images[0].url}
                alt={activeTrack.name}
                className="h-16 w-16 rounded-2xl object-cover shadow-[0_12px_30px_-16px_rgba(0,0,0,0.7)]"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[color:var(--rose)] to-[color:var(--amber)] flex items-center justify-center shadow-[0_12px_30px_-16px_rgba(0,0,0,0.7)]">
                <Music className="h-6 w-6 text-white/70" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Spotify
                </p>
                <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      spotifyPlayer.connected
                        ? "bg-[color:var(--accent)] shadow-[0_0_12px_var(--accent)]"
                        : spotifyConnected
                          ? "bg-[color:var(--amber)]"
                          : "bg-white/20"
                    }`}
                  />
                  {spotifyPlayer.connected
                    ? spotifyPlayer.isActive
                      ? "Live"
                      : "Ready"
                    : spotifyConnected
                      ? "Connected"
                      : "Offline"}
                </div>
              </div>
              {spotifyLoading ? (
                <>
                  <div className="text-sm font-medium truncate">Loading...</div>
                  <div className="text-xs text-muted-foreground">Checking Spotify</div>
                </>
              ) : activeTrack ? (
                <>
                  <div className="text-sm font-medium truncate">{activeTrack.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {activeTrack.artists?.[0]?.name || "Unknown Artist"}
                  </div>
                </>
              ) : spotifyConnected ? (
                <>
                  <div className="text-sm font-medium truncate">Misty player is ready</div>
                  <div className="text-xs text-muted-foreground">
                    Transfer playback here to start listening inside Misty.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium truncate">Spotify not connected</div>
                  <div className="text-xs text-muted-foreground">
                    Connect Spotify to see your music
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="relative mt-4">
            <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[color:var(--violet)] via-[color:var(--accent)] to-[color:var(--cyan)] shadow-[0_0_18px_color-mix(in_oklch,var(--accent)_40%,transparent)]"
                animate={{ width: `${Math.max(progressRatio * 100, activeTrack ? 2 : 0)}%` }}
                transition={{ duration: 0.45, ease: "linear" }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{progressTime(spotifyPlayer.position)}</span>
              <span>{progressTime(spotifyPlayer.duration)}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void spotifyPlayer.previousTrack()}
              disabled={spotifyControlsDisabled}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground transition hover:bg-white/10 disabled:opacity-40"
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void spotifyPlayer.togglePlay()}
              disabled={spotifyControlsDisabled}
              className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black shadow-[0_10px_24px_-14px_var(--accent)] transition hover:opacity-95 disabled:opacity-40"
              aria-label={spotifyPlayer.isPaused ? "Play" : "Pause"}
            >
              {spotifyPlayer.connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : spotifyPlayer.isPaused ? (
                <Play className="h-4 w-4 fill-current" />
              ) : (
                <Pause className="h-4 w-4 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={() => void spotifyPlayer.nextTrack()}
              disabled={spotifyControlsDisabled}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground transition hover:bg-white/10 disabled:opacity-40"
              aria-label="Next track"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <div className="ml-auto flex min-w-[116px] items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2">
              <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(spotifyPlayer.volume * 100)}
                onChange={(event) => void spotifyPlayer.setVolume(Number(event.target.value) / 100)}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[color:var(--accent)]"
                aria-label="Spotify volume"
              />
            </div>
          </div>

          {spotifyPlayer.error && (
            <p className="mt-3 text-xs text-[color:var(--rose)]">{spotifyPlayer.error}</p>
          )}

          {!spotifyConnected && !spotifyLoading && (
            <button
              type="button"
              onClick={() => void SpotifyAuth.login()}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground"
            >
              <Music className="h-3 w-3" />
              Connect Spotify
            </button>
          )}

          {spotifyConnected && !spotifyPlayer.isActive && !spotifyPlayer.error && (
            <button
              type="button"
              onClick={() => void spotifyPlayer.transferToMisty(true)}
              disabled={spotifyPlayer.connecting}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.07] hover:text-foreground disabled:opacity-50"
            >
              {spotifyPlayer.connecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Music className="h-3 w-3" />
              )}
              Move playback to Misty
            </button>
          )}
        </div>
      );
    case "quote":
      return (
        <div className={`${card} h-full relative overflow-hidden`}>
          <Quote className="absolute -top-2 -right-2 h-24 w-24 text-white/5" />
          <div className="relative">
            <p className="font-display text-lg italic leading-snug">"{quote.quote}"</p>
            <p className="mt-3 text-xs text-muted-foreground">— {quote.author}</p>
          </div>
        </div>
      );
    case "usage":
      return (
        <div className={`${card} h-full`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[color:var(--mint)]" /> Token / Cost
            </h2>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-muted-foreground text-xs mb-1">Gemini API</div>
              <div className="text-xs">
                Input: {idr.format(usageSummary?.gemini.inputTokens ?? 0)} tokens
              </div>
              <div className="text-xs">
                Output: {idr.format(usageSummary?.gemini.outputTokens ?? 0)} tokens
              </div>
              <div className="font-medium">
                Total: {idr.format(usageSummary?.gemini.totalTokens ?? 0)} tokens
              </div>
              <div className="text-xs text-[color:var(--mint)]">
                {idr.format(usageSummary?.gemini.costIdr ?? 0)} IDR
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-muted-foreground text-xs mb-1">ElevenLabs</div>
              <div className="font-medium">
                {idr.format(usageSummary?.elevenlabs.charactersUsed ?? 0)} chars used
              </div>
              <div className="text-xs text-[color:var(--mint)]">
                {idr.format(usageSummary?.elevenlabs.costIdr ?? 0)} IDR
              </div>
            </div>
          </div>
        </div>
      );
    case "memorydigest":
      return (
        <div className={`${card} h-full`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <CheckCheck className="h-4 w-4 text-[color:var(--violet)]" /> Daily Memory Digest
            </h2>
            <div className="text-[11px] text-muted-foreground">
              Learned: {memoryDigest?.totals.learnedToday ?? 0}
            </div>
          </div>

          <div className="flex gap-2 mb-3 text-[11px]">
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
              Pending {memoryDigest?.totals.pending ?? 0}
            </span>
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
              Approved {memoryDigest?.totals.approved ?? 0}
            </span>
            <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
              Rejected {memoryDigest?.totals.rejected ?? 0}
            </span>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
            {(memoryDigest?.pending ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-4">
                No pending memories to review today.
              </div>
            ) : (
              (memoryDigest?.pending ?? []).map((m) => (
                <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        {m.category} · importance {m.importance}
                      </div>
                      <p className="text-sm leading-relaxed">{m.content}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => reviewMemory?.({ id: m.id, action: "approve" })}
                        disabled={reviewPending}
                        className="h-7 w-7 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 grid place-items-center disabled:opacity-60"
                        aria-label="Approve memory"
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5 text-[color:var(--mint)]" />
                      </button>
                      <button
                        onClick={() => reviewMemory?.({ id: m.id, action: "reject" })}
                        disabled={reviewPending}
                        className="h-7 w-7 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 grid place-items-center disabled:opacity-60"
                        aria-label="Reject memory"
                        title="Reject"
                      >
                        <X className="h-3.5 w-3.5 text-[color:var(--rose)]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    case "quickai":
      return (
        <div className={`${card} h-full`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[color:var(--violet)]" /> Quick AI
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["Plan my day", "Summarize emails", "Brainstorm ideas", "Reflect on today"].map(
              (s) => (
                <Link
                  key={s}
                  to="/app/chat"
                  className="text-left p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition flex items-center justify-between group"
                >
                  <span className="text-sm">{s}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition" />
                </Link>
              ),
            )}
          </div>
        </div>
      );
  }
}
