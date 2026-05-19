import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouterState, Link } from "@tanstack/react-router";
import { Mic, MicOff, X, Send, Volume2, VolumeX, Sparkles, Square } from "lucide-react";
import { useAssistant } from "@/lib/assistant-store";
import { useVoice } from "@/lib/use-voice";
import { Waveform } from "./Waveform";
import logo from "@/assets/Icon.png";
import { useAIContext } from "@/lib/hooks/use-ai-context";
import {
  THREADS_CHANGED_EVENT,
  ensureChatThread,
  loadActiveThreadId,
  loadThreads,
  saveActiveThreadId,
  updateThreadMessages,
  type Thread,
} from "@/lib/chat-storage";
import { appendLocalMessages } from "@/lib/desktop-launcher";
import { tryHandleSpotifyCommand } from "@/lib/spotify-commands";
import { onAssistantIntent } from "@/lib/assistant-intents";

const PAGE_HINTS: Record<string, string> = {
  "/": "the ambient Misty landing page - keep the reply calm, brief, and voice-first",
  "/app/dashboard": "the Dashboard — give a brief, warm daily orientation",
  "/app/tasks": "the Tasks page — help organize and prioritize tasks",
  "/app/calendar": "the Calendar page — help schedule and plan events",
  "/app/journal": "the Journal — help reflect and summarize thoughts",
  "/app/notes": "the Notes page — help capture and refine notes",
  "/app/projects": "Projects — help break down and track project work",
  "/app/health": "Health — help with habits and wellbeing",
  "/app/analytics": "Analytics — help interpret patterns and trends",
  "/app/memory": "Memory — help recall and organize stored context",
  "/app/settings": "Settings — help configure preferences",
  "/app/chat": "the full Chat workspace",
};

function buildSystem(route: string) {
  const hint = PAGE_HINTS[route] ?? `the route ${route}`;
  return [
    "Speak naturally and conversationally — your reply will be spoken aloud, so keep it concise (1–3 short sentences unless the user clearly wants depth).",
    "Avoid markdown, lists, code blocks, or symbols in voice replies.",
    `The user is currently on ${hint}. Tailor suggestions to that context when relevant.`,
  ].join(" ");
}

