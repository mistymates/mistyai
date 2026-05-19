import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BookHeart, Smile, Meh, Frown, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import {
  useCreateJournalEntry,
  useDeleteJournalEntry,
  useUpdateJournalEntry,
} from "@/lib/hooks/use-mutations";
import { useJournalEntries } from "@/lib/hooks/use-data";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/app/journal")({
  head: () => ({ meta: [{ title: "Journal - Misty" }] }),
  component: JournalPage,
});

function JournalPage() {
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState<"Smile" | "Meh" | "Frown" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const createEntry = useCreateJournalEntry();
  const updateEntry = useUpdateJournalEntry();
  const deleteJournalEntry = useDeleteJournalEntry();
  const { data: entries = [] } = useJournalEntries();

  const saveEntry = async () => {
    const text = entry.trim();
    if (!text) return;

    try {
      if (editingId) {
        await updateEntry.mutateAsync({ id: editingId, updates: { content: text, mood } });
        toast.success("Journal entry updated");
      } else {
        await createEntry.mutateAsync({ content: text, mood: mood || undefined });
        toast.success("Journal entry created");
      }
      setEntry("");
      setMood(null);
      setEditingId(null);
    } catch {
      toast.error(editingId ? "Failed to update journal entry" : "Failed to create journal entry");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteJournalEntry.mutateAsync(id);
      toast.success("Journal entry deleted");
    } catch {
      toast.error("Failed to delete journal entry");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold flex items-center gap-2">
          <BookHeart className="h-7 w-7 text-[color:var(--rose)]" /> Journal
        </h1>
        <p className="text-sm text-muted-foreground mt-1">A few honest words is enough.</p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <p className="text-sm text-muted-foreground mb-3">
          {editingId ? "Update this entry" : "How are you, really?"}
        </p>
        <div className="flex gap-2 mb-4">
          {[
            { id: "Smile" as const, Icon: Smile },
            { id: "Meh" as const, Icon: Meh },
            { id: "Frown" as const, Icon: Frown },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMood(m.id)}
              className={`h-12 w-12 grid place-items-center rounded-xl transition ${mood === m.id ? "bg-white/15 scale-110" : "bg-white/5 hover:bg-white/10"}`}
            >
              <m.Icon
                className="h-5 w-5"
                style={{
                  color: `oklch(0.85 0.16 ${m.id === "Smile" ? 165 : m.id === "Meh" ? 80 : 10})`,
                }}
              />
            </button>
          ))}
        </div>
        <textarea
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="Write what's on your mind..."
          className="w-full min-h-[160px] p-4 rounded-xl bg-white/5 border border-white/10 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-[color:var(--violet)] resize-none"
        />
        <div className="flex justify-end mt-3 gap-2">
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setEntry("");
                setMood(null);
              }}
              className="px-4 py-2 rounded-full border border-white/10 text-sm"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={saveEntry}
            disabled={!entry.trim() || createEntry.isPending || updateEntry.isPending}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black text-sm font-medium disabled:opacity-50"
          >
            {editingId ? "Save changes" : "Save entry"}
          </button>
        </div>
      </motion.div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Recent entries</h2>
        {entries.length === 0 ? (
          <div className="glass-card p-5 text-sm text-muted-foreground">
            No journal entries yet.
          </div>
        ) : (
          entries.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card group p-5 hover:border-white/20 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEntry(item.content);
                      const moodValue =
                        item.mood === "Smile" || item.mood === "Meh" || item.mood === "Frown"
                          ? item.mood
                          : null;
                      setMood(moodValue);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-foreground group-hover:opacity-100"
                    aria-label="Edit journal entry"
                    title="Edit journal entry"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <DeleteConfirmDialog
                    title="Delete journal entry?"
                    description="Delete this journal entry? This cannot be undone."
                    isPending={deleteJournalEntry.isPending}
                    onConfirm={() => handleDeleteEntry(item.id)}
                    trigger={
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        disabled={deleteJournalEntry.isPending}
                        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-[color:var(--rose)]/10 hover:text-[color:var(--rose)] group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                        aria-label="Delete journal entry"
                        title="Delete journal entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    }
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {item.content}
              </p>
            </motion.div>
          ))
        )}
      </section>
    </div>
  );
}
