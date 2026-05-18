import { createClient } from "@/lib/supabase/browser";
import type {
  Task,
  Note,
  Project,
  Habit,
  CalendarEvent,
  Notification,
  Transaction,
  JournalEntry,
  Memory,
  MemoryCategory,
} from "@/lib/types/database";
import { memoryService } from "./memory-service";

export type UsageSummary = {
  gemini: { inputTokens: number; outputTokens: number; totalTokens: number; costIdr: number };
  elevenlabs: { charactersUsed: number; costIdr: number };
};

export type DailyMemoryDigest = {
  totals: { learnedToday: number; pending: number; approved: number; rejected: number };
  pending: Array<{
    id: string;
    content: string;
    category: string;
    importance: number;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  approved: Array<{
    id: string;
    content: string;
    category: string;
    importance: number;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  rejected: Array<{
    id: string;
    content: string;
    category: string;
    importance: number;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
};

const supabase = createClient();

async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Database request failed");
  }

  return (await response.json()) as T;
}

const dataPath = (table: string) => `/api/data?table=${encodeURIComponent(table)}`;
const dataPathWithId = (table: string, id: string) =>
  `${dataPath(table)}&id=${encodeURIComponent(id)}`;

const dataPathWithRange = (table: string, start?: string, end?: string) => {
  const params = new URLSearchParams({ table });
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return `/api/data?${params.toString()}`;
};

export const dataService = {
  async getMemories(category?: MemoryCategory) {
    return memoryService.getMemories(category);
  },

  async createMemory(memory: Partial<Memory>) {
    const response = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memory),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to create memory");
    }

    return await response.json();
  },

  async deleteMemory(id: string) {
    return memoryService.deleteMemory(id);
  },

  async getTasks() {
    return apiRequest<Task[]>(dataPath("tasks"));
  },

  async getNotifications() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Notification[];
  },

  async markNotificationsRead() {
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false)
      .select();

    if (error) throw error;
    return data as Notification[];
  },

  async getNotes() {
    return apiRequest<Note[]>(dataPath("notes"));
  },

  async getProjects() {
    return apiRequest<Project[]>(dataPath("projects"));
  },

  async getHabits() {
    const { data, error } = await supabase
      .from("habits")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Habit[];
  },

  async getAgenda() {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) throw error;
    return data as CalendarEvent[];
  },

  async getCalendarEvents(start?: string, end?: string) {
    return apiRequest<CalendarEvent[]>(dataPathWithRange("calendar_events", start, end));
  },

  async createCalendarEvent(event: Partial<CalendarEvent>) {
    return apiRequest<CalendarEvent>(dataPath("calendar_events"), {
      method: "POST",
      body: JSON.stringify(event),
    });
  },

  async deleteCalendarEvent(id: string) {
    return apiRequest<CalendarEvent>(dataPathWithId("calendar_events", id), {
      method: "DELETE",
    });
  },

  async getTransactions() {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("transaction_date", { ascending: false });

    if (error) throw error;
    return data as Transaction[];
  },

  async getJournalEntries() {
    return apiRequest<JournalEntry[]>(dataPath("journal_entries"));
  },

  async createTask(task: Partial<Task>) {
    return apiRequest<Task>(dataPath("tasks"), {
      method: "POST",
      body: JSON.stringify(task),
    });
  },

  async updateTask(id: string, updates: Partial<Task>) {
    return apiRequest<Task>(dataPathWithId("tasks", id), {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async deleteTask(id: string) {
    return apiRequest<Task>(dataPathWithId("tasks", id), {
      method: "DELETE",
    });
  },

  async toggleHabit(id: string, done: boolean) {
    const { data, error } = await supabase
      .from("habits")
      .update({ done })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createNote(note: Partial<Note>) {
    return apiRequest<Note>(dataPath("notes"), {
      method: "POST",
      body: JSON.stringify(note),
    });
  },

  async deleteNote(id: string) {
    return apiRequest<Note>(dataPathWithId("notes", id), {
      method: "DELETE",
    });
  },

  async createJournalEntry(entry: Partial<JournalEntry>) {
    return apiRequest<JournalEntry>(dataPath("journal_entries"), {
      method: "POST",
      body: JSON.stringify(entry),
    });
  },

  async deleteJournalEntry(id: string) {
    return apiRequest<JournalEntry>(dataPathWithId("journal_entries", id), {
      method: "DELETE",
    });
  },

  async createProject(project: Partial<Project>) {
    return apiRequest<Project>(dataPath("projects"), {
      method: "POST",
      body: JSON.stringify(project),
    });
  },

  async deleteProject(id: string) {
    return apiRequest<Project>(dataPathWithId("projects", id), {
      method: "DELETE",
    });
  },

  async getDashboardLayout() {
    const { data, error } = await supabase.from("dashboard_layouts").select("*").maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateDashboardLayout(layout: unknown) {
    const { data, error } = await supabase
      .from("dashboard_layouts")
      .upsert({ id: 1, layout, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getUsageSummary() {
    return apiRequest<UsageSummary>("/api/usage-summary");
  },

  async getDailyMemoryDigest() {
    return apiRequest<DailyMemoryDigest>("/api/memory/digest");
  },

  async reviewMemory(id: string, action: "approve" | "reject") {
    return apiRequest<{ success: boolean }>("/api/memory/digest", {
      method: "PATCH",
      body: JSON.stringify({ id, action }),
    });
  },
};
