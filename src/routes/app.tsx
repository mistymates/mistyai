import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search, Sparkles, PanelRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistant } from "@/lib/assistant-store";
import { useRealtime } from "@/lib/hooks/use-realtime";
import { useNotifications, useReminders } from "@/lib/hooks/use-data";
import { useUpdateReminder } from "@/lib/hooks/use-mutations";
import { dataService } from "@/lib/services/data-service";
import { SpotifyPlaybackBridge } from "@/components/SpotifyPlaybackBridge";
import { ShaderBackground } from "@/components/ShaderBackground";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Reminder } from "@/lib/types/database";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

type ReminderSummary = {
  overdueCount: number;
  dueSoonCount: number;
  sourceCounts: { task: number; calendar: number; manual: number };
  nextItems: Reminder[];
};

function AppLayout() {
  useRealtime();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const toggleSidePanel = useAssistant((s) => s.toggleSidePanel);
  const sidePanelOpen = useAssistant((s) => s.sidePanelOpen);
  const notifications = useAssistant((s) => s.notifications);
  const setNotifications = useAssistant((s) => s.setNotifications);
  const { data: notificationRows = [] } = useNotifications();
  const { data: reminders = [] } = useReminders();
  const updateReminder = useUpdateReminder();
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true);
  const pendingReminders = reminders.filter(
    (item) =>
      item.status === "pending" &&
      new Date(item.scheduled_at).getTime() <= Date.now() &&
      (!item.snoozed_until || new Date(item.snoozed_until).getTime() <= Date.now()),
  );
  const isInQuietHours = useMemo(() => {
    if (!quietHoursEnabled) return false;
    const hour = new Date().getHours();
    return hour >= 20 || hour < 8;
  }, [quietHoursEnabled]);
  const unreadReminderCount = isInQuietHours ? 0 : pendingReminders.length;
  const unreadCount = notificationRows.filter((item) => !item.read).length + unreadReminderCount;
  const reminderSummary = useMemo<ReminderSummary>(() => {
    const now = Date.now();
    const nextHour = now + 60 * 60 * 1000;
    const summary: ReminderSummary = {
      overdueCount: 0,
      dueSoonCount: 0,
      sourceCounts: { task: 0, calendar: 0, manual: 0 },
      nextItems: [],
    };

    const activeReminders = reminders
      .filter(
        (item) =>
          item.status === "pending" &&
          (!item.snoozed_until || new Date(item.snoozed_until).getTime() <= now),
      )
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    for (const reminder of activeReminders) {
      const scheduledAt = new Date(reminder.scheduled_at).getTime();
      if (scheduledAt <= now) summary.overdueCount += 1;
      if (scheduledAt > now && scheduledAt <= nextHour) summary.dueSoonCount += 1;
      summary.sourceCounts[reminder.source_type] += 1;
    }

    summary.nextItems = activeReminders.slice(0, 3);
    return summary;
  }, [reminders]);
  const showDailySummarySection =
    dailySummaryEnabled && (reminderSummary.overdueCount > 0 || reminderSummary.dueSoonCount > 0);

  useEffect(() => {
    let mounted = true;
    fetch("/api/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => {
        if (!mounted || !settings) return;
        setQuietHoursEnabled(settings.quietHoursEnabled ?? true);
        setDailySummaryEnabled(settings.dailySummaryEnabled ?? true);
      })
      .catch((error) => console.error("Failed to load notification settings", error));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setNotifications(unreadCount);
  }, [setNotifications, unreadCount]);

  const markNotificationsRead = async () => {
    try {
      await dataService.markNotificationsRead();
      setNotifications(0);
    } catch (error) {
      console.error("Failed to mark notifications read", error);
    }
  };

  const openReminderTarget = (reminder: Reminder) => {
    if (reminder.source_type === "task" && reminder.source_id) {
      window.location.href = `/app/tasks?editTask=${encodeURIComponent(reminder.source_id)}`;
      return;
    }

    if (reminder.source_type === "calendar") {
      window.location.href = "/app/calendar";
      return;
    }

    window.location.href = "/app/tasks";
  };

  const updateReminderStatus = async (reminder: Reminder, status: "done" | "dismissed") => {
    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        updates: {
          status,
          updated_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error(`Failed to mark reminder as ${status}`, error);
    }
  };

  const snoozeReminder = async (reminder: Reminder) => {
    try {
      const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await updateReminder.mutateAsync({
        id: reminder.id,
        updates: {
          snoozed_until: snoozedUntil,
          snooze_reason: "user_snoozed_1h",
          updated_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to snooze reminder", error);
    }
  };

  return (
    <SidebarProvider>
      <div className="relative min-h-screen flex w-full bg-transparent">
        <ShaderBackground />
        <SpotifyPlaybackBridge />
        <AppSidebar />
        <SidebarInset className="relative z-10 min-w-0 bg-transparent">
          <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-2 border-b border-white/5 bg-background/40 px-3 py-2 backdrop-blur-xl sm:flex-nowrap sm:gap-3 sm:px-4">
            <SidebarTrigger />
            <button
              type="button"
              onClick={() => {
                // Reuse the command palette shortcut so header and keyboard entry stay in sync.
                window.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                    ctrlKey: true,
                    bubbles: true,
                  }),
                );
              }}
              className="group relative order-3 flex h-9 min-w-0 flex-1 basis-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-left transition hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:order-none sm:max-w-md sm:basis-auto"
              aria-label="Open search and command palette"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground flex-1 truncate">
                Search or ask Misty…
              </span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground hidden sm:inline-block">
                ⌘K
              </kbd>
            </button>
            <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new KeyboardEvent("keydown", {
                      key: "j",
                      metaKey: true,
                      ctrlKey: true,
                      bubbles: true,
                    }),
                  )
                }
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-gradient-to-r from-[color:var(--violet)]/20 to-[color:var(--cyan)]/20 px-3 text-xs transition hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Ask Misty"
              >
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--violet)]" />
                <span className="hidden sm:inline">Ask</span>
                <kbd className="text-[10px] px-1 rounded bg-white/10 text-muted-foreground hidden md:inline">
                  ⌘J
                </kbd>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative h-9 w-9 grid place-items-center rounded-lg hover:bg-white/5 transition"
                    aria-label="Open notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {notifications > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[color:var(--rose)] animate-pulse" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between gap-3">
                    <span>Notifications</span>
                    {notifications > 0 && (
                      <button
                        type="button"
                        onClick={markNotificationsRead}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Mark read
                      </button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notificationRows.length === 0 && pendingReminders.length === 0 ? (
                    <DropdownMenuItem disabled>No notifications yet</DropdownMenuItem>
                  ) : (
                    [
                      ...pendingReminders.map((item) => ({
                        id: `reminder-${item.id}`,
                        title: item.title,
                        message: item.message,
                        read: false,
                        type: "reminder" as const,
                        reminder: item,
                      })),
                      ...notificationRows.map((item) => ({
                        ...item,
                        type: "notification" as const,
                      })),
                    ]
                      .slice(0, 6)
                      .map((item) => (
                        <DropdownMenuItem
                          key={item.id}
                          className="items-start gap-3 py-2"
                          onSelect={(event) => event.preventDefault()}
                        >
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 rounded-full ${
                              item.read ? "bg-white/20" : "bg-[color:var(--rose)]"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">{item.title}</span>
                            {item.message && (
                              <span className="block text-xs text-muted-foreground line-clamp-2">
                                {item.message}
                              </span>
                            )}
                            {item.type === "reminder" && (
                              <span className="mt-2 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openReminderTarget(item.reminder)}
                                  className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Open
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void snoozeReminder(item.reminder);
                                  }}
                                  className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Snooze 1h
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void updateReminderStatus(item.reminder, "done");
                                  }}
                                  className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-[color:var(--mint)] hover:text-[color:var(--mint)]/90"
                                >
                                  Done
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void updateReminderStatus(item.reminder, "dismissed");
                                  }}
                                  className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                                >
                                  Dismiss
                                </button>
                              </span>
                            )}
                          </span>
                        </DropdownMenuItem>
                      ))
                  )}
                  {showDailySummarySection && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled
                        className="flex-col items-start gap-1.5 py-3 text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">Daily reminder summary</span>
                        <span>
                          Overdue: {reminderSummary.overdueCount}
                          {" · "}
                          Due in 1h: {reminderSummary.dueSoonCount}
                        </span>
                        <span>
                          Task: {reminderSummary.sourceCounts.task}
                          {" · "}
                          Calendar: {reminderSummary.sourceCounts.calendar}
                          {" · "}
                          Manual: {reminderSummary.sourceCounts.manual}
                        </span>
                        {reminderSummary.nextItems.length > 0 && (
                          <span className="line-clamp-2">
                            Next:{" "}
                            {reminderSummary.nextItems.map((reminder) => reminder.title).join(", ")}
                          </span>
                        )}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                onClick={toggleSidePanel}
                aria-label="Toggle assistant panel"
                aria-pressed={sidePanelOpen}
                className={`grid h-9 w-9 place-items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  sidePanelOpen
                    ? "bg-white/10 text-foreground"
                    : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <PanelRight className="h-4 w-4" />
              </button>
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[color:var(--violet)] to-[color:var(--cyan)] grid place-items-center text-xs font-semibold">
                M
              </div>
            </div>
          </header>
          <main
            className={`flex-1 p-4 sm:p-6 lg:p-8 transition-[padding] duration-300 ${
              sidePanelOpen ? "lg:pr-[380px]" : ""
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={path}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
