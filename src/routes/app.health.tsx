import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Coffee, Droplets, Heart, Moon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useHealthMetrics } from "@/lib/hooks/use-data";
import { useCreateHealthMetric, useUpdateHealthMetric } from "@/lib/hooks/use-mutations";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/health")({
  head: () => ({ meta: [{ title: "Health - Misty" }] }),
  component: HealthPage,
});

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function HealthPage() {
  const { data: metrics = [] } = useHealthMetrics();
  const createMetric = useCreateHealthMetric();
  const updateMetric = useUpdateHealthMetric();
  const today = todayKey();
  const todayMetric = metrics.find((metric) => metric.metric_date === today) ?? metrics[0];
  const [form, setForm] = useState({
    hydration_ml: String(todayMetric?.hydration_ml ?? 0),
    sleep_minutes: String(todayMetric?.sleep_minutes ?? 0),
    focus_minutes: String(todayMetric?.focus_minutes ?? 0),
    workout_minutes: String(todayMetric?.workout_minutes ?? 0),
    workout_calories: String(todayMetric?.workout_calories ?? 0),
  });

  useEffect(() => {
    setForm({
      hydration_ml: String(todayMetric?.hydration_ml ?? 0),
      sleep_minutes: String(todayMetric?.sleep_minutes ?? 0),
      focus_minutes: String(todayMetric?.focus_minutes ?? 0),
      workout_minutes: String(todayMetric?.workout_minutes ?? 0),
      workout_calories: String(todayMetric?.workout_calories ?? 0),
    });
  }, [todayMetric]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      metric_date: today,
      hydration_ml: Number(form.hydration_ml) || 0,
      sleep_minutes: Number(form.sleep_minutes) || 0,
      focus_minutes: Number(form.focus_minutes) || 0,
      workout_minutes: Number(form.workout_minutes) || 0,
      workout_calories: Number(form.workout_calories) || 0,
    };

    try {
      if (todayMetric) {
        await updateMetric.mutateAsync({ id: todayMetric.id, updates: payload });
      } else {
        await createMetric.mutateAsync(payload);
      }
      toast.success("Health log saved");
    } catch {
      toast.error("Failed to save health log");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">Body, breath, rest.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard icon={Droplets} label="Water" value={`${Number(form.hydration_ml) / 1000}L`} />
        <MetricCard
          icon={Moon}
          label="Sleep"
          value={`${Math.round(Number(form.sleep_minutes) / 60)}h`}
        />
        <MetricCard icon={Coffee} label="Focus" value={`${form.focus_minutes}m`} />
        <MetricCard icon={Activity} label="Workout" value={`${form.workout_minutes}m`} />
      </div>

      <motion.form
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onSubmit={save}
        className="glass-card space-y-5 p-6"
      >
        <div className="flex items-center gap-3 text-muted-foreground">
          <Heart className="h-5 w-5 text-[color:var(--rose)]" />
          <p className="text-sm">Log today's health metrics.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Water (ml)", "hydration_ml"],
            ["Sleep (minutes)", "sleep_minutes"],
            ["Focus (minutes)", "focus_minutes"],
            ["Workout (minutes)", "workout_minutes"],
            ["Workout calories", "workout_calories"],
          ].map(([label, key]) => (
            <label key={key} className="space-y-2 text-sm">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              <Input
                type="number"
                min={0}
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                className="bg-white/5 border-white/10"
              />
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={createMetric.isPending || updateMetric.isPending}
          className="rounded-lg bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] px-4 py-2 text-sm font-medium text-black disabled:opacity-60"
        >
          {createMetric.isPending || updateMetric.isPending ? "Saving..." : "Save health log"}
        </button>
      </motion.form>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card p-5">
      <Icon className="h-5 w-5 text-[color:var(--cyan)]" />
      <div className="mt-3 font-display text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
