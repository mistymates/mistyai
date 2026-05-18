import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { TrendingUp, Target, Wallet, Loader2 } from "lucide-react";
import { useJournalEntries, useTasks, useTransactions } from "@/lib/hooks/use-data";
import { useMemo } from "react";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({ meta: [{ title: "Analytics - Misty" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: journal = [], isLoading: journalLoading } = useJournalEntries();
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();

  const moodWeek = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const isoDate = d.toISOString().split("T")[0];
      const dayEntries = journal.filter(
        (entry) => new Date(entry.created_at).toISOString().split("T")[0] === isoDate,
      );
      const numericMoods = dayEntries
        .map((entry) => Number.parseInt(entry.mood ?? "", 10))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 10);
      const mood = numericMoods.length
        ? numericMoods.reduce((sum, value) => sum + value, 0) / numericMoods.length
        : null;
      return { day: days[d.getDay()], date: isoDate, mood };
    });
  }, [journal]);

  const completedTasks = tasks.filter((task) => task.done).length;
  const transactionNet = transactions.reduce((sum, item) => sum + item.amount, 0);
  const moodValues = moodWeek.map((d) => d.mood).filter((m): m is number => m !== null);
  const moodAverage =
    moodValues.length > 0
      ? (moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length).toFixed(1)
      : null;

  const stats = [
    {
      label: "Tasks completed",
      value: String(completedTasks),
      icon: Target,
      color: "mint",
    },
    {
      label: "Transactions",
      value: String(transactions.length),
      icon: Wallet,
      color: "amber",
    },
    {
      label: "Mood avg",
      value: moodAverage ?? "-",
      icon: TrendingUp,
      color: "rose",
    },
  ];

  const isLoading = journalLoading || transactionsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Weekly review</h1>
        <p className="text-sm text-muted-foreground mt-1">Last 7 days based on your data.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <s.icon className={`h-5 w-5 text-[color:var(--${s.color})]`} />
            <div className="mt-3">
              <div className="font-display text-3xl font-semibold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="font-display font-semibold mb-4">Mood trend</h3>
          {moodValues.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-10 text-center">
              No mood data recorded in the last 7 days.
            </div>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {moodWeek.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-[color:var(--rose)] to-[color:var(--violet)] hover:opacity-80 transition"
                    style={{ height: `${((d.mood ?? 0) / 10) * 100}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5"
        >
          <h3 className="font-display font-semibold mb-4">Money flow</h3>
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-10 text-center">
                No transactions recorded.
              </div>
            ) : (
              transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5"
                >
                  <div>
                    <div className="text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.transaction_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-mono ${t.amount > 0 ? "text-[color:var(--mint)]" : "text-foreground"}`}
                  >
                    {t.amount > 0 ? "+" : ""}
                    {t.amount.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
          {transactions.length > 0 && (
            <div className="mt-4 text-xs text-muted-foreground">
              Net total:{" "}
              <span
                className={transactionNet >= 0 ? "text-[color:var(--mint)]" : "text-foreground"}
              >
                {transactionNet >= 0 ? "+" : ""}
                {transactionNet.toFixed(2)}
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
