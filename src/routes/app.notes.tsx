import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Plus, Search, Pin, Loader2, Trash2, Pencil } from "lucide-react";
import { useNotes } from "@/lib/hooks/use-data";
import { useCreateNote, useDeleteNote, useUpdateNote } from "@/lib/hooks/use-mutations";
import { CreateItemDialog } from "@/components/CreateItemDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { DropdownSelect } from "@/components/DropdownSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notes")({
  head: () => ({ meta: [{ title: "Notes - Misty" }] }),
  component: NotesPage,
});

function NotesPage() {
  const { data: notes = [], isLoading } = useNotes();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortMode, setSortMode] = useState("recent");
  const [newNote, setNewNote] = useState({ title: "", excerpt: "", tag: "" });

  const resetNoteForm = () => setNewNote({ title: "", excerpt: "", tag: "" });

  const handleNoteDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingNoteId(null);
      resetNoteForm();
    }
  };

  const openEditDialog = (id: string) => {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    setEditingNoteId(id);
    setNewNote({
      title: note.title,
      excerpt: note.excerpt || "",
      tag: note.tag || "",
    });
    setIsDialogOpen(true);
  };

  const handleSaveNote = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newNote.title.trim();
    if (!title) return;

    try {
      if (editingNoteId) {
        await updateNote.mutateAsync({
          id: editingNoteId,
          updates: {
            title,
            excerpt: newNote.excerpt.trim(),
            tag: newNote.tag.trim() || null,
          },
        });
        toast.success("Note updated");
      } else {
        await createNote.mutateAsync({
          title,
          excerpt: newNote.excerpt.trim(),
          tag: newNote.tag.trim() || null,
        });
        toast.success("Note created");
      }
      handleNoteDialogOpenChange(false);
    } catch {
      toast.error(editingNoteId ? "Failed to update note" : "Failed to create note");
    }
  };

  const handleDeleteNote = async (id: string, title: string) => {
    try {
      await deleteNote.mutateAsync(id);
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const tags = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(notes.map((note) => note.tag).filter((tag): tag is string => Boolean(tag))),
      ),
    ],
    [notes],
  );

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = notes.filter((note) => {
      const matchesText =
        query.length === 0 ||
        note.title.toLowerCase().includes(query) ||
        (note.excerpt || "").toLowerCase().includes(query) ||
        (note.tag || "").toLowerCase().includes(query);
      const matchesTag = tagFilter === "all" || note.tag === tagFilter;
      return matchesText && matchesTag;
    });

    return filtered.sort((a, b) => {
      if (sortMode === "title") return a.title.localeCompare(b.title);
      if (sortMode === "tag") return (a.tag || "").localeCompare(b.tag || "");
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [notes, search, tagFilter, sortMode]);

  if (isLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <CreateItemDialog
          open={isDialogOpen}
          onOpenChange={handleNoteDialogOpenChange}
          trigger={
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium">
              <Plus className="h-3.5 w-3.5" /> {editingNoteId ? "Edit note" : "New note"}
            </button>
          }
          title={editingNoteId ? "Edit Note" : "New Note"}
          submitLabel={editingNoteId ? "Save Changes" : "Save Note"}
          submittingLabel="Saving..."
          isSubmitting={createNote.isPending || updateNote.isPending}
          submitDisabled={!newNote.title.trim()}
          onSubmit={handleSaveNote}
        >
          <div className="space-y-2">
            <label
              htmlFor="note-title"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Title
            </label>
            <Input
              id="note-title"
              placeholder="e.g. Meeting ideas"
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="note-excerpt"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Excerpt
            </label>
            <Textarea
              id="note-excerpt"
              placeholder="Capture the useful bit."
              value={newNote.excerpt}
              onChange={(e) => setNewNote({ ...newNote, excerpt: e.target.value })}
              className="bg-white/5 border-white/10 min-h-[100px] resize-none focus-visible:ring-[color:var(--violet)]"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="note-tag"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Tag
            </label>
            <Input
              id="note-tag"
              placeholder="e.g. work"
              value={newNote.tag}
              onChange={(e) => setNewNote({ ...newNote, tag: e.target.value })}
              className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
            />
          </div>
        </CreateItemDialog>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search notes..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full pl-9 h-10 rounded-xl bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--violet)]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <DropdownSelect
          value={sortMode}
          onChange={setSortMode}
          options={[
            { value: "recent", label: "Recent" },
            { value: "title", label: "Title" },
            { value: "tag", label: "Tag" },
          ]}
          ariaLabel="Sort notes"
          className="h-9 w-[140px]"
        />
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setTagFilter(tag)}
            className={`px-3 py-1 rounded-full text-xs border transition ${
              tagFilter === tag
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/5 border-white/5 text-muted-foreground hover:bg-white/10 hover:border-white/10"
            }`}
          >
            {tag === "all" ? "All tags" : `#${tag}`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleNotes.length === 0 && (
          <div className="col-span-full py-20 text-center glass-card">
            <p className="text-muted-foreground italic">No notes found. Create your first one!</p>
          </div>
        )}
        {visibleNotes.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5 hover:border-white/20 transition cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-display font-semibold">{n.title}</h3>
              <div className="flex items-center gap-1">
                <Pin className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditDialog(n.id);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-foreground group-hover:opacity-100"
                  aria-label={`Edit note ${n.title}`}
                  title="Edit note"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <DeleteConfirmDialog
                  title="Delete note?"
                  description={`Delete "${n.title}"? This cannot be undone.`}
                  isPending={deleteNote.isPending}
                  onConfirm={() => handleDeleteNote(n.id, n.title)}
                  trigger={
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      disabled={deleteNote.isPending}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-[color:var(--rose)]/10 hover:text-[color:var(--rose)] group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                      aria-label={`Delete note ${n.title}`}
                      title="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {n.excerpt}
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              {n.tag && <span className="px-2 py-0.5 rounded-full bg-white/5">#{n.tag}</span>}
              <span>{new Date(n.updated_at).toLocaleDateString()}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
