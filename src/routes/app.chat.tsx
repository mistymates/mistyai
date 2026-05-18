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
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  const active = threads.find((t) => t.id === activeId) ?? threads[0];

  const createChatThread = () => {
    const thread = newThread();
    const next = [thread, ...threads];
    setThreads(next);
    saveThreads(next);
    setActiveId(thread.id);
    saveActiveThreadId(thread.id);
  };

  const selectChatThread = (id: string) => {
    setActiveId(id);
    saveActiveThreadId(id);
  };

  const deleteChatThread = (id: string) => {
    const next = threads.filter((thread) => thread.id !== id);
    const final = next.length > 0 ? next : [newThread()];
    setThreads(final);
    saveThreads(final);
    if (id === activeId) {
      setActiveId(final[0].id);
      saveActiveThreadId(final[0].id);
    }
  };

  useEffect(() => {
    const sync = () => {
      ensureChatThread();
      setThreads(loadThreads());
      const savedActiveId = loadActiveThreadId();
      if (savedActiveId) setActiveId(savedActiveId);
    };

    sync();
    setIsMounted(true);
    window.addEventListener(THREADS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THREADS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <div className="-m-4 flex h-[calc(100dvh-7rem)] min-h-[520px] flex-col gap-4 p-4 sm:-m-6 sm:p-6 md:flex-row lg:-m-8 lg:p-8">
      {isMounted && (
        <div className="glass-card flex shrink-0 items-center gap-2 p-2 md:hidden">
          <label htmlFor="mobile-thread-select" className="sr-only">
            Select chat thread
          </label>
          <select
            id="mobile-thread-select"
            value={active?.id ?? ""}
            onChange={(event) => selectChatThread(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Select chat thread"
          >
            {threads.map((thread) => (
              <option key={thread.id} value={thread.id} className="bg-background text-foreground">
                {thread.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createChatThread}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="New chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Thread sidebar */}
      {isMounted && (
        <aside className="hidden md:flex glass-card w-64 flex-col p-3 shrink-0">
          <button
            type="button"
            onClick={createChatThread}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] px-3 py-2 text-sm font-medium text-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
          <div className="text-xs text-muted-foreground px-2 mb-1.5">Recent</div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {threads.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                  t.id === activeId
                    ? "bg-white/10 text-foreground"
                    : "hover:bg-white/5 text-muted-foreground"
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectChatThread(t.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-current={t.id === activeId ? "page" : undefined}
                >
                  <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{t.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteChatThread(t.id)}
                  className="opacity-0 transition hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Delete chat ${t.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Chat window */}
      {isMounted && active && (
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden glass-card min-w-0">
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
                <div
                  className="text-sm text-destructive p-3 rounded-lg bg-destructive/10"
                  role="alert"
                >
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
