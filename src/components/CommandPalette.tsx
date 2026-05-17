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

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const openAssistant = useAssistant((s) => s.setOpen);

  const { data: tasks = [] } = useTasks();
  const { data: notes = [] } = useNotes();
  const { data: projects = [] } = useProjects();

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

  const go = (url: string) => {
    setOpen(false);
    navigate({ to: url });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tasks, notes, projects, or jump anywhere…" />
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
            <kbd className="ml-auto text-[10px] text-muted-foreground">⌘J</kbd>
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
          <CommandItem onSelect={() => go("/app/tasks")}>
            <Plus />
            <span>New task</span>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/notes")}>
            <Plus />
            <span>New note</span>
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
              <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.title}</span>
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
  );
}
