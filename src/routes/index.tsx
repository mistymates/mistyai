import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Mic, MicOff } from "lucide-react";
import { DottedSurface } from "@/components/dotted-surface";
import { useAssistant, type AssistantStatus } from "@/lib/assistant-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Misty - Ambient AI Assistant" },
      {
        name: "description",
        content: "A calm, voice-first AI assistant interface that reacts to sound and presence.",
      },
      { property: "og:title", content: "Misty - Ambient AI Assistant" },
      { property: "og:description", content: "A premium voice-first AI assistant experience." },
    ],
  }),
  component: Landing,
});

const STATUS_COPY: Record<AssistantStatus, string> = {
  idle: "Ambient",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
  connecting: "Connecting...",
  streaming_audio: "Speaking...",
  processing: "Processing...",
};

function Landing() {
  const navigate = useNavigate();
  const status = useAssistant((s) => s.status);
  const liveTranscript = useAssistant((s) => s.liveTranscript);
  const setPermissionModalOpen = useAssistant((s) => s.setPermissionModalOpen);

  const displayStatus = STATUS_COPY[status] ?? "Ambient";
  const isVoiceActive = status === "listening" || status === "thinking" || status === "speaking";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <DottedSurface className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--background)_8%,transparent),var(--background)_78%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background/75 to-transparent" />

      <header className="absolute left-0 right-0 top-0 z-20 px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/"
            className="font-display text-sm font-semibold [letter-spacing:0] text-foreground/70"
          >
            MISTY
          </Link>
          <button
            type="button"
            onClick={() => {
              void navigate({ to: "/app/dashboard" });
              window.setTimeout(() => {
                if (window.location.pathname === "/") {
                  window.location.href = "/app/dashboard";
                }
              }, 120);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/30 px-4 py-2 text-sm text-foreground/80 backdrop-blur-xl transition hover:bg-accent/10 hover:text-foreground"
          >
            Open app <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <section className="relative z-0 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-5"
        >
          <h1 className="font-display text-7xl font-semibold [letter-spacing:0] text-foreground sm:text-8xl md:text-9xl">
            MISTY
          </h1>
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border bg-background/25 px-4 py-2 text-sm text-muted-foreground backdrop-blur-xl">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "idle" ? "bg-muted-foreground/50" : "bg-[color:var(--accent)]"
              }`}
            />
            {displayStatus}
          </div>
          <p className="mx-auto min-h-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {liveTranscript || "A quiet intelligence, waiting at the edge of your voice."}
          </p>
        </motion.div>

        <motion.button
          type="button"
          onClick={() => {
            if (!isVoiceActive) {
              setPermissionModalOpen(true);
            }
            window.dispatchEvent(
              new Event(isVoiceActive ? "misty:stop-voice" : "misty:start-voice"),
            );
          }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
          className={`group absolute bottom-10 grid h-16 w-16 place-items-center rounded-full border backdrop-blur-2xl transition sm:bottom-12 ${
            isVoiceActive
              ? "border-accent/35 bg-accent/10 shadow-[0_0_28px_color-mix(in_oklch,var(--accent)_22%,transparent)]"
              : "border-border bg-background/25 hover:bg-accent/5"
          }`}
          aria-label={isVoiceActive ? "Stop voice" : "Start voice"}
        >
          <span
            className={`absolute inset-0 rounded-full transition ${
              isVoiceActive ? "animate-pulse bg-accent/5" : "bg-transparent"
            }`}
          />
          {isVoiceActive ? (
            <MicOff className="relative h-5 w-5" />
          ) : (
            <Mic className="relative h-5 w-5" />
          )}
        </motion.button>
      </section>
    </main>
  );
}
