import {
  useAgenda,
  useDailyMemoryDigest,
  useHabits,
  useJournalEntries,
  useNotes,
  useProjects,
  useReminders,
  useTasks,
  useWeather,
} from "./use-data";
import type { Habit, JournalEntry, Note, Project, Reminder, Task } from "@/lib/types/database";

export function useAIContext() {
  const { data: tasks = [] } = useTasks();
  const { data: agenda = [] } = useAgenda();
  const { data: notes = [] } = useNotes();
  const { data: weather } = useWeather();
  const { data: habits = [] } = useHabits();
  const { data: reminders = [] } = useReminders();
  const { data: projects = [] } = useProjects();
  const { data: journalEntries = [] } = useJournalEntries();
  const { data: memoryDigest } = useDailyMemoryDigest();

  const buildContextString = () => {
    let context = "\n\n--- CURRENT USER CONTEXT ---\n";
    context += `Time: ${new Date().toLocaleString()}\n`;

    if (weather) {
      context += `Weather: ${Math.round(weather.temperature)}°C in ${weather.city || "their location"}\n`;
    }

    const openTasks = tasks.filter((t: Task) => !t.done);
    if (openTasks.length > 0) {
      context += `\nOpen Tasks:\n${openTasks
        .map((t: Task) => `- [ ] ${t.title} (Priority: ${t.priority})`)
        .join("\n")}\n`;
    }

    if (agenda.length > 0) {
      context += `\nToday's Agenda:\n${agenda
        .map((a: { start_time: string; title: string }) => {
          const d = new Date(a.start_time);
          const timeStr = !isNaN(d.getTime())
            ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "All day";
          return `- ${timeStr}: ${a.title}`;
        })
        .join("\n")}\n`;
    }

    if (notes.length > 0) {
      context += `\nRecent Notes:\n${notes
        .slice(0, 3)
        .map((n: Note) => `- ${n.title}: ${n.excerpt || ""}`)
        .join("\n")}\n`;
    }

    if (habits.length > 0) {
      context += `\nHabits Tracker:\n${habits
        .map((h: Habit) => `- ${h.name}: ${h.done ? "Done" : "Pending"} (Streak: ${h.streak})`)
        .join("\n")}\n`;
    }

    const dueReminders = reminders
      .filter((reminder: Reminder) => reminder.status === "pending")
      .slice(0, 5);
    if (dueReminders.length > 0) {
      context += `\nPending Reminders:\n${dueReminders
        .map(
          (reminder) =>
            `- ${reminder.title} at ${new Date(reminder.scheduled_at).toLocaleString()}`,
        )
        .join("\n")}\n`;
    }

    if (projects.length > 0) {
      context += `\nProjects:\n${projects
        .slice(0, 5)
        .map((project: Project) => `- ${project.name}: ${project.progress}% complete`)
        .join("\n")}\n`;
    }

    if (journalEntries.length > 0) {
      context += `\nRecent Journal Signals:\n${journalEntries
        .slice(0, 3)
        .map(
          (entry: JournalEntry) => `- ${entry.mood || "No mood"}: ${entry.content.slice(0, 120)}`,
        )
        .join("\n")}\n`;
    }

    if (memoryDigest) {
      context += `\nMemory Digest: ${memoryDigest.totals.pending} pending, ${memoryDigest.totals.approved} approved today, ${memoryDigest.totals.rejected} rejected today.\n`;
    }

    context += "---------------------------\n";
    return context.length > 6000 ? `${context.slice(0, 6000)}\n[Context trimmed]\n` : context;
  };

  return { buildContextString };
}
