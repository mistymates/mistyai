import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, MessageSquareText } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  type Thread,
  THREADS_CHANGED_EVENT,
  ensureChatThread,
  loadActiveThreadId,
  loadThreads,
  newThread,
  saveActiveThreadId,
  saveThreads,
  updateThreadMessages,
} from "@/lib/chat-storage";
import logo from "@/assets/Icon.png";
import { useAIContext } from "@/lib/hooks/use-ai-context";
import { useAssistant } from "@/lib/assistant-store";
import { appendLocalMessages } from "@/lib/desktop-launcher";
import { tryHandleSpotifyCommand } from "@/lib/spotify-commands";

export const Route = createFileRoute("/app/chat")({
  head: () => ({ meta: [{ title: "AI Chat — Misty" }] }),
  component: ChatPage,
});

function ChatPage() {
  // Bootstrap threads idempotently
  const [threads, setThreads] = useState<Thread[]>(() => {
    if (typeof window === "undefined") return [];
    ensureChatThread();
    return loadThreads();
  });
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return ensureChatThread().id;
  });

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  useEffect(() => {
    const sync = () => {
      setThreads(loadThreads());
      const savedActiveId = loadActiveThreadId();
      if (savedActiveId) setActiveId(savedActiveId);
    };

    window.addEventListener(THREADS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THREADS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-4 -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
      {/* Thread sidebar */}
      <aside className="hidden md:flex glass-card w-64 flex-col p-3 shrink-0">
        <button
          onClick={() => {
            const t = newThread();
            const next = [t, ...threads];
            setThreads(next);
            saveThreads(next);
            setActiveId(t.id);
            saveActiveThreadId(t.id);
          }}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black text-sm font-medium hover:opacity-90 transition mb-3"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>
        <div className="text-xs text-muted-foreground px-2 mb-1.5">Recent</div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition ${
                t.id === activeId
                  ? "bg-white/10 text-foreground"
                  : "hover:bg-white/5 text-muted-foreground"
              }`}
              onClick={() => {
                setActiveId(t.id);
                saveActiveThreadId(t.id);
              }}
            >
              <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{t.title}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = threads.filter((x) => x.id !== t.id);
                  const final = next.length > 0 ? next : [newThread()];
                  setThreads(final);
                  saveThreads(final);
                  if (t.id === activeId) {
                    setActiveId(final[0].id);
                    saveActiveThreadId(final[0].id);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat window */}
      {active && (
        <ChatWindow
          key={active.id}
          thread={active}
          onUpdate={(messages) => {
            const next = updateThreadMessages(active.id, messages);
            setThreads(next);
          }}
        />
      )}
    </div>
  );
}

function ChatWindow({ thread, onUpdate }: { thread: Thread; onUpdate: (m: UIMessage[]) => void }) {
  const { buildContextString } = useAIContext();
  const personalityPrompt = useAssistant((s) => s.personalityPrompt);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({
    id: thread.id,
    messages: thread.messages,
    transport,
  });

  // Persist on change
  const lastSaved = useRef<number>(0);
  useEffect(() => {
    if (status === "streaming" || status === "submitted" || messages.length > 0) {
      const now = Date.now();
      if (now - lastSaved.current > 200 || status === "ready") {
        lastSaved.current = now;
        onUpdate(messages);
      }
    }
  }, [messages, status, onUpdate]);

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [thread.id, status]);

  const isLoading = status === "submitted" || status === "streaming";
  const displayMessages = isLoading
    ? messages
    : thread.messages.length > 0
      ? thread.messages
      : messages;
  const empty = displayMessages.length === 0;

  return (
    <div className="flex-1 flex flex-col glass-card overflow-hidden min-w-0">
      <Conversation className="flex-1">
        <ConversationContent className="max-w-3xl mx-auto w-full px-4 py-6">
          {empty ? (
            <EmptyState />
          ) : (
            <AnimatePresence initial={false}>
              {displayMessages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Message from={m.role}>
                    {m.role === "user" ? (
                      <MessageContent>
                        {m.parts.map((p, i) =>
                          p.type === "text" ? <span key={i}>{p.text}</span> : null,
                        )}
                      </MessageContent>
                    ) : (
                      <div className="prose prose-invert prose-sm max-w-none">
                        {m.parts.map((p, i) =>
                          p.type === "text" ? (
                            <MessageResponse key={i}>{p.text}</MessageResponse>
                          ) : null,
                        )}
                      </div>
                    )}
                  </Message>
                </motion.div>
              ))}
              {status === "submitted" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Shimmer>Thinking…</Shimmer>
                </motion.div>
              )}
              {error && (
                <div className="text-sm text-destructive p-3 rounded-lg bg-destructive/10">
                  Something went wrong: {error.message}
                </div>
              )}
            </AnimatePresence>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-white/5 p-3 sm:p-4">
        <div className="max-w-3xl mx-auto">
          <PromptInput
            onSubmit={(message) => {
              const text = (message.text ?? input).trim();
              if (!text || isLoading) return;
              void (async () => {
                const spotifyResult = await tryHandleSpotifyCommand(text);
                if (spotifyResult.handled) {
                  const baseMessages = messages.length > 0 ? messages : thread.messages;
                  onUpdate(
                    appendLocalMessages(
                      baseMessages,
                      spotifyResult.userText,
                      spotifyResult.assistantText,
                    ),
                  );
                  setInput("");
                  return;
                }

                sendMessage(
                  { text },
                  { body: { system: buildContextString(), personalityPrompt } },
                );
                setInput("");
              })();
            }}
          >
            <PromptInputTextarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Misty anything…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!input.trim() && !isLoading} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-12">
      <motion.img
        src={logo}
        alt=""
        width={96}
        height={96}
        className="h-24 w-24 animate-float mb-6"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
      />
      <h2 className="font-display text-3xl font-semibold">
        How can I help you, <span className="text-gradient">today?</span>
      </h2>
      <p className="text-muted-foreground mt-2 max-w-sm">
        I'm Misty. I remember what matters and stay quietly out of the way.
      </p>
    </div>
  );
}
