import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, List, Orbit, Plus, Search, Trash2, X, Pencil } from "lucide-react";
import { useMemories } from "@/lib/hooks/use-data";
import { useCreateMemory, useDeleteMemory, useUpdateMemory } from "@/lib/hooks/use-mutations";
import { MemoryCategory } from "@/lib/types/database";
import { memoryService } from "@/lib/services/memory-service";
import { OrbitalMemoryVault } from "@/components/memory/OrbitalMemoryVault";
import { CreateItemDialog } from "@/components/CreateItemDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

export const Route = createFileRoute("/app/memory")({
  head: () => ({ meta: [{ title: "Memory Vault - Misty" }] }),
  component: MemoryPage,
});

const CATEGORIES: ("All" | MemoryCategory)[] = [
  "All",
  "Me",
  "People",
  "Preferences",
  "Goals",
  "Health",
  "Relationships",
];

function MemoryPage() {
  const { data: memories = [], isLoading } = useMemories();
  const { data: memoryGraph } = useQuery({
    queryKey: ["memory-graph"],
    queryFn: () => memoryService.getMemoryGraph({ limit: 50 }),
    retry: false,
    initialData: { memories: [], links: [] },
  });
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"All" | MemoryCategory>("All");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState<{ content: string; category: MemoryCategory }>({
    content: "",
    category: "Me",
  });

  const filteredMemories = memories.filter((m) => {
    const matchesSearch = m.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "All" || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const filteredMemoryLinks = useMemo(() => {
    const includedIds = new Set(filteredMemories.map((memory) => memory.id));
    return memoryGraph.links.filter(
      (link) => includedIds.has(link.source_id) && includedIds.has(link.target_id),
    );
  }, [filteredMemories, memoryGraph.links]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.content.trim()) return;

    try {
      if (editingMemoryId) {
        await updateMemory.mutateAsync({
          id: editingMemoryId,
          updates: { content: newMemory.content, category: newMemory.category },
        });
      } else {
        await createMemory.mutateAsync({
          content: newMemory.content,
          category: newMemory.category,
        });
      }
      setNewMemory({ content: "", category: "Me" });
      setEditingMemoryId(null);
      setIsDialogOpen(false);
      toast.success(editingMemoryId ? "Memory updated" : "Memory added to the vault");
    } catch (error) {
      toast.error(editingMemoryId ? "Failed to update memory" : "Failed to add memory");
    }
  };

  const handleMemoryDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingMemoryId(null);
      setNewMemory({ content: "", category: "Me" });
    }
  };

  const openEditMemory = (id: string) => {
    const memory = memories.find((item) => item.id === id);
    if (!memory) return;
    setEditingMemoryId(id);
    setNewMemory({ content: memory.content, category: memory.category });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setMemoryToDelete(id);
  };

  const confirmDeleteMemory = async () => {
    if (!memoryToDelete) return;

    try {
      await deleteMemory.mutateAsync(memoryToDelete);
      toast.success("Memory removed");
    } catch (error) {
      toast.error("Failed to remove memory");
    } finally {
      setMemoryToDelete(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
            <Brain className="h-7 w-7 text-[color:var(--violet)]" /> Memory Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What Misty remembers about you. Edit anytime — it's yours.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition ${
                viewMode === "map"
                  ? "bg-white text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Orbit className="h-3.5 w-3.5" /> Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs transition ${
                viewMode === "list"
                  ? "bg-white text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>

          <CreateItemDialog
            open={isDialogOpen}
            onOpenChange={handleMemoryDialogOpenChange}
            trigger={
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium hover:opacity-90 transition">
                <Plus className="h-3.5 w-3.5" /> {editingMemoryId ? "Edit memory" : "Add memory"}
              </button>
            }
            title={editingMemoryId ? "Edit Memory" : "New Memory"}
            submitLabel={editingMemoryId ? "Save Changes" : "Save Memory"}
            submittingLabel="Saving..."
            isSubmitting={createMemory.isPending || updateMemory.isPending}
            submitDisabled={!newMemory.content.trim()}
            onSubmit={handleAddMemory}
          >
            <div className="space-y-2">
              <label
                htmlFor="memory-content"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                What should Misty remember?
              </label>
              <Textarea
                id="memory-content"
                placeholder="e.g. Maya's birthday is March 14."
                value={newMemory.content}
                onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                className="bg-white/5 border-white/10 min-h-[100px] resize-none focus-visible:ring-[color:var(--violet)]"
              />
            </div>
            <div className="space-y-3">
              <label
                id="category-label"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                Category
              </label>
              <ToggleGroup
                type="single"
                value={newMemory.category}
                onValueChange={(value) => {
                  if (value) setNewMemory({ ...newMemory, category: value as MemoryCategory });
                }}
                className="flex flex-wrap justify-start gap-2"
                aria-labelledby="category-label"
              >
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <ToggleGroupItem
                    key={c}
                    value={c}
                    className="px-3 py-1 h-auto rounded-full text-[10px] uppercase tracking-wider border border-white/10 data-[state=on]:bg-white/10 data-[state=on]:border-white/20 data-[state=on]:text-white hover:bg-white/5"
                  >
                    {c}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </CreateItemDialog>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          aria-label="Search memories"
          placeholder="Search memories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 h-10 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--violet)] transition-all"
        />
        {search && (
          <button
            aria-label="Clear search"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCategory(c)}
            className={`px-3 py-1 rounded-full text-xs border transition ${
              selectedCategory === c
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/10"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-5 h-32 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : viewMode === "map" ? (
        <OrbitalMemoryVault
          memories={filteredMemories}
          links={filteredMemoryLinks}
          onDeleteMemory={handleDelete}
          onSelectCategory={setSelectedCategory}
        />
      ) : filteredMemories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredMemories.map((m) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="glass-card p-5 hover:border-white/20 transition group relative"
              >
                <button
                  aria-label="Delete memory"
                  onClick={() => handleDelete(m.id)}
                  className="absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 transition hover:text-red-400 hover:bg-red-400/10 rounded-lg"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  aria-label="Edit memory"
                  onClick={() => openEditMemory(m.id)}
                  className="absolute top-3 right-12 p-2 opacity-0 group-hover:opacity-100 transition hover:text-foreground hover:bg-white/10 rounded-lg"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <div className="flex justify-between items-start mb-3">
                  <div className="px-2 py-0.5 rounded-full bg-[color:var(--cyan)]/10 text-[color:var(--cyan)] text-[9px] font-bold uppercase tracking-widest border border-[color:var(--cyan)]/20">
                    {m.category || "General"}
                  </div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 w-3 rounded-full ${
                          i < (m.importance || 3) ? "bg-[color:var(--violet)]" : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm leading-relaxed pr-8">{m.content}</p>
                <div className="mt-4 text-[10px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="py-20 text-center">
          <Brain className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No memories found</h3>
          <p className="text-sm text-muted-foreground/60">
            {search || selectedCategory !== "All"
              ? "Try adjusting your filters"
              : "Add your first memory to get started"}
          </p>
        </div>
      )}
      <DeleteConfirmDialog
        open={Boolean(memoryToDelete)}
        onOpenChange={(open) => {
          if (!open) setMemoryToDelete(null);
        }}
        title="Delete memory?"
        description="Delete this memory from the vault? This cannot be undone."
        isPending={deleteMemory.isPending}
        onConfirm={confirmDeleteMemory}
      />
    </div>
  );
}
