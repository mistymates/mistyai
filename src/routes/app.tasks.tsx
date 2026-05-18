import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { useTasks } from "@/lib/hooks/use-data";
import { useToggleTask, useCreateTask, useDeleteTask } from "@/lib/hooks/use-mutations";
import type { Task } from "@/lib/types/database";
import { CreateItemDialog } from "@/components/CreateItemDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Misty" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const { mutate: toggleTask } = useToggleTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState<{
    title: string;
    priority: Task["priority"];
    dueDate: string;
  }>({ title: "", priority: "medium", dueDate: "" });

  const groups = ["Today", "Tomorrow", "This week"];

  const resetTaskForm = () => setNewTask({ title: "", priority: "medium", dueDate: "" });

  const handleTaskDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) resetTaskForm();
  };

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTask.title.trim();
    if (!title) return;

    try {
      await createTask.mutateAsync({
        title,
        done: false,
        priority: newTask.priority,
        due_date: newTask.dueDate ? new Date(`${newTask.dueDate}T00:00:00`).toISOString() : null,
      });
      toast.success("Task created");
      handleTaskDialogOpenChange(false);
    } catch {
      toast.error("Failed to create task");
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.filter((t) => !t.done).length} open · {tasks.filter((t) => t.done).length} done
          </p>
        </div>
        <CreateItemDialog
          open={isDialogOpen}
          onOpenChange={handleTaskDialogOpenChange}
          trigger={
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium">
              <Plus className="h-3.5 w-3.5" /> New task
            </button>
          }
          title="New Task"
          submitLabel="Save Task"
          submittingLabel="Saving..."
          isSubmitting={createTask.isPending}
          submitDisabled={!newTask.title.trim()}
          onSubmit={handleCreateTask}
        >
          <div className="space-y-2">
            <label
              htmlFor="task-title"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Title
            </label>
            <Input
              id="task-title"
              placeholder="e.g. Review launch checklist"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
            />
          </div>
          <div className="space-y-3">
            <label
              id="task-priority-label"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Priority
            </label>
            <ToggleGroup
              type="single"
              value={newTask.priority}
              onValueChange={(value) => {
                if (value) setNewTask({ ...newTask, priority: value as Task["priority"] });
              }}
              className="flex flex-wrap justify-start gap-2"
              aria-labelledby="task-priority-label"
            >
              {(["low", "medium", "high"] as const).map((priority) => (
                <ToggleGroupItem
                  key={priority}
                  value={priority}
                  className="px-3 py-1 h-auto rounded-full text-[10px] uppercase tracking-wider border border-white/10 data-[state=on]:bg-white/10 data-[state=on]:border-white/20 data-[state=on]:text-white hover:bg-white/5"
                >
                  {priority}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="task-due-date"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Due Date
            </label>
            <Input
              id="task-due-date"
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
            />
          </div>
        </CreateItemDialog>
      </header>

      {groups.map((g, gi) => {
        const list = tasks.filter((t: Task) => t.due === g || (!t.due && g === "Today"));
        if (list.length === 0) return null;
        return (
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
                <div
                  key={t.id}
                  className="group w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition text-left"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask({ id: t.id, done: !t.done })}
                    className="shrink-0"
                    aria-label={t.done ? "Mark task incomplete" : "Mark task complete"}
                  >
                    {t.done ? (
                      <CheckCircle2 className="h-4 w-4 text-[color:var(--mint)]" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTask({ id: t.id, done: !t.done })}
                    className={`flex-1 text-left text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}
                  >
                    {t.title}
                  </button>
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
                  <DeleteConfirmDialog
                    title="Delete task?"
                    description={`Delete "${t.title}"? This cannot be undone.`}
                    isPending={deleteTask.isPending}
                    onConfirm={() => handleDeleteTask(t)}
                    trigger={
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        disabled={deleteTask.isPending}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-[color:var(--rose)]/10 hover:text-[color:var(--rose)] group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        aria-label={`Delete task ${t.title}`}
                        title="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                </div>
              ))}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
