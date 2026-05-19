import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  MessageSquareText,
  StickyNote,
  CheckSquare,
  Calendar,
  BookHeart,
  BarChart3,
  Settings,
  Brain,
  FolderKanban,
  HeartPulse,
  Sparkles,
  Plus,
  Mic,
} from "lucide-react";
import { useAssistant } from "@/lib/assistant-store";
import { useTasks, useNotes, useProjects } from "@/lib/hooks/use-data";
import {
  useCreateTask,
  useCreateNote,
  useCreateProject,
  useCreateCalendarEvent,
  useCreateMemory,
  useCreateReminder,
} from "@/lib/hooks/use-mutations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { onAssistantIntent } from "@/lib/assistant-intents";

const navItems = [
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
  { title: "AI Chat", url: "/app/chat", icon: MessageSquareText },
  { title: "Notes", url: "/app/notes", icon: StickyNote },
  { title: "Tasks", url: "/app/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/app/calendar", icon: Calendar },
  { title: "Journal", url: "/app/journal", icon: BookHeart },
  { title: "Projects", url: "/app/projects", icon: FolderKanban },
  { title: "Analytics", url: "/app/analytics", icon: BarChart3 },
  { title: "Health", url: "/app/health", icon: HeartPulse },
  { title: "Memory Vault", url: "/app/memory", icon: Brain },
  { title: "Settings", url: "/app/settings", icon: Settings },
] as const;

type CaptureKind = "task" | "note" | "project" | "event" | "memory" | null;

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function parseQuickCaptureDate(text: string) {
  const now = new Date();
  const lower = text.toLowerCase();
  const date = new Date(now);
  let matched = false;

  if (/\btomorrow\b/.test(lower)) {
    date.setDate(now.getDate() + 1);
    matched = true;
  } else if (/\btoday\b/.test(lower)) {
    matched = true;
  } else {
    const isoDate = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (isoDate) {
      const parsed = new Date(`${isoDate[1]}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        date.setFullYear(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        matched = true;
      }
    }
  }

  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] || "0");
    const period = timeMatch[3];
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      date.setHours(hours, minutes, 0, 0);
      matched = true;
    }
  } else {
    date.setHours(9, 0, 0, 0);
  }

  const cleaned = text
    .replace(/\b(today|tomorrow)\b/gi, "")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, "")
    .replace(/\bp([123])\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const priorityMatch = lower.match(/\bp([123])\b/);
  const priority =
    priorityMatch?.[1] === "1" ? "high" : priorityMatch?.[1] === "3" ? "low" : "medium";

  return {
    title: cleaned || text,
    dueDate: matched ? date : null,
    priority: priority as "low" | "medium" | "high",
    dateKey: toDateInputValue(date),
  };
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [captureKind, setCaptureKind] = useState<CaptureKind>(null);
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const openAssistant = useAssistant((s) => s.setOpen);

  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: projects = [] } = useProjects();

  const createTask = useCreateTask();
  const createNote = useCreateNote();
  const createProject = useCreateProject();
  const createCalendarEvent = useCreateCalendarEvent();
  const createMemory = useCreateMemory();
  const createReminder = useCreateReminder();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return onAssistantIntent((intent) => {
      if (intent.type === "search_mode") {
        setOpen(true);
      }
    });
  }, []);

  const go = (url: string) => {
    setOpen(false);
    navigate({ to: url });
  };

  const openCapture = (kind: CaptureKind) => {
    setValue("");
    setCaptureKind(kind);
    setOpen(false);
  };

  const saveCapture = async () => {
    const text = value.trim();
    if (!text || !captureKind) return;

    try {
      if (captureKind === "task") {
        const parsed = parseQuickCaptureDate(text);
        const createdTask = await createTask.mutateAsync({
          title: parsed.title,
          done: false,
          priority: parsed.priority,
          due_date: parsed.dueDate?.toISOString() ?? null,
        });
        if (parsed.dueDate) {
          await createReminder.mutateAsync({
            source_type: "task",
            source_id: createdTask.id,
            title: `Task due: ${parsed.title}`,
            message: "This task is due now.",
            scheduled_at: parsed.dueDate.toISOString(),
            status: "pending",
          });
        }
      }
      if (captureKind === "note")
        await createNote.mutateAsync({ title: text, excerpt: "", tag: null });
      if (captureKind === "project")
        await createProject.mutateAsync({ name: text, progress: 0, tasks_count: 0, tasks_done: 0 });
      if (captureKind === "event") {
        const parsed = parseQuickCaptureDate(text);
        await createCalendarEvent.mutateAsync({
          title: parsed.title,
          start_time: (parsed.dueDate ?? new Date()).toISOString(),
          end_time: null,
          type: "event",
        });
      }
      if (captureKind === "memory")
        await createMemory.mutateAsync({ content: text, category: "Me" });
      toast.success("Created");
      setCaptureKind(null);
      setValue("");
    } catch {
      toast.error("Failed to create item");
    }
  };

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search tasks, notes, projects, or jump anywhere..." />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Quick actions">
            <CommandItem
              onSelect={() => {
                setOpen(false);
                openAssistant(true);
              }}
            >
              <Sparkles className="text-[color:var(--violet)]" />
              <span>Ask Misty</span>
              <kbd className="ml-auto text-[10px] text-muted-foreground">Cmd+J</kbd>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                openAssistant(true);
              }}
            >
              <Mic className="text-[color:var(--cyan)]" />
              <span>Start voice session</span>
            </CommandItem>
            <CommandItem onSelect={() => openCapture("task")}>
              <Plus />
              <span>New task</span>
            </CommandItem>
            <CommandItem onSelect={() => openCapture("note")}>
              <Plus />
              <span>New note</span>
            </CommandItem>
            <CommandItem onSelect={() => openCapture("project")}>
              <Plus />
              <span>New project</span>
            </CommandItem>
            <CommandItem onSelect={() => openCapture("event")}>
              <Plus />
              <span>New event</span>
            </CommandItem>
            <CommandItem onSelect={() => openCapture("memory")}>
              <Plus />
              <span>New memory</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigate">
            {navItems.map((n) => (
              <CommandItem key={n.url} onSelect={() => go(n.url)} value={`go ${n.title}`}>
                <n.icon />
                <span>{n.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{n.url}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Tasks">
            {tasks.map((t) => (
              <CommandItem key={t.id} onSelect={() => go("/app/tasks")} value={`task ${t.title}`}>
                <CheckSquare className={t.done ? "text-[color:var(--mint)]" : ""} />
                <span className={t.done ? "line-through text-muted-foreground" : ""}>
                  {t.title}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {t.due_date ? new Date(t.due_date).toLocaleDateString() : ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Notes">
            {notes.map((n) => (
              <CommandItem key={n.id} onSelect={() => go("/app/notes")} value={`note ${n.title}`}>
                <StickyNote />
                <span>{n.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {new Date(n.updated_at).toLocaleDateString()}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem
                key={p.id}
                onSelect={() => go("/app/projects")}
                value={`project ${p.name}`}
              >
                <FolderKanban />
                <span>{p.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{p.progress}%</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Dialog
        open={captureKind !== null}
        onOpenChange={(isOpen) => !isOpen && setCaptureKind(null)}
      >
        <DialogContent className="bg-black/90 border-white/10 backdrop-blur-xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {captureKind ? `New ${captureKind}` : "Quick capture"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {captureKind === "memory" ? (
              <Textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Memory content"
              />
            ) : (
              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Title"
              />
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setCaptureKind(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveCapture()} disabled={!value.trim()}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