function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export function GlobalAssistant() {
  const open = useAssistant((s) => s.open);
  const setOpen = useAssistant((s) => s.setOpen);
  const status = useAssistant((s) => s.status);
  const setStatus = useAssistant((s) => s.setStatus);
  const voiceEnabled = useAssistant((s) => s.voiceEnabled);
  const setVoiceEnabled = useAssistant((s) => s.setVoiceEnabled);
  const wakeWordEnabled = useAssistant((s) => s.wakeWordEnabled);
  const liveTranscript = useAssistant((s) => s.liveTranscript);
  const setPageContext = useAssistant((s) => s.setPageContext);
  const personalityPrompt = useAssistant((s) => s.personalityPrompt);
  const [thread, setThread] = useState<Thread>(() =>
    typeof window === "undefined"
      ? { id: "", title: "", updatedAt: 0, messages: [] }
      : ensureChatThread(),
  );

  const { buildContextString } = useAIContext();

  const route = useRouterState({ select: (s) => s.location.pathname });
  const isLanding = route === "/";
  useEffect(() => setPageContext(route), [route, setPageContext]);

  useEffect(() => {
    if (isLanding && open) setOpen(false);
  }, [isLanding, open, setOpen]);

  // Clear notification badge when the user opens the assistant
  useEffect(() => {
    if (open) useAssistant.getState().setNotifications(0);
  }, [open]);

  useEffect(() => {
    const syncThread = () => {
      const threads = loadThreads();
      const activeId = loadActiveThreadId();
      const next = threads.find((t) => t.id === activeId) ?? threads[0] ?? ensureChatThread();
      setThread(next);
    };

    window.addEventListener(THREADS_CHANGED_EVENT, syncThread);
    window.addEventListener("storage", syncThread);
    return () => {
      window.removeEventListener(THREADS_CHANGED_EVENT, syncThread);
      window.removeEventListener("storage", syncThread);
    };
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );
  const {
    messages: chatMessages,
    sendMessage,
    status: chatStatus,
  } = useChat({
    id: thread.id,
    messages: thread.messages,
    transport,
    onFinish: ({ message }) => {
      const text = getMessageText(message);
      if (text) {
        if (voiceEnabled) speak(text);
        else setStatus("idle");
      } else {
        setStatus("idle");
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unknown assistant error";
      console.error("Assistant chat error:", message);
      setStatus("idle");
    },
  });

  const lastSaved = useRef(0);
  useEffect(() => {
    if (!thread.id) return;
    if (chatStatus === "submitted" || chatStatus === "streaming" || chatMessages.length > 0) {
      const now = Date.now();
      if (now - lastSaved.current > 200 || chatStatus === "ready") {
        lastSaved.current = now;
        updateThreadMessages(thread.id, chatMessages);
      }
    }
  }, [chatMessages, chatStatus, thread.id]);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    saveActiveThreadId(thread.id);
    setStatus("thinking");

    void (async () => {
      const spotifyResult = await tryHandleSpotifyCommand(trimmed);
      if (spotifyResult.handled) {
        const activeThread =
          loadThreads().find((candidate) => candidate.id === thread.id) ?? thread;
        const nextMessages = appendLocalMessages(
          activeThread.messages,
          spotifyResult.userText,
          spotifyResult.assistantText,
        );
        updateThreadMessages(activeThread.id, nextMessages);
        setThread({ ...activeThread, messages: nextMessages, updatedAt: Date.now() });

        if (voiceEnabled) {
          speak(spotifyResult.assistantText);
        } else {
          setStatus("idle");
        }
        return;
      }

      const finalSystem = buildSystem(route) + buildContextString();
      sendMessage({ text: trimmed }, { body: { system: finalSystem, personalityPrompt } });
    })();
  };

  const { startListening, stopListening, speak, stopSpeaking, startWakeWord, stopWakeWord } =
    useVoice(ask, { openOnWake: !isLanding });

  const finishTalking = () => {
    const transcript = useAssistant.getState().liveTranscript.trim();
    stopListening();
    if (transcript) {
      useAssistant.getState().setLiveTranscript("");
      ask(transcript);
    } else {
      setStatus("idle");
    }
  };

  // Ambient mode: keep a lightweight wake listener running while voice is enabled.
  // The wake hit only plays preloaded local audio and then starts Deepgram capture.
  useEffect(() => {
    if (!voiceEnabled || !wakeWordEnabled) {
      stopWakeWord();
      return;
    }

    void startWakeWord();
    return () => stopWakeWord();
  }, [startWakeWord, stopWakeWord, voiceEnabled, wakeWordEnabled]);

  // Open + start listening when user invokes voice
  const startVoice = useCallback(async () => {
    if (!isLanding && !open) setOpen(true);
    stopSpeaking();

    const assistant = useAssistant.getState();
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      assistant.setMicPermission("denied");
      assistant.setPermissionModalOpen(true);
      assistant.setStatus("idle");
      return;
    }

    // Probe permission first; show modal if not yet granted
    try {
      const perm = (
        navigator as {
          permissions?: { query: (p: { name: string }) => Promise<{ state: string }> };
        }
      ).permissions;
      if (perm) {
        const res = await perm.query({ name: "microphone" });
        const permission = res.state as "granted" | "denied" | "prompt";
        assistant.setMicPermission(permission);
        if (
          permission === "denied" ||
          (permission === "prompt" && assistant.micPermission !== "granted")
        ) {
          assistant.setPermissionModalOpen(true);
          assistant.setStatus("idle");
          return;
        }
      }
    } catch {
      if (assistant.micPermission !== "granted") {
        assistant.setMicPermission("prompt");
        assistant.setPermissionModalOpen(true);
        assistant.setStatus("idle");
        return;
      }
      // permissions API not supported — fall through to direct request
    }
    await startListening();
  }, [isLanding, open, setOpen, startListening, stopSpeaking]);

  // Hotkey: ⌘/Ctrl + J toggles assistant (⌘K is reserved for the command palette), Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (isLanding) return;
        useAssistant.getState().toggleOpen();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        const next = !useAssistant.getState().voiceEnabled;
        setVoiceEnabled(next);
        if (!next) {
          stopListening();
          stopSpeaking();
        }
      } else if (e.key === "Escape" && useAssistant.getState().open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isLanding, setOpen, setVoiceEnabled, stopListening, stopSpeaking]);

  useEffect(() => {
    const onLandingVoice = () => void startVoice();
    const onLandingStopVoice = () => {
      stopListening();
      stopSpeaking();
    };
    const onMicrophoneGranted = () => void startVoice();

    window.addEventListener("misty:start-voice", onLandingVoice);
    window.addEventListener("misty:stop-voice", onLandingStopVoice);
    window.addEventListener("misty:microphone-granted", onMicrophoneGranted);
    return () => {
      window.removeEventListener("misty:start-voice", onLandingVoice);
      window.removeEventListener("misty:stop-voice", onLandingStopVoice);
      window.removeEventListener("misty:microphone-granted", onMicrophoneGranted);
    };
  }, [startVoice, stopListening, stopSpeaking]);

  useEffect(() => {
    return onAssistantIntent((intent) => {
      if (intent.type !== "ask_with_prompt") return;
      const prompt = intent.prompt.trim();
      if (!prompt) return;
      if (!isLanding) setOpen(true);
      ask(prompt);
    });
  }, [ask, isLanding, setOpen]);

  if (isLanding) {
    return null;
  }

  return (
    <>
      <FloatingOrbButton onClick={() => setOpen(!open)} />
      <AnimatePresence>
        {open && (
          <AssistantPanel
            key="panel"
            onClose={() => setOpen(false)}
            messages={
              chatStatus === "submitted" || chatStatus === "streaming"
                ? chatMessages
                : thread.messages
            }
            status={status}
            liveTranscript={liveTranscript}
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
            onStartVoice={startVoice}
            onStopVoice={stopListening}
            onFinishTalking={finishTalking}
            onStopSpeaking={stopSpeaking}
            onSend={ask}
            route={route}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FloatingOrbButton({ onClick }: { onClick: () => void }) {
  const status = useAssistant((s) => s.status);
  const open = useAssistant((s) => s.open);
  const notifications = useAssistant((s) => s.notifications);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Open Misty assistant"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 18 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className="fixed bottom-6 right-6 z-50 group"
    >
      <img
        src={logo}
        alt=""
        width={56}
        height={56}
        className={`h-14 w-14 orb-image-glow ${status === "idle" && !open ? "animate-float-orb" : ""}`}
      />
      {notifications > 0 && status === "idle" && !open && (
        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full grid place-items-center text-[10px] font-semibold bg-gradient-to-br from-[color:var(--rose)] to-[color:var(--amber)] text-black shadow-lg">
          {notifications}
        </span>
      )}
    </motion.button>
  );
}

function AssistantPanel({
  onClose,
  messages,
  status,
  liveTranscript,
  voiceEnabled,
  onToggleVoice,
  onStartVoice,
  onStopVoice,
  onFinishTalking,
  onStopSpeaking,
  onSend,
  route,
}: {
  onClose: () => void;
  messages: UIMessage[];
  status: ReturnType<typeof useAssistant.getState>["status"];
  liveTranscript: string;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onFinishTalking: () => void;
  onStopSpeaking: () => void;
  onSend: (t: string) => void;
  route: string;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, liveTranscript]);

  const isListening = status === "listening";
  const isSpeaking = status === "speaking";

  const statusLabel =
    status === "listening"
      ? "Listening…"
      : status === "thinking"
        ? "Thinking…"
        : status === "speaking"
          ? "Speaking…"
          : "Ready";

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-background/40 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="fixed bottom-24 right-6 z-50 w-[min(440px,calc(100vw-3rem))] max-h-[min(640px,calc(100vh-8rem))] flex flex-col glass-card overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <div className="relative h-9 w-9 shrink-0">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[color:var(--violet)] to-[color:var(--cyan)] blur-md opacity-70" />
            <img src={logo} alt="" className="relative h-9 w-9 rounded-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold leading-tight">Misty</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === "idle" ? "bg-white/30" : "bg-[color:var(--cyan)] animate-pulse"
                }`}
              />
              {statusLabel} · {route}
            </div>
          </div>
          <button
            onClick={onToggleVoice}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/5 transition"
            aria-label={voiceEnabled ? "Mute voice" : "Enable voice"}
            title={voiceEnabled ? "Voice replies on" : "Voice replies off"}
          >
            {voiceEnabled ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <Link
            to="/app/chat"
            className="text-[11px] text-muted-foreground hover:text-foreground transition px-2"
            onClick={onClose}
          >
            Full chat
          </Link>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-white/5 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Waveform / hero */}
        <div className="px-4 pt-4 pb-2">
          <Waveform className="opacity-90" />
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[160px]">
          {messages.length === 0 && !liveTranscript && <EmptyPrompts onPick={onSend} />}
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-gradient-to-br from-[color:var(--violet)]/30 to-[color:var(--cyan)]/20 border border-white/10"
                    : "bg-white/5 border border-white/5"
                }`}
              >
                {getMessageText(m) ||
                  (m.role === "assistant" && status === "thinking" ? (
                    <span className="inline-flex gap-1 items-center text-muted-foreground">
                      <Sparkles className="h-3 w-3 animate-pulse" /> thinking…
                    </span>
                  ) : (
                    ""
                  ))}
              </div>
            </motion.div>
          ))}
          {liveTranscript && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm italic text-muted-foreground border border-dashed border-white/15">
                {liveTranscript}
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-white/5 p-3 flex items-center gap-2">
          <button
            type="button"
            onClick={isListening ? onStopVoice : onStartVoice}
            className={`h-10 w-10 grid place-items-center rounded-xl transition shrink-0 ${
              isListening
                ? "bg-gradient-to-br from-[color:var(--rose)] to-[color:var(--violet)] text-white"
                : "bg-white/5 hover:bg-white/10"
            }`}
            aria-label={isListening ? "Stop listening" : "Start voice"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {isListening && (
            <button
              type="button"
              onClick={onFinishTalking}
              className="h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs shrink-0"
              aria-label="Done talking"
              title="Finish and send"
            >
              Done talking
            </button>
          )}

          {isSpeaking && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="h-10 px-3 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 shrink-0"
              aria-label="Stop speaking"
              title="Interrupt"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          )}

          <form
            className="flex-1 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim()) return;
              onSend(input);
              setInput("");
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Misty or hold the mic…"
              className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-white/10 outline-none text-sm focus:border-[color:var(--violet)]/60 focus:bg-white/[0.07] transition"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-10 w-10 grid place-items-center rounded-xl bg-gradient-to-br from-[color:var(--violet)] to-[color:var(--cyan)] text-black disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </motion.div>
    </>
  );
}

function EmptyPrompts({ onPick }: { onPick: (t: string) => void }) {
  const prompts = [
    "Give me a calm briefing for today.",
    "Help me focus for the next hour.",
    "What should I reflect on tonight?",
    "Summarize what's on my plate.",
  ];
  return (
    <div className="grid grid-cols-1 gap-2 pt-2">
      <div className="text-xs text-muted-foreground mb-1">Try saying or typing…</div>
      {prompts.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          className="text-left text-sm px-3 py-2 rounded-xl glass hover:bg-white/10 transition flex items-center justify-between gap-2 group"
        >
          <span>{p}</span>
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--violet)] opacity-0 group-hover:opacity-100 transition" />
        </button>
      ))}
    </div>
  );
}
