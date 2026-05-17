import { useTasks, useAgenda, useNotes, useWeather, useHabits } from "./use-data";
import type { Task, Note, Habit } from "@/lib/types/database";

export function useAIContext() {
  const { data: tasks = [] } = useTasks();
  const { data: agenda = [] } = useAgenda();
  const { data: notes = [] } = useNotes();
  const { data: weather } = useWeather();
  const { data: habits = [] } = useHabits();

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

    context += "---------------------------\n";
    return context;
  };

  return { buildContextString };
}
