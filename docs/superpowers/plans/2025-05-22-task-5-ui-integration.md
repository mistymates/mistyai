# Task 5: UI Integration (Other Routes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock data in Tasks, Notes, Projects, and Calendar routes with real data from Supabase via React Query hooks.

**Architecture:** Use established hooks in `@/lib/hooks/use-data` which wrap `dataService` and `useQuery`. Implement loading states with `Skeleton` components. Use `date-fns` for date manipulation and formatting.

**Tech Stack:** React, TanStack Router, TanStack Query, Supabase, Framer Motion, Lucide React, date-fns, Tailwind CSS.

---

### Task 1: Update Tasks Route

**Files:**

- Modify: `src/routes/app.tasks.tsx`

- [ ] **Step 1: Replace mock data with useTasks hook**
- [ ] **Step 2: Implement grouping logic by due_date**
- [ ] **Step 3: Add loading and empty states**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Plus } from "lucide-react";
import { useTasks } from "@/lib/hooks/use-data";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Misty" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();

  const toggle = (id: string) => {
    // Note: Mutation will be handled in a later task or skipped as per Task 5 scope
    console.log("Toggle task", id);
  };

  const getGroup = (dueDate: string | null) => {
    if (!dueDate) return "Someday";
    const date = parseISO(dueDate);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isThisWeek(date)) return "This week";
    return format(date, "MMM d");
  };

  const groupedTasks = tasks.reduce(
    (acc, task) => {
      const group = getGroup(task.due_date);
      if (!acc[group]) acc[group] = [];
      acc[group].push(task);
      return acc;
    },
    {} as Record<string, typeof tasks>,
  );

  const groups = ["Today", "Tomorrow", "This week", "Someday"];

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.filter((t) => !t.done).length} open · {tasks.filter((t) => t.done).length} done
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium">
          <Plus className="h-3.5 w-3.5" /> New task
        </button>
      </header>

      {Object.entries(groupedTasks).map(([g, list], gi) => (
        <motion.section
          key={g}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.05 }}
          className="glass-card p-5"
        >
          <h2 className="font-display font-semibold mb-3">{g}</h2>
          <div className="space-y-1">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition text-left"
              >
                {t.done ? (
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--mint)] shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span
                  className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}
                >
                  {t.title}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    t.priority === "high"
                      ? "text-[color:var(--rose)]"
                      : t.priority === "medium"
                        ? "text-[color:var(--amber)]"
                        : "text-muted-foreground"
                  }`}
                >
                  {t.priority}
                </span>
              </button>
            ))}
          </div>
        </motion.section>
      ))}

      {tasks.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          No tasks found. Enjoy your day!
        </div>
      )}
    </div>
  );
}
```

### Task 2: Update Notes Route

**Files:**

- Modify: `src/routes/app.notes.tsx`

- [ ] **Step 1: Replace mock data with useNotes hook**
- [ ] **Step 2: Map Note fields and format dates**
- [ ] **Step 3: Add loading and empty states**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Search, Pin } from "lucide-react";
import { useNotes } from "@/lib/hooks/use-data";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/notes")({
  head: () => ({ meta: [{ title: "Notes — Misty" }] }),
  component: NotesPage,
});

function NotesPage() {
  const { data: notes = [], isLoading } = useNotes();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">A quiet place for thoughts.</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium">
          <Plus className="h-3.5 w-3.5" /> New note
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search notes…"
          className="w-full pl-9 h-10 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--violet)]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5 hover:border-white/20 transition cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-display font-semibold">{n.title}</h3>
              <Pin className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {n.excerpt}
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              {n.tag && <span className="px-2 py-0.5 rounded-full bg-white/5">#{n.tag}</span>}
              <span>{formatDistanceToNow(parseISO(n.updated_at), { addSuffix: true })}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {notes.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          No notes yet. Start writing...
        </div>
      )}
    </div>
  );
}
```

### Task 3: Update Projects Route

**Files:**

- Modify: `src/routes/app.projects.tsx`

- [ ] **Step 1: Replace mock data with useProjects and useTasks hooks**
- [ ] **Step 2: Map Project fields and implement Kanban grouping from Tasks**
- [ ] **Step 3: Add loading states**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useProjects, useTasks } from "@/lib/hooks/use-data";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/projects")({
  head: () => ({ meta: [{ title: "Projects — Misty" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();

  const kanbanGroups = {
    "To Do": tasks.filter((t) => !t.done),
    Done: tasks.filter((t) => t.done),
  };

  if (projectsLoading || tasksLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">{projects.length} active</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold">{p.name}</h3>
              <span className="text-xs text-muted-foreground">
                {p.tasks_done}/{p.tasks_count}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full bg-[color:var(--${p.color || "violet"})]`}
                style={{ width: `${p.progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2">{p.progress}% complete</div>
          </motion.div>
        ))}
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold mb-3">All Tasks — Board</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(kanbanGroups).map(([col, items], ci) => (
            <motion.div
              key={col}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.05 }}
              className="glass-card p-3 min-h-[300px]"
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold">{col}</h3>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-grab text-sm"
                  >
                    {it.title}
                    {/* Note: Tag field exists in Task schema but might need data mapping */}
                  </div>
                ))}
                <button className="w-full p-2 rounded-lg border border-dashed border-white/10 text-xs text-muted-foreground hover:border-white/20 transition flex items-center justify-center gap-1">
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

### Task 4: Update Calendar Route

**Files:**

- Modify: `src/routes/app.calendar.tsx`

- [ ] **Step 1: Replace mock data with useAgenda hook**
- [ ] **Step 2: Map Agenda fields and format time**
- [ ] **Step 3: Add loading states**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAgenda } from "@/lib/hooks/use-data";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Misty" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { data: agenda = [], isLoading } = useAgenda();
  const today = new Date();
  const month = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">{month}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-9 w-9 grid place-items-center rounded-lg glass hover:bg-white/10">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="h-9 w-9 grid place-items-center rounded-lg glass hover:bg-white/10">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-5 lg:col-span-2"
        >
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === today.getDate();
              // Simplified event indicator logic for real data
              const hasEvent = agenda.some((a) => new Date(a.start_time).getDate() === day);
              return (
                <button
                  key={day}
                  className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center gap-0.5 transition ${
                    isToday
                      ? "bg-gradient-to-br from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-semibold"
                      : "hover:bg-white/5"
                  }`}
                >
                  {day}
                  {hasEvent && !isToday && (
                    <div className="h-1 w-1 rounded-full bg-[color:var(--cyan)]" />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <h3 className="font-display font-semibold mb-3">Today</h3>
          <div className="space-y-2">
            {agenda.map((a) => (
              <div key={a.id} className="flex gap-3 p-2 rounded-lg hover:bg-white/5">
                <div className="text-xs font-mono text-muted-foreground w-12">
                  {format(parseISO(a.start_time), "HH:mm")}
                </div>
                <div className="text-sm flex-1">{a.title}</div>
              </div>
            ))}
            {agenda.length === 0 && (
              <div className="text-center py-10 text-xs text-muted-foreground">
                No events scheduled.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
```
