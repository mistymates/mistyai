import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Pencil, Plus, Trash2 } from "lucide-react";
import { useProjects, useTasks } from "@/lib/hooks/use-data";
import {
  useToggleTask,
  useCreateTask,
  useDeleteTask,
  useUpdateTask,
  useCreateReminder,
} from "@/lib/hooks/use-mutations";
import type { Task } from "@/lib/types/database";
import { CreateItemDialog } from "@/components/CreateItemDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { DropdownSelect } from "@/components/DropdownSelect";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Misty" }] }),
  component: TasksPage,
});

function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: projects = [] } = useProjects();
  const { mutate: toggleTask } = useToggleTask();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createReminder = useCreateReminder();
  const deleteTask = useDeleteTask();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<{
    title: string;
    priority: Task["priority"];
    dueDate: string;
    dueTime: string;
    projectId: string;
  }>({ title: "", priority: "medium", dueDate: "", dueTime: "", projectId: "none" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editTaskId = params.get("editTask");
    if (!editTaskId) return;
    const task = tasks.find((item) => item.id === editTaskId);
    if (!task) return;
    openEditTaskDialog(task);
    params.delete("editTask");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [tasks]);

  const groups = ["Today", "Tomorrow", "This week"];
  const groupedTasks = groups.map((group) => ({
    group,
    list: tasks.filter((task: Task) => task.due === group || (!task.due && group === "Today")),
  }));
  const hasVisibleTasks = groupedTasks.some(({ list }) => list.length > 0);

  const resetTaskForm = () =>
    setNewTask({ title: "", priority: "medium", dueDate: "", dueTime: "", projectId: "none" });

  const handleTaskDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingTaskId(null);
      resetTaskForm();
    }
  };

  function openEditTaskDialog(task: Task) {
    const due = task.due_date ? new Date(task.due_date) : null;
    const dueDate =
      due && !Number.isNaN(due.getTime())
        ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(
            due.getDate(),
          ).padStart(2, "0")}`
        : "";
    const dueTime =
      due && !Number.isNaN(due.getTime())
        ? `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`
        : "";

    setEditingTaskId(task.id);
    setNewTask({
      title: task.title,
      priority: task.priority,
      dueDate,
      dueTime,
      projectId: task.project_id || "none",
    });
    setIsDialogOpen(true);
  }

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTask.title.trim();
    if (!title) return;
    const hasDueDate = Boolean(newTask.dueDate);
    const dueDateTime = hasDueDate
      ? new Date(`${newTask.dueDate}T${newTask.dueTime || "00:00"}:00`)
      : null;

    try {
      if (editingTaskId) {
        await updateTask.mutateAsync({
          id: editingTaskId,
          updates: {
            title,
            priority: newTask.priority,
            due_date: dueDateTime ? dueDateTime.toISOString() : null,
            project_id: newTask.projectId === "none" ? null : newTask.projectId,
          },
        });
        toast.success("Task updated");
      } else {
        const createdTask = await createTask.mutateAsync({
          title,
          done: false,
          priority: newTask.priority,
          due_date: dueDateTime ? dueDateTime.toISOString() : null,
          project_id: newTask.projectId === "none" ? null : newTask.projectId,
        });
        if (dueDateTime) {
          await createReminder.mutateAsync({
            source_type: "task",
            source_id: createdTask.id,
            title: `Task due: ${title}`,
            message: "This task is due now.",
            scheduled_at: dueDateTime.toISOString(),
            status: "pending",
          });
        }
        toast.success("Task created");
      }
      handleTaskDialogOpenChange(false);
    } catch {
      toast.error(editingTaskId ? "Failed to update task" : "Failed to create task");
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
      <header className="flex flex-wrap items-center justify-between gap-3">
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
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="h-3.5 w-3.5" /> New task
            </button>
          }
          title={editingTaskId ? "Edit Task" : "New Task"}
          submitLabel={editingTaskId ? "Save Changes" : "Save Task"}
          submittingLabel="Saving..."
          isSubmitting={createTask.isPending || updateTask.isPending}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="task-due-date"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                Date
              </label>
              <Input
                id="task-due-date"
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="task-due-time"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                Time
              </label>
              <Input
                id="task-due-time"
                type="time"
                value={newTask.dueTime}
                onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
                className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Project
            </label>
            <DropdownSelect
              value={newTask.projectId}
              onChange={(value) => setNewTask({ ...newTask, projectId: value })}
              options={[
                { value: "none", label: "No project" },
                ...projects.map((project) => ({ value: project.id, label: project.name })),
              ]}
              ariaLabel="Select project for task"
              className="h-9 rounded-md"
            />
          </div>
        </CreateItemDialog>
      </header>

      {!isLoading && !hasVisibleTasks && (
        <section className="glass-card p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-6 w-6 text-[color:var(--mint)]" />
          <h2 className="font-display text-lg font-semibold">No tasks on deck.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a task when something deserves your attention.
          </p>
        </section>
      )}

      {groupedTasks.map(({ group: g, list }, gi) => {
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
                    className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t.done ? "Mark task incomplete" : "Mark task complete"}
                    aria-pressed={t.done}
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
                    className={`min-w-0 flex-1 rounded text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${t.done ? "line-through text-muted-foreground" : ""}`}
                    aria-label={t.done ? `Mark ${t.title} incomplete` : `Mark ${t.title} complete`}
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
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditTaskDialog(t);
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Edit task ${t.title}`}
                    title="Edit task"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
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
