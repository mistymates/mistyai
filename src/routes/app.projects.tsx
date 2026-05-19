import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useProjects, useTasks } from "@/lib/hooks/use-data";
import {
  useCreateProject,
  useCreateTask,
  useDeleteProject,
  useToggleTask,
  useUpdateProject,
  useUpdateTask,
} from "@/lib/hooks/use-mutations";
import { useState } from "react";
import { CreateItemDialog } from "@/components/CreateItemDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

export const Route = createFileRoute("/app/projects")({
  head: () => ({ meta: [{ title: "Projects - Misty" }] }),
  component: ProjectsPage,
});

type TaskPriority = "low" | "medium" | "high";

function ProjectsPage() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { mutate: toggleTask } = useToggleTask();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [taskDialogProjectId, setTaskDialogProjectId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    color: "violet",
    progress: "0",
    tasksCount: "0",
    tasksDone: "0",
  });
  const [taskDraft, setTaskDraft] = useState<{ title: string; priority: TaskPriority }>({
    title: "",
    priority: "medium",
  });

  const isLoading = projectsLoading || tasksLoading;

  const resetProjectForm = () =>
    setNewProject({ name: "", color: "violet", progress: "0", tasksCount: "0", tasksDone: "0" });

  const handleProjectDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingProjectId(null);
      resetProjectForm();
    }
  };

  const openEditProjectDialog = (id: string) => {
    const project = projects.find((item) => item.id === id);
    if (!project) return;
    setEditingProjectId(id);
    setNewProject({
      name: project.name,
      color: project.color || "violet",
      progress: String(project.progress),
      tasksCount: String(project.tasks_count),
      tasksDone: String(project.tasks_done),
    });
    setIsDialogOpen(true);
  };

  const clampNumber = (value: string, min: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(Math.max(Math.round(parsed), min), max);
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newProject.name.trim();
    if (!name) return;

    try {
      const tasksCount = clampNumber(newProject.tasksCount, 0, 999);
      const payload = {
        name,
        color: newProject.color,
        progress: clampNumber(newProject.progress, 0, 100),
        tasks_count: tasksCount,
        tasks_done: clampNumber(newProject.tasksDone, 0, tasksCount),
      };

      if (editingProjectId) {
        await updateProject.mutateAsync({ id: editingProjectId, updates: payload });
        toast.success("Project updated");
      } else {
        await createProject.mutateAsync(payload);
        toast.success("Project created");
      }
      handleProjectDialogOpenChange(false);
    } catch {
      toast.error(editingProjectId ? "Failed to update project" : "Failed to create project");
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject.mutateAsync(id);
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  };

  const openTaskDialog = (projectId: string, taskId?: string) => {
    const task = taskId ? tasks.find((item) => item.id === taskId) : null;
    setTaskDialogProjectId(projectId);
    setEditingTaskId(task?.id ?? null);
    setTaskDraft({ title: task?.title ?? "", priority: task?.priority ?? "medium" });
  };

  const closeTaskDialog = () => {
    setTaskDialogProjectId(null);
    setEditingTaskId(null);
    setTaskDraft({ title: "", priority: "medium" });
  };

  const saveProjectTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskDraft.title.trim();
    if (!title || !taskDialogProjectId) return;

    try {
      if (editingTaskId) {
        await updateTask.mutateAsync({
          id: editingTaskId,
          updates: { title, priority: taskDraft.priority },
        });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync({
          title,
          done: false,
          priority: taskDraft.priority,
          project_id: taskDialogProjectId,
        });
        toast.success("Task added");
      }
      closeTaskDialog();
    } catch {
      toast.error(editingTaskId ? "Failed to update task" : "Failed to add task");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">{projects.length} active</p>
        </div>
        <ProjectDialog
          open={isDialogOpen}
          editing={Boolean(editingProjectId)}
          project={newProject}
          isSubmitting={createProject.isPending || updateProject.isPending}
          onOpenChange={handleProjectDialogOpenChange}
          onProjectChange={setNewProject}
          onSubmit={handleCreateProject}
        />
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {projects.length === 0 && (
          <div className="glass-card col-span-full py-10 text-center">
            <p className="text-muted-foreground italic">No projects found.</p>
          </div>
        )}
        {projects.map((project, index) => {
          const projectTasks = tasks.filter((task) => task.project_id === project.id);
          const doneCount = projectTasks.filter((task) => task.done).length;
          const progress =
            projectTasks.length > 0
              ? Math.round((doneCount / projectTasks.length) * 100)
              : project.progress;

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card group p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display font-semibold">{project.name}</h3>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {doneCount}/{projectTasks.length || project.tasks_count}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditProjectDialog(project.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-foreground group-hover:opacity-100"
                    aria-label={`Edit project ${project.name}`}
                    title="Edit project"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <DeleteConfirmDialog
                    title="Delete project?"
                    description={`Delete "${project.name}"? This cannot be undone.`}
                    isPending={deleteProject.isPending}
                    onConfirm={() => handleDeleteProject(project.id)}
                    trigger={
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        disabled={deleteProject.isPending}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-[color:var(--rose)]/10 hover:text-[color:var(--rose)] group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        aria-label={`Delete project ${project.name}`}
                        title="Delete project"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full bg-[color:var(--${project.color || "violet"})]`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{progress}% complete</div>
            </motion.div>
          );
        })}
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Workspace Board</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project, columnIndex) => {
            const projectTasks = tasks.filter((task) => task.project_id === project.id);
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: columnIndex * 0.05 }}
                className="glass-card min-h-[300px] p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold">{project.name}</h3>
                  <span className="text-xs text-muted-foreground">{projectTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {projectTasks.length === 0 && (
                    <div className="py-10 text-center text-xs italic text-muted-foreground">
                      No tasks here.
                    </div>
                  )}
                  {projectTasks.map((task) => (
                    <div
                      key={task.id}
                      className="group/task rounded-lg border border-white/5 bg-white/5 p-3 text-sm transition hover:bg-white/10"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTask({ id: task.id, done: !task.done })}
                          className="mt-0.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={task.done ? "Mark task incomplete" : "Mark task complete"}
                        >
                          {task.done ? (
                            <CheckCircle2 className="h-4 w-4 text-[color:var(--mint)]" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        <span className={task.done ? "line-through text-muted-foreground" : ""}>
                          {task.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => openTaskDialog(project.id, task.id)}
                          className="ml-auto grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-foreground group-hover/task:opacity-100"
                          aria-label={`Edit task ${task.title}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {task.priority} priority {task.done ? " - done" : ""}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => openTaskDialog(project.id)}
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-white/10 p-2 text-xs text-muted-foreground transition hover:border-white/20"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <CreateItemDialog
        open={Boolean(taskDialogProjectId)}
        onOpenChange={(open) => {
          if (!open) closeTaskDialog();
        }}
        trigger={
          <button type="button" className="hidden" tabIndex={-1}>
            Open task dialog
          </button>
        }
        title={editingTaskId ? "Edit Task" : "Add Task"}
        submitLabel={editingTaskId ? "Save Changes" : "Add Task"}
        submittingLabel="Saving..."
        isSubmitting={createTask.isPending || updateTask.isPending}
        submitDisabled={!taskDraft.title.trim()}
        onSubmit={saveProjectTask}
      >
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Title
          </label>
          <Input
            value={taskDraft.title}
            onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })}
            className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
          />
        </div>
        <div className="space-y-3">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Priority
          </label>
          <ToggleGroup
            type="single"
            value={taskDraft.priority}
            onValueChange={(value) => {
              if (value) setTaskDraft({ ...taskDraft, priority: value as TaskPriority });
            }}
            className="flex flex-wrap justify-start gap-2"
          >
            {(["low", "medium", "high"] as const).map((priority) => (
              <ToggleGroupItem
                key={priority}
                value={priority}
                className="h-auto rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider hover:bg-white/5 data-[state=on]:border-white/20 data-[state=on]:bg-white/10 data-[state=on]:text-white"
              >
                {priority}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CreateItemDialog>
    </div>
  );
}

function ProjectDialog({
  open,
  editing,
  project,
  isSubmitting,
  onOpenChange,
  onProjectChange,
  onSubmit,
}: {
  open: boolean;
  editing: boolean;
  project: {
    name: string;
    color: string;
    progress: string;
    tasksCount: string;
    tasksDone: string;
  };
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectChange: (project: {
    name: string;
    color: string;
    progress: string;
    tasksCount: string;
    tasksDone: string;
  }) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <CreateItemDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] px-4 py-2 text-sm font-medium text-black">
          <Plus className="h-3.5 w-3.5" /> New project
        </button>
      }
      title={editing ? "Edit Project" : "New Project"}
      submitLabel={editing ? "Save Changes" : "Save Project"}
      submittingLabel="Saving..."
      isSubmitting={isSubmitting}
      submitDisabled={!project.name.trim()}
      onSubmit={onSubmit}
    >
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Name
        </label>
        <Input
          placeholder="e.g. Misty launch"
          value={project.name}
          onChange={(event) => onProjectChange({ ...project, name: event.target.value })}
          className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
        />
      </div>
      <div className="space-y-3">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Color
        </label>
        <ToggleGroup
          type="single"
          value={project.color}
          onValueChange={(value) => {
            if (value) onProjectChange({ ...project, color: value });
          }}
          className="flex flex-wrap justify-start gap-2"
        >
          {["violet", "cyan", "mint", "rose", "amber"].map((color) => (
            <ToggleGroupItem
              key={color}
              value={color}
              className="h-auto rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-wider hover:bg-white/5 data-[state=on]:border-white/20 data-[state=on]:bg-white/10 data-[state=on]:text-white"
            >
              {color}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Progress", "progress"],
          ["Tasks", "tasksCount"],
          ["Done", "tasksDone"],
        ].map(([label, key]) => (
          <div key={key} className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </label>
            <Input
              type="number"
              min={0}
              max={key === "progress" ? 100 : undefined}
              value={project[key as "progress" | "tasksCount" | "tasksDone"]}
              onChange={(event) => onProjectChange({ ...project, [key]: event.target.value })}
              className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
            />
          </div>
        ))}
      </div>
    </CreateItemDialog>
  );
}
