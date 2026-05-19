export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  due_date: string | null;
  project_id?: string | null;
  due?: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  excerpt: string | null;
  tag: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  progress: number;
  color: string | null;
  tasks_count: number;
  tasks_done: number;
  created_at: string;
}

export interface Habit {
  id: string;
  name: string;
  streak: number;
  target: number;
  done: boolean;
  color: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  type: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: string | null;
  transaction_date: string;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string | null;
  read: boolean;
  type: string | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  source_type: "task" | "calendar" | "manual";
  source_id: string | null;
  title: string;
  message: string | null;
  scheduled_at: string;
  status: "pending" | "done" | "dismissed";
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  content: string;
  mood: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export type MemoryCategory = "Me" | "People" | "Preferences" | "Goals" | "Health" | "Relationships";

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number; // 1-5
  metadata: Record<string, unknown>;
  last_accessed_at: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryLink {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  strength: number;
  created_at: string;
}

export interface MemoryGraphResponse {
  memories: Memory[];
  links: MemoryLink[];
}
