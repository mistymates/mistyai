import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { useCalendarItems, type CalendarItem } from "@/lib/hooks/use-data";
import {
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
} from "@/lib/hooks/use-mutations";
import { useGoogleAuthStore } from "@/lib/stores/google-auth-store";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { DropdownSelect } from "@/components/DropdownSelect";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Misty" }] }),
  component: CalendarPage,
});

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const eventTypeOptions = [
  { value: "event", label: "Event" },
  { value: "meeting", label: "Meeting" },
  { value: "focus", label: "Focus" },
  { value: "personal", label: "Personal" },
];

const sourceStyles: Record<CalendarItem["source"], { dot: string; label: string; cell: string }> = {
  local: {
    dot: "bg-[color:var(--violet)]",
    label: "Local",
    cell: "border-[color:var(--violet)]/25 bg-[color:var(--violet)]/8",
  },
  task: {
    dot: "bg-[color:var(--amber)]",
    label: "Deadline",
    cell: "border-[color:var(--amber)]/25 bg-[color:var(--amber)]/8",
  },
  google: {
    dot: "bg-[color:var(--cyan)]",
    label: "Google",
    cell: "border-[color:var(--cyan)]/25 bg-[color:var(--cyan)]/8",
  },
  holiday: {
    dot: "bg-[color:var(--rose)]",
    label: "Tanggal merah",
    cell: "border-[color:var(--rose)]/40 bg-[color:var(--rose)]/12 text-[color:var(--rose)]",
  },
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function getMonthRange(date: Date) {
  const start = startOfMonth(date);
  const end = addMonths(start, 1);
  return { start, end };
}

function toDateKey(date: Date | string) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

function formatTime(item: CalendarItem) {
  const date = new Date(item.start);
  if (item.allDay || Number.isNaN(date.getTime())) return "All day";
  if (item.source === "local" && !item.end && date.getHours() === 0 && date.getMinutes() === 0) {
    return "All day";
  }
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(item: CalendarItem) {
  const date = new Date(item.start);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
  const [viewDate, setViewDate] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({ title: "", time: "", type: "event" });
  const token = useGoogleAuthStore((state) => state.token);
  const expiresAt = useGoogleAuthStore((state) => state.expiresAt);
  const setToken = useGoogleAuthStore((state) => state.setToken);
  const logout = useGoogleAuthStore((state) => state.logout);
  const createCalendarEvent = useCreateCalendarEvent();
  const deleteCalendarEvent = useDeleteCalendarEvent();
  const updateCalendarEvent = useUpdateCalendarEvent();
  const isGoogleConnected = Boolean(token && expiresAt && expiresAt > Date.now());
  const needsGoogleReconnect = Boolean(token && !isGoogleConnected);

  const monthRange = useMemo(() => getMonthRange(viewDate), [viewDate]);
  const upcomingRange = useMemo(() => {
    const start = new Date();
    return { start, end: addMonths(start, 1) };
  }, []);

  const { data: monthItems = [], isFetching: monthFetching } = useCalendarItems(monthRange);
  const { data: upcomingItems = [], isFetching: upcomingFetching } =
    useCalendarItems(upcomingRange);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setToken(tokenResponse.access_token, Number(tokenResponse.expires_in) || undefined);
      toast.success("Google Calendar connected");
    },
    onError: () => toast.error("Failed to connect Google Calendar"),
    scope: "https://www.googleapis.com/auth/calendar.readonly",
  });

  const yearOptions = useMemo(() => {
    const baseYear = today.getFullYear();
    return Array.from({ length: 13 }, (_, index) => baseYear - 6 + index);
  }, [today]);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const itemsByDate = useMemo(() => {
    return monthItems.reduce<Record<string, CalendarItem[]>>((acc, item) => {
      if (!item.dateKey) return acc;
      acc[item.dateKey] = [...(acc[item.dateKey] || []), item];
      return acc;
    }, {});
  }, [monthItems]);

  const selectedItems = itemsByDate[selectedDate] || [];
  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "Selected day";

  const openCreateDialog = (dateKey: string) => {
    setSelectedDate(dateKey);
    setEditingEventId(null);
    setEventForm({ title: "", time: "", type: "event" });
    setIsDialogOpen(true);
  };

  const getLocalRowId = (itemId: string) =>
    itemId.startsWith("local:") ? itemId.slice("local:".length) : itemId;

  const openEditDialog = (item: CalendarItem) => {
    if (item.source !== "local") return;
    const start = new Date(item.start);
    const time =
      item.allDay || Number.isNaN(start.getTime())
        ? ""
        : `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    setSelectedDate(item.dateKey || toDateKey(start) || todayKey);
    setEditingEventId(getLocalRowId(item.id));
    setEventForm({ title: item.title, time, type: item.type || "event" });
    setIsDialogOpen(true);
  };

  const handleCreateEvent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = eventForm.title.trim();
    if (!title || !selectedDate) return;

    const start = eventForm.time
      ? new Date(`${selectedDate}T${eventForm.time}:00`)
      : new Date(`${selectedDate}T00:00:00`);

    try {
      if (editingEventId) {
        await updateCalendarEvent.mutateAsync({
          id: editingEventId,
          updates: {
            title,
            start_time: start.toISOString(),
            end_time: null,
            type: eventForm.type,
          },
        });
        toast.success("Calendar event updated");
      } else {
        await createCalendarEvent.mutateAsync({
          title,
          start_time: start.toISOString(),
          end_time: null,
          type: eventForm.type,
        });
        toast.success("Calendar event added");
      }
      setIsDialogOpen(false);
      setEditingEventId(null);
      setEventForm({ title: "", time: "", type: "event" });
    } catch {
      toast.error(editingEventId ? "Failed to update calendar event" : "Failed to add calendar event");
    }
  };

  const handleDeleteCalendarEvent = async (item: CalendarItem) => {
    try {
      await deleteCalendarEvent.mutateAsync(getLocalRowId(item.id));
      toast.success("Calendar event deleted");
    } catch {
      toast.error("Failed to delete calendar event");
    }
  };

  const setMonth = (month: number) => {
    setViewDate((current) => new Date(current.getFullYear(), month, 1));
  };

  const setYear = (year: number) => {
    setViewDate((current) => new Date(year, current.getMonth(), 1));
  };

  const resetToToday = () => {
    const currentMonth = startOfMonth(new Date());
    setViewDate(currentMonth);
    setSelectedDate(toDateKey(new Date()));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {monthLabel}
            {(monthFetching || upcomingFetching) && (
              <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isGoogleConnected ? (
            <button
              onClick={() => login()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition"
            >
              <CalendarIcon className="h-4 w-4" />
              {needsGoogleReconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
            </button>
          ) : (
            <button
              onClick={() => logout()}
              className="h-9 w-9 grid place-items-center rounded-lg glass hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
              title="Disconnect Google Calendar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}

          <DropdownSelect
            value={String(viewDate.getMonth())}
            onChange={(value) => setMonth(Number(value))}
            options={months.map((month, index) => ({ value: String(index), label: month }))}
            ariaLabel="Select month"
            className="h-9 w-[140px] glass bg-black/30"
          />

          <DropdownSelect
            value={String(viewDate.getFullYear())}
            onChange={(value) => setYear(Number(value))}
            options={yearOptions.map((year) => ({ value: String(year), label: String(year) }))}
            ariaLabel="Select year"
            className="h-9 w-[96px] glass bg-black/30"
          />

          <button
            onClick={() => setViewDate((current) => addMonths(current, -1))}
            className="h-9 w-9 grid place-items-center rounded-lg glass hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewDate((current) => addMonths(current, 1))}
            className="h-9 w-9 grid place-items-center rounded-lg glass hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={resetToToday}
            className="inline-flex h-9 items-center gap-2 rounded-lg glass px-3 text-sm hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Today
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-5 lg:col-span-2"
        >
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
              <div key={`${day}-${index}`}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, index) => (
              <div key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const dateKey = toDateKey(new Date(viewDate.getFullYear(), viewDate.getMonth(), day));
              const dayItems = itemsByDate[dateKey] || [];
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;
              const isHoliday = dayItems.some((item) => item.source === "holiday");
              const primaryItem = dayItems[0];
              const itemStyle = primaryItem ? sourceStyles[primaryItem.source] : null;

              return (
                <div
                  key={dateKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDate(dateKey)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedDate(dateKey);
                    }
                  }}
                  className={`group min-h-24 rounded-xl border p-2 text-left text-sm transition hover:bg-white/8 ${
                    isSelected ? "border-white/35 bg-white/10" : "border-white/5"
                  } ${itemStyle?.cell || ""} ${
                    isToday ? "ring-1 ring-[color:var(--cyan)]/70" : ""
                  } ${isHoliday ? "font-semibold" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full ${
                        isToday
                          ? "bg-gradient-to-br from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-semibold"
                          : ""
                      }`}
                    >
                      {day}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCreateDialog(dateKey);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-white/10 hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Add event on ${dateKey}`}
                      title="Add event"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {dayItems.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {dayItems.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-1.5 truncate text-[10px]"
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              sourceStyles[item.source].dot
                            }`}
                          />
                          <span className="truncate">{item.title}</span>
                        </div>
                      ))}
                      {dayItems.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{dayItems.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <section className="glass-card p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold">Selected day</h3>
                <p className="text-xs text-muted-foreground">{selectedDateLabel}</p>
              </div>
              <button
                onClick={() => openCreateDialog(selectedDate || todayKey)}
                className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1.5 text-xs hover:bg-white/12"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
            <CalendarList
              items={selectedItems}
              emptyText="Nothing scheduled for this date."
              onDeleteLocalEvent={handleDeleteCalendarEvent}
              onEditLocalEvent={openEditDialog}
              isDeleting={deleteCalendarEvent.isPending}
              alwaysShowActions
            />
          </section>

          <section className="glass-card p-5">
            <h3 className="font-display font-semibold">Upcoming</h3>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Next month from today{isGoogleConnected ? ", including Google" : ""}
            </p>
            <CalendarList
              items={upcomingItems}
              emptyText={
                isGoogleConnected
                  ? "No events scheduled."
                  : "Connect Google Calendar to see Google events."
              }
              onDeleteLocalEvent={handleDeleteCalendarEvent}
              isDeleting={deleteCalendarEvent.isPending}
              showDate
            />
          </section>
        </motion.aside>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-black/90 border-white/10 backdrop-blur-xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingEventId ? "Edit calendar event" : "Add calendar event"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4 pt-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Date</div>
              <div className="mt-1">{selectedDateLabel}</div>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="calendar-event-title"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                Title
              </label>
              <Input
                id="calendar-event-title"
                value={eventForm.title}
                onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })}
                placeholder="e.g. Design review"
                className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="calendar-event-time"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Time
                </label>
                <Input
                  id="calendar-event-time"
                  type="time"
                  value={eventForm.time}
                  onChange={(event) => setEventForm({ ...eventForm, time: event.target.value })}
                  className="bg-white/5 border-white/10 focus-visible:ring-[color:var(--violet)]"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="calendar-event-type"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
                >
                  Type
                </label>
                <DropdownSelect
                  id="calendar-event-type"
                  value={eventForm.type}
                  onChange={(type) => setEventForm({ ...eventForm, type })}
                  options={eventTypeOptions}
                  ariaLabel="Select calendar event type"
                  className="h-9 rounded-md focus-visible:ring-[color:var(--violet)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingEventId(null);
                }}
                className="hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createCalendarEvent.isPending ||
                  updateCalendarEvent.isPending ||
                  !eventForm.title.trim()
                }
                className="bg-gradient-to-r from-[color:var(--violet)] to-[color:var(--cyan)] text-black font-medium"
              >
                {createCalendarEvent.isPending || updateCalendarEvent.isPending
                  ? "Saving..."
                  : editingEventId
                    ? "Save changes"
                    : "Save event"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CalendarList({
  items,
  emptyText,
  onDeleteLocalEvent,
  onEditLocalEvent,
  isDeleting = false,
  showDate = false,
  alwaysShowActions = false,
}: {
  items: CalendarItem[];
  emptyText: string;
  onDeleteLocalEvent?: (item: CalendarItem) => void;
  onEditLocalEvent?: (item: CalendarItem) => void;
  isDeleting?: boolean;
  showDate?: boolean;
  alwaysShowActions?: boolean;
}) {
  if (items.length === 0) {
    return <div className="py-8 text-center text-xs italic text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {items.map((item) => (
        <div key={item.id} className="group flex gap-3 rounded-lg p-2 transition hover:bg-white/5">
          <div className="w-14 pt-0.5 text-xs font-mono text-muted-foreground">
            {formatTime(item)}
          </div>
          <div
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sourceStyles[item.source].dot}`}
          />
          <div className="min-w-0 flex-1">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <div className="truncate text-sm">{item.title}</div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              {showDate && <span>{formatDate(item)}</span>}
              <span>{sourceStyles[item.source].label}</span>
              {item.type && item.source !== "holiday" && <span>{item.type}</span>}
              {item.source === "task" && (
                <span className="inline-flex items-center gap-1 text-[color:var(--amber)]">
                  <Clock className="h-3 w-3" />
                  due
                </span>
              )}
            </div>
          </div>
          {item.source === "local" && (
            <>
              {onEditLocalEvent && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditLocalEvent(item);
                  }}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-[color:var(--rose)]/10 hover:text-[color:var(--rose)] focus:opacity-100 disabled:opacity-50 ${
                    alwaysShowActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                  aria-label={`Edit calendar event ${item.title}`}
                  title="Edit event"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDeleteLocalEvent && (
                <DeleteConfirmDialog
                  title="Delete calendar event?"
                  description={`Delete "${item.title}"? This cannot be undone.`}
                  isPending={isDeleting}
                  onConfirm={() => onDeleteLocalEvent(item)}
                  trigger={
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      disabled={isDeleting}
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-[color:var(--rose)]/10 hover:text-[color:var(--rose)] focus:opacity-100 disabled:opacity-50 ${
                        alwaysShowActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label={`Delete calendar event ${item.title}`}
                      title="Delete event"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  }
                />
              )}
            </>
          )}
          {item.source === "task" && (
            <Link
              to="/app/tasks"
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-white/10 hover:text-foreground focus:opacity-100 ${
                alwaysShowActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
              aria-label={`Edit task ${item.title}`}
              title="Edit in Tasks"
              onClick={(event) => event.stopPropagation()}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
