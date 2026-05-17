import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/app/health")({
  head: () => ({ meta: [{ title: "Health - Misty" }] }),
  component: HealthPage,
});

function HealthPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Health</h1>
        <p className="text-sm text-muted-foreground mt-1">Body, breath, rest.</p>
      </header>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Heart className="h-5 w-5 text-[color:var(--rose)]" />
          <p className="text-sm">No health data yet.</p>
        </div>
      </motion.div>
    </div>
  );
}
