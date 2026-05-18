import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Loader2, Trash2, Pencil } from "lucide-react";
import { useProjects, useTasks } from "@/lib/hooks/use-data";
import { useCreateProject, useDeleteProject, useUpdateProject } from "@/lib/hooks/use-mutations";
import { useMemo, useState } from "react";
import { CreateItemDialog } from "@/components/CreateItemDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

export const Route = createFileRoute("/app/projects")({
  head: () => ({ meta: [{ title: "Projects — Misty" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    name: "",
    color: "violet",
    progress: "0",
    tasksCount: "0",
    tasksDone: "0",
  });

  const kanban = useMemo(() => {
    const byProject: Record<string, typeof tasks> = {};
    for (const task of tasks) {
      const project = projects.find((item) => item.id === task.project_id);
      const key = project?.name || "Unassigned";
      byProject[key] = [...(byProject[key] || []), task];
    }
    return byProject;
  }, [tasks, projects]);

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
      if (editingProjectId) {
        await updateProject.mutateAsync({
          id: editingProjectId,
          updates: {
            name,
            color: newProject.color,
            progress: clampNumber(newProject.progress, 0, 100),
            tasks_count: tasksCount,
            tasks_done: clampNumber(newProject.tasksDone, 0, tasksCount),
          },
        });
        toast.success("Project updated");
      } else {
        await createProject.mutateAsync({
          name,
          color: newProject.color,
          progress: clampNumber(newProject.progress, 0, 100),
          tasks_count: tasksCount,
          tasks_done: clampNumber(newProject.tasksDone, 0, tasksCount),
        });
        toast.success("Project created");
      }
      handleProjectDialogOpenChange(false);
    } catch {
      toast.error(editingProjectId ? "Failed to update project" : "Failed to create project");
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    try {
      await deleteProject.mutateAsync(id);
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <CreateItemDialog
          open={isDialogOpen}
          onOpenChange={handleProjectDialogOpenChange}
          trigger={
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium">
              <Plus className="h-3.5 w-3.5" /> New project
            </button>
          }
          title="New Project"
          submitLabel={editingProjectId ? "Save Changes" : "Save Project"}
          submittingLabel="Saving..."
          isSubmitting={createProject.isPending || updateProject.isPending}
          submitDisabled={!newProject.name.trim()}
          onSubmit={handleCreateProject}
        >
          <div className="space-y-2">
            <label
              htmlFor="project-name"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Name
            </label>
            <Input
              id="project-name"
              placeholder="e.g. Misty launch"
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
            />
          </div>
          <div className="space-y-3">
            <label
              id="project-color-label"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Color
            </label>
            <ToggleGroup
              type="single"
              value={newProject.color}
              onValueChange={(value) => {
                if (value) setNewProject({ ...newProject, color: value });
              }}
              className="flex flex-wrap justify-start gap-2"
              aria-labelledby="project-color-label"
            >
              {["violet", "cyan", "mint", "rose", "amber"].map((color) => (
                <ToggleGroupItem
                  key={color}
                  value={color}
                  className="px-3 py-1 h-auto rounded-full text-[10px] uppercase tracking-wider border border-white/10 data-[state=on]:bg-white/10 data-[state=on]:border-white/20 data-[state=on]:text-white hover:bg-white/5"
                >
                  {color}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="project-progress"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                Progress
              </label>
              <Input
                id="project-progress"
                type="number"
                min={0}
                max={100}
                value={newProject.progress}
                onChange={(e) => setNewProject({ ...newProject, progress: e.target.value })}
                className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="project-tasks-count"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                Tasks
              </label>
              <Input
                id="project-tasks-count"
                type="number"
                min={0}
                value={newProject.tasksCount}
                onChange={(e) => setNewProject({ ...newProject, tasksCount: e.target.value })}
                className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="project-tasks-done"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                Done
              </label>
              <Input
                id="project-tasks-done"
                type="number"
                min={0}
                value={newProject.tasksDone}
                onChange={(e) => setNewProject({ ...newProject, tasksDone: e.target.value })}
                className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
              />
            </div>
          </div>
        </CreateItemDialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.length === 0 && (
          <div className="col-span-full py-10 text-center glass-card">
            <p className="text-muted-foreground italic">No projects found.</p>
          </div>
        )}
        {projects.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card group p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold">{p.name}</h3>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">
                  {tasks.filter((task) => task.project_id === p.id && task.done).length}/
                  {tasks.filter((task) => task.project_id === p.id).length || p.tasks_count}
                </span>
                <button
                  type="button"
                  onClick={() => openEditProjectDialog(p.id)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-foreground group-hover:opacity-100"
                  aria-label={`Edit project ${p.name}`}
                  title="Edit project"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <DeleteConfirmDialog
                  title="Delete project?"
                  description={`Delete "${p.name}"? This cannot be undone.`}
                  isPending={deleteProject.isPending}
                  onConfirm={() => handleDeleteProject(p.id, p.name)}
                  trigger={
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      disabled={deleteProject.isPending}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-[color:var(--rose)]/10 hover:text-[color:var(--rose)] group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                      aria-label={`Delete project ${p.name}`}
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              </div>
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
        <h2 className="font-display text-lg font-semibold mb-3">Workspace Board</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(kanban).map(([col, items], ci) => (
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
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground italic py-10 text-center">
                    No tasks here.
                  </div>
                )}
                {items.map((it) => (
                  <div
                    key={it.id}
                    className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-grab text-sm"
                  >
                    {it.title}
                    <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {it.priority} priority {it.done ? "• done" : ""}
                    </div>
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
