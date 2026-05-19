import type { UIMessage } from "ai";

const KEY = "misty.threads.v1";
const ACTIVE_KEY = "misty.activeThreadId.v1";
export const THREADS_CHANGED_EVENT = "misty:threads-changed";

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

export function loadThreads(): Thread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Thread[];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(threads));
  window.dispatchEvent(new Event(THREADS_CHANGED_EVENT));
}

function persistThreadToBackend(thread: Thread) {
  if (typeof window === "undefined") return;
  window
    .fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: thread.id,
        title: thread.title,
        messages: thread.messages,
      }),
    })
    .catch((error) => console.warn("Conversation backend persistence failed", error));
}

export function loadActiveThreadId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_KEY) ?? "";
}

export function saveActiveThreadId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, id);
  window.dispatchEvent(new Event(THREADS_CHANGED_EVENT));
}

export function ensureChatThread() {
  const existing = loadThreads();
  const activeId = loadActiveThreadId();
  const active = existing.find((t) => t.id === activeId) ?? existing[0];

  if (active) {
    if (!activeId) saveActiveThreadId(active.id);
    return active;
  }

  const created = newThread();
  saveThreads([created]);
  saveActiveThreadId(created.id);
  return created;
}

export function updateThreadMessages(threadId: string, messages: UIMessage[]) {
  const threads = loadThreads();
  const next = threads.map((thread) =>
    thread.id === threadId
      ? { ...thread, messages, updatedAt: Date.now(), title: deriveTitle(messages) }
      : thread,
  );

  if (next.some((thread) => thread.id === threadId)) {
    saveThreads(next);
    const updated = next.find((thread) => thread.id === threadId);
    if (updated) persistThreadToBackend(updated);
    return next;
  }

  const created = { ...newThread(), id: threadId, messages, title: deriveTitle(messages) };
  const final = [created, ...next];
  saveThreads(final);
  persistThreadToBackend(created);
  saveActiveThreadId(created.id);
  return final;
}

export function newThread(): Thread {
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    updatedAt: Date.now(),
    messages: [],
  };
}

export function deriveTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New conversation";
  const text = first.parts
    ?.map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join(" ")
    .trim();
  if (!text) return "New conversation";
  return text.length > 40 ? text.slice(0, 40).trim() + "…" : text;
}
